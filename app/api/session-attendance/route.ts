import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function ensureSchema(db: any) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS session_attendance (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      session_id UUID NOT NULL,
      student_id UUID NOT NULL,
      present BOOLEAN DEFAULT false,
      marked_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (session_id, student_id)
    );
  `)
}

async function ownsSession(db:any, sessionId:string, schoolId:string) {
  const row = await db.get(`
    SELECT s.id FROM sessions s INNER JOIN batches b ON b.id = s.batch_id WHERE s.id = $1 AND b.school_id = $2
  `, [sessionId, schoolId]) as any
  return !!row?.id
}

async function getSchoolId(db:any, orgId:string) {
  const row = await db.get(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId]) as any
  return row?.id || null
}

export async function GET(req: NextRequest) {
  const db = getDb()
  await runOnce('ensureSchema', () => ensureSchema(db))
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  if (!(await ownsSession(db, sessionId, schoolId))) return NextResponse.json({ error: 'Session not in your school' }, { status: 403 })
  try {
    const rows = await db.all(
      `SELECT 
          COALESCE(sa.session_id, $1) AS session_id,
          s.id AS student_id,
          COALESCE(sa.present, false) AS present,
          sa.marked_at,
          s.first_name,
          s.last_name,
          s.email
       FROM batch_students bs
       INNER JOIN students s ON s.id = bs.student_id
       INNER JOIN sessions sess ON sess.batch_id = bs.batch_id AND sess.id = $1
       LEFT JOIN session_attendance sa ON sa.session_id = sess.id AND sa.student_id = s.id
       ORDER BY s.first_name NULLS LAST`,
      [sessionId]
    )
    return NextResponse.json(rows)
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const db = getDb()
  await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const body = await req.json()
    const { session_id, student_id, present } = body || {}
    if (!session_id || !student_id) return NextResponse.json({ error: 'session_id and student_id are required' }, { status: 400 })
    if (!(await ownsSession(db, session_id, schoolId))) return NextResponse.json({ error: 'Session not in your school' }, { status: 403 })
    await db.run(
      `INSERT INTO session_attendance (session_id, student_id, present)
       VALUES ($1,$2,$3)
       ON CONFLICT (session_id, student_id) DO UPDATE SET present = EXCLUDED.present, marked_at = NOW()`,
      [session_id, student_id, !!present]
    )
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to mark attendance' }, { status: 500 })
  }
}
