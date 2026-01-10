import { NextRequest, NextResponse } from 'next/server'
import { getDb, Database } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function ensureSchema(db: Database) {
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
  // Unique keys for idempotent upsert per owner
  await db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_lc_student ON lesson_completions(lesson_id, student_id, batch_id) WHERE role = 'student';
  `)
  await db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_lc_trainer ON lesson_completions(lesson_id, trainer_id) WHERE role = 'trainer';
  `)
}

async function getSchoolId(db: Database, orgId:string) {
  const row = await db.get<{ id:string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
  return row?.id || null
}

export async function GET(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get('courseId')
    const role = searchParams.get('role') as 'student'|'trainer'|null
    const studentId = searchParams.get('studentId')
    const trainerId = searchParams.get('trainerId')
    const batchId = searchParams.get('batchId')
    // Log incoming query parameters for debugging
    console.debug('[api/progress/lessons] GET params:', {
      courseId, role, studentId, trainerId, batchId, orgId, schoolId
    })
    if (!courseId || !role) return NextResponse.json({ error: 'courseId and role are required' }, { status: 400 })

    const where: string[] = ['school_id = $1', 'course_id = $2', 'completed = TRUE']
    const params: any[] = [schoolId, courseId]
    if (role === 'student') {
      where.push("role = 'student'")
      if (!studentId || !batchId) return NextResponse.json({ error: 'studentId and batchId are required for role=student' }, { status: 400 })
      where.push('student_id = $' + (params.length + 1))
      params.push(studentId)
      where.push('batch_id = $' + (params.length + 1))
      params.push(batchId)
    } else {
      where.push("role = 'trainer'")
      if (!trainerId) return NextResponse.json({ error: 'trainerId is required for role=trainer' }, { status: 400 })
      where.push('trainer_id = $' + (params.length + 1))
      params.push(trainerId)
    }

    // Log the exact SQL and params to help trace failures
    try {
      console.debug('[api/progress/lessons] Executing SQL:', `SELECT lesson_id FROM lesson_completions WHERE ${where.join(' AND ')}`, 'params=', params)
      const rows = await db.all<{ lesson_id: string }>(`SELECT lesson_id FROM lesson_completions WHERE ${where.join(' AND ')}`, params)
      return NextResponse.json({ completedLessonIds: rows.map(r => r.lesson_id) })
    } catch (sqlErr:any) {
      console.error('[api/progress/lessons] SQL execution error:', sqlErr)
      throw sqlErr
    }
  } catch (e:any) {
    // Log the error server-side for debugging
    console.error('[api/progress/lessons] Error fetching lesson completions:', e)
    const isProd = process.env.NODE_ENV === 'production'
    const message = e?.message || 'Failed to fetch lesson completions'
    const payload: any = { error: message }
    if (!isProd) payload.stack = e?.stack
    return NextResponse.json(payload, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const body = await req.json()
    const { course_id, section_id, lesson_id, completed, role, student_id, trainer_id, batch_id } = body || {}
    if (!course_id || !section_id || !lesson_id || !role) return NextResponse.json({ error: 'course_id, section_id, lesson_id, role are required' }, { status: 400 })

    if (role === 'student') {
      if (!student_id || !batch_id) return NextResponse.json({ error: 'student_id and batch_id required for role=student' }, { status: 400 })
      await db.run(
        `INSERT INTO lesson_completions (school_id, course_id, section_id, lesson_id, role, student_id, batch_id, completed, completed_at)
         VALUES ($1,$2,$3,$4,'student',$5,$6,$7, CASE WHEN $7 THEN NOW() ELSE NULL END)
         ON CONFLICT (lesson_id, student_id, batch_id) WHERE role = 'student'
         DO UPDATE SET completed = EXCLUDED.completed, completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE NULL END`,
        [schoolId, course_id, section_id, lesson_id, student_id, batch_id, !!completed]
      )
    } else if (role === 'trainer') {
      if (!trainer_id) return NextResponse.json({ error: 'trainer_id required for role=trainer' }, { status: 400 })
      await db.run(
        `INSERT INTO lesson_completions (school_id, course_id, section_id, lesson_id, role, trainer_id, completed, completed_at)
         VALUES ($1,$2,$3,$4,'trainer',$5,$6, CASE WHEN $6 THEN NOW() ELSE NULL END)
         ON CONFLICT (lesson_id, trainer_id) WHERE role = 'trainer'
         DO UPDATE SET completed = EXCLUDED.completed, completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE NULL END`,
        [schoolId, course_id, section_id, lesson_id, trainer_id, !!completed]
      )
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to upsert lesson completion' }, { status: 500 })
  }
}
