import { NextRequest, NextResponse } from 'next/server'
import { getDb, Database } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function ensureSchema(db: Database) {
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
  await db.run(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lookup ON quiz_attempts(school_id, course_id, quiz_id, role, student_id, trainer_id, batch_id)`)
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

  const { searchParams } = new URL(req.url)
  const courseId = searchParams.get('courseId')
  const quizId = searchParams.get('quizId')
  const role = searchParams.get('role') as 'student'|'trainer'|null
  const studentId = searchParams.get('studentId')
  const trainerId = searchParams.get('trainerId')
  const batchId = searchParams.get('batchId')
  if (!courseId || !role) return NextResponse.json({ error: 'courseId and role required' }, { status: 400 })

  const where: string[] = ['school_id = $1', 'course_id = $2']
  const params: any[] = [schoolId, courseId]
  if (quizId) { where.push('quiz_id = $'+(params.length+1)); params.push(quizId) }
  if (role === 'student') {
    if (!studentId || !batchId) return NextResponse.json({ error: 'studentId and batchId required for role=student' }, { status: 400 })
    where.push("role = 'student'")
    where.push('student_id = $'+(params.length+1)); params.push(studentId)
    where.push('batch_id = $'+(params.length+1)); params.push(batchId)
  } else {
    if (!trainerId) return NextResponse.json({ error: 'trainerId required for role=trainer' }, { status: 400 })
    where.push("role = 'trainer'")
    where.push('trainer_id = $'+(params.length+1)); params.push(trainerId)
  }

  const rows = await db.all(
    `SELECT DISTINCT ON (quiz_id) quiz_id, score, max_score, attempted_at
     FROM quiz_attempts
     WHERE ${where.join(' AND ')}
     ORDER BY quiz_id, attempted_at DESC`,
    params
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const body = await req.json()
    const { course_id, section_id, quiz_id, role, student_id, trainer_id, batch_id, score, max_score } = body || {}
    if (!course_id || !section_id || !quiz_id || !role || typeof score !== 'number' || typeof max_score !== 'number') {
      return NextResponse.json({ error: 'course_id, section_id, quiz_id, role, score, max_score required' }, { status: 400 })
    }
    if (role === 'student') {
      if (!student_id || !batch_id) return NextResponse.json({ error: 'student_id and batch_id required for role=student' }, { status: 400 })
      await db.run(
        `INSERT INTO quiz_attempts (school_id, course_id, section_id, quiz_id, role, student_id, batch_id, score, max_score)
         VALUES ($1,$2,$3,$4,'student',$5,$6,$7,$8)`,
        [schoolId, course_id, section_id, quiz_id, student_id, batch_id, score, max_score]
      )
    } else if (role === 'trainer') {
      if (!trainer_id) return NextResponse.json({ error: 'trainer_id required for role=trainer' }, { status: 400 })
      await db.run(
        `INSERT INTO quiz_attempts (school_id, course_id, section_id, quiz_id, role, trainer_id, score, max_score)
         VALUES ($1,$2,$3,$4,'trainer',$5,$6,$7)`,
        [schoolId, course_id, section_id, quiz_id, trainer_id, score, max_score]
      )
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to record quiz attempt' }, { status: 500 })
  }
}
