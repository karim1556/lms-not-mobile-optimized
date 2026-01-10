import { NextRequest, NextResponse } from 'next/server'
import { getDb, sql } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'

export const dynamic = 'force-dynamic'

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS student_course_enrolments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      student_id UUID NOT NULL,
      course_id UUID NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
}

export async function GET(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')
  const courseId = searchParams.get('courseId')

  try {
    const rows = await db.all(
      `SELECT e.id, e.student_id, e.course_id, e.status, e.created_at,
              s.first_name, s.last_name, s.email,
              c.title AS course_title
       FROM student_course_enrolments e
       LEFT JOIN students s ON s.id = e.student_id
       LEFT JOIN courses c ON c.id = e.course_id
       ${studentId ? 'WHERE e.student_id = $1' : courseId ? 'WHERE e.course_id = $1' : ''}
       ORDER BY e.created_at DESC`,
      studentId ? [studentId] : courseId ? [courseId] : []
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch enrolments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  try {
    const body = await req.json()
    const { student_id, course_id, status } = body || {}
    if (!student_id || !course_id) {
      return NextResponse.json({ error: 'student_id and course_id are required' }, { status: 400 })
    }

    const inserted = await sql`
      INSERT INTO student_course_enrolments (student_id, course_id, status)
      VALUES (${student_id}, ${course_id}, ${status || 'active'})
      RETURNING id
    `
    return NextResponse.json({ id: inserted[0]?.id, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create enrolment' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    await sql`DELETE FROM student_course_enrolments WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete enrolment' }, { status: 500 })
  }
}
