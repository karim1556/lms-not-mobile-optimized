import { NextRequest, NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { getDb, Database } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function ensureSchema(db: Database) {
  // lesson_completions is created by /api/progress/lessons
  await db.run(`
    CREATE TABLE IF NOT EXISTS lesson_completions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id UUID NOT NULL,
      course_id UUID NOT NULL,
      section_id UUID NOT NULL,
      lesson_id UUID NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student','trainer')),
      student_id UUID,
      trainer_id UUID,
      batch_id UUID,
      completed BOOLEAN NOT NULL DEFAULT TRUE,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  await db.run(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id UUID NOT NULL,
      course_id UUID NOT NULL,
      section_id UUID NOT NULL,
      quiz_id UUID NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student','trainer')),
      student_id UUID,
      trainer_id UUID,
      batch_id UUID,
      score NUMERIC NOT NULL,
      max_score NUMERIC NOT NULL,
      attempted_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
}

async function getSchoolId(db: Database, orgId:string) {
  const row = await db.get<{ id:string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
  return row?.id || null
}

function countTotals(course: any) {
  const sections = Array.isArray(course?.curriculum) ? course.curriculum : []
  const sectionTotals = sections.map((s:any) => (Array.isArray(s?.lessons) ? s.lessons.length : 0))
  const totalLessons = sectionTotals.reduce((a:number,b:number)=>a+b,0)
  const quizIds: string[] = []
  sections.forEach((s:any) => (s?.lessons||[]).forEach((l:any)=>{ if ((l.type||'').toString()==='quiz') quizIds.push(String(l.id)) }))
  return {
    totalSections: sections.length,
    totalLessons,
    sectionLessonCounts: sectionTotals,
    sectionIds: sections.map((s:any)=>String(s.id)),
    sections,
    totalQuizzes: quizIds.length,
    quizIds,
  }
}

export async function GET(req: NextRequest) {
  let step = 'init'
  const db = getDb();
  try {
    step = 'ensureSchema'
    await ensureSchema(db)
  } catch (e:any) {
    console.error('summary.ensureSchema', e)
    return NextResponse.json({ error: e?.message || 'Schema init failed', step }, { status: 500 })
  }
  let orgId: string | null = null
  try {
    step = 'auth'
    const a = await auth(); orgId = a?.orgId || null
  } catch (e:any) {
    console.error('summary.auth', e)
    return NextResponse.json({ error: e?.message || 'Auth failed', step }, { status: 500 })
  }
  if (!orgId) return NextResponse.json({ error: 'Organization not selected', step: 'auth' }, { status: 401 })
  let schoolId: string | null = null
  try {
    step = 'getSchoolId'
    schoolId = await getSchoolId(db, orgId)
  } catch (e:any) {
    console.error('summary.getSchoolId', e)
    return NextResponse.json({ error: e?.message || 'School lookup failed', step }, { status: 500 })
  }
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization', step: 'getSchoolId' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get('courseId')
    const trainerId = searchParams.get('trainerId')
    const batchId = searchParams.get('batchId')
    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

    // Fetch course details to know lesson/section totals
    step = 'fetchCourseDetails'
    // Build absolute URL from the current request to avoid relative URL issues in Node fetch
    const detailsUrl = new URL(`/api/courses/${courseId}/details`, req.url).toString()
    // Forward cookies to preserve auth/session in internal fetches on Vercel
    const detailsRes: Response = await fetchWithTimeout(detailsUrl, {
      cache: 'no-store',
      headers: {
        cookie: req.headers.get('cookie') || '',
      },
    }, 10000)
    if (!detailsRes.ok) {
      const txt = await detailsRes.text().catch(()=> '')
      return NextResponse.json({ error: 'Failed to load course details', step, info: txt?.slice(0,500) }, { status: 500 })
    }
    const course = await detailsRes.json().catch((e:any)=>{ throw new Error('Invalid course JSON: '+(e?.message||e)) })
    const totals = countTotals(course)

    // Helper to compute section completion given a set of completed lesson_ids
    const computeSectionCompletion = (sections:any[], completedLessonIds:Set<string>) => {
      let completedSections = 0
      for (const s of sections) {
        const lessons = Array.isArray(s?.lessons)? s.lessons: []
        if (lessons.length === 0) continue
        const allDone = lessons.every((l:any)=> completedLessonIds.has(String(l.id)))
        if (allDone) completedSections++
      }
      const percent = sections.length>0 ? (completedSections/sections.length)*100 : 0
      return { completedSections, percent }
    }

    // Trainer personal summary
    if (trainerId) {
      step = 'trainer.lessonsCount'
      const row = await db.get<{ cnt:number }>(
        `SELECT COUNT(DISTINCT lesson_id) as cnt
         FROM lesson_completions
         WHERE school_id = $1 AND course_id = $2 AND role = 'trainer' AND trainer_id = $3 AND completed = TRUE`,
        [schoolId, courseId, trainerId]
      )
      const completed = Number(row?.cnt || 0)
      const lessonsPercent = totals.totalLessons > 0 ? (completed / totals.totalLessons) * 100 : 0

      // Build set of completed lesson IDs for section completion
      step = 'trainer.completedRows'
      const completedRows: Array<{ lesson_id: string }> = await db.all(
        `SELECT DISTINCT lesson_id FROM lesson_completions
         WHERE school_id = $1 AND course_id = $2 AND role = 'trainer' AND trainer_id = $3 AND completed = TRUE`,
        [schoolId, courseId, trainerId]
      )
      const completedSet = new Set<string>((completedRows||[]).map(r=>String(r.lesson_id)))
      const sec = computeSectionCompletion(totals.sections, completedSet)

      // Quizzes: latest attempt per quiz for this trainer
      let attempted = 0; let avgScorePercent: number|null = null
      if (totals.totalQuizzes > 0) {
        step = 'trainer.quizAttempts'
        const attempts: Array<{ quiz_id: string, score: number, max_score: number }> = await db.all(
          `SELECT DISTINCT ON (quiz_id) quiz_id, score, max_score
           FROM quiz_attempts
           WHERE school_id = $1 AND course_id = $2 AND role = 'trainer' AND trainer_id = $3
           ORDER BY quiz_id, attempted_at DESC`,
          [schoolId, courseId, trainerId]
        )
        attempted = attempts.length
        if (attempted > 0) {
          const percents = attempts.map(a => (Number(a.max_score)>0 ? (Number(a.score)/Number(a.max_score))*100 : 0))
          avgScorePercent = percents.reduce((a,b)=>a+b,0)/attempted
        } else { avgScorePercent = 0 }
      }
      const result = {
        scope: 'trainer',
        lessons: { total: totals.totalLessons, completed, percent: lessonsPercent },
        sections: { total: totals.totalSections, completed: sec.completedSections, percent: sec.percent },
        quizzes: { total: totals.totalQuizzes, attempted, avgScorePercent },
        coursePercent: lessonsPercent,
      }
      return NextResponse.json(result)
    }

    // Batch aggregated summary (students)
    if (batchId) {
      // get all students in batch
      step = 'batch.students'
      const students: Array<{ student_id: string }> = await db.all(
        `SELECT bs.student_id FROM batch_students bs WHERE bs.batch_id = $1`, [batchId]
      )
      const studentIds = students.map(s => s.student_id)

      // Per student completed count
      step = 'batch.perStudentCounts'
      const perStudent: Array<{ student_id: string, completed: number }> = studentIds.length
        ? await db.all(
          `SELECT student_id, COUNT(DISTINCT lesson_id) as completed
           FROM lesson_completions
           WHERE school_id = $1 AND course_id = $2 AND role = 'student' AND batch_id = $3 AND completed = TRUE AND student_id IN (${studentIds.map((_,i)=>'$'+(i+4)).join(',')})
           GROUP BY student_id`,
          [schoolId, courseId, batchId, ...studentIds]
        )
        : []

      // Map for quick lookup
      const compMap = new Map<string, number>()
      for (const r of perStudent) compMap.set(String(r.student_id), Number(r.completed))

      // Compute per-student percent and average
      const perStudentSummaries = studentIds.map((sid) => {
        const c = compMap.get(sid) || 0
        const percent = totals.totalLessons > 0 ? (c / totals.totalLessons) * 100 : 0
        return { student_id: sid, completed: c, percent }
      })
      const avgPercent = perStudentSummaries.length
        ? perStudentSummaries.reduce((a,b)=>a + b.percent, 0) / perStudentSummaries.length
        : 0

      // Section completion and quiz metrics per student
      // Build completed lesson ids per student
      step = 'batch.perStudentLessons'
      const perStudentLessons: Array<{ student_id: string, lesson_id: string }> = studentIds.length
        ? await db.all(
          `SELECT DISTINCT student_id, lesson_id
           FROM lesson_completions
           WHERE school_id = $1 AND course_id = $2 AND role = 'student' AND batch_id = $3 AND completed = TRUE AND student_id IN (${studentIds.map((_,i)=>'$'+(i+4)).join(',')})`,
          [schoolId, courseId, batchId, ...studentIds]
        )
        : []
      const lessonMap = new Map<string, Set<string>>()
      for (const r of perStudentLessons) {
        const sid = String(r.student_id); const lid = String(r.lesson_id)
        if (!lessonMap.has(sid)) lessonMap.set(sid, new Set())
        lessonMap.get(sid)!.add(lid)
      }
      const secPercents: number[] = []
      for (const sid of studentIds) {
        const set = lessonMap.get(sid) || new Set<string>()
        let completedSections = 0
        for (const s of totals.sections) {
          const lessons = Array.isArray(s?.lessons)? s.lessons: []
          if (lessons.length === 0) continue
          const allDone = lessons.every((l:any)=> set.has(String(l.id)))
          if (allDone) completedSections++
        }
        const percent = totals.totalSections>0 ? (completedSections/totals.totalSections)*100 : 0
        secPercents.push(percent)
      }
      const sectionsAvgPercent = secPercents.length ? secPercents.reduce((a,b)=>a+b,0)/secPercents.length : 0

      // Quiz attempts aggregated per batch (latest per quiz per student)
      let quizzesAvgPercent = 0
      if (totals.totalQuizzes > 0 && studentIds.length) {
        step = 'batch.quizAttempts'
        const attempts: Array<{ student_id: string, quiz_id: string, score: number, max_score: number }>= await db.all(
          `SELECT qa.student_id, qa.quiz_id, qa.score, qa.max_score
           FROM (
             SELECT DISTINCT ON (student_id, quiz_id) student_id, quiz_id, score, max_score, attempted_at
             FROM quiz_attempts
             WHERE school_id = $1 AND course_id = $2 AND role = 'student' AND batch_id = $3 AND student_id IN (${studentIds.map((_,i)=>'$'+(i+4)).join(',')})
             ORDER BY student_id, quiz_id, attempted_at DESC
           ) qa`,
          [schoolId, courseId, batchId, ...studentIds]
        )
        // Average percent across all latest attempts
        const percents = attempts.map(a => (Number(a.max_score)>0 ? (Number(a.score)/Number(a.max_score))*100 : 0))
        quizzesAvgPercent = percents.length ? percents.reduce((a,b)=>a+b,0)/percents.length : 0
      }

      const result = {
        scope: 'batch',
        lessons: { total: totals.totalLessons, avgCompletedPercent: avgPercent },
        sections: { total: totals.totalSections, avgCompletedPercent: sectionsAvgPercent },
        quizzes: { total: totals.totalQuizzes, avgScorePercent: quizzesAvgPercent },
        coursePercent: avgPercent,
        perStudent: perStudentSummaries,
      }
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Provide trainerId or batchId' }, { status: 400 })
  } catch (e:any) {
    console.error('summary.error', { step, error: e })
    return NextResponse.json({ error: e.message || 'Failed to build progress summary', step }, { status: 500 })
  }
}
