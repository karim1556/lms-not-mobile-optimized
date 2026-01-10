import { NextRequest, NextResponse } from 'next/server'
import { getDb, Database } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function ensureSchema(db: Database) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      assignment_id UUID NOT NULL,
      student_id UUID NOT NULL,
      content_url TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      grade NUMERIC,
      feedback TEXT,
      graded_at TIMESTAMPTZ,
      graded_by UUID
    );
  `)
}
async function getSchoolId(db: Database, orgId:string) {
  const row = await db.get<{ id:string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
  return row?.id || null
}

export async function GET(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignmentId')
  const batchId = searchParams.get('batchId')
  const trainerId = searchParams.get('trainerId')
  const studentId = searchParams.get('studentId')
  const onlyUngraded = searchParams.get('onlyUngraded') === 'true'
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const where: string[] = ['b.school_id = $1']
    const params: any[] = [schoolId]
    if (assignmentId) { where.push('sub.assignment_id = $'+(params.length+1)); params.push(assignmentId) }
    if (batchId) { where.push('a.batch_id = $'+(params.length+1)); params.push(batchId) }
    if (onlyUngraded) { where.push('sub.grade IS NULL') }
    if (studentId) { where.push('sub.student_id = $'+(params.length+1)); params.push(studentId) }
    if (trainerId) { where.push('a.trainer_id = $'+(params.length+1)); params.push(trainerId) }
    const rows = await db.all(
      `SELECT sub.*, a.batch_id, a.title AS assignment_title, s.first_name, s.last_name, s.email
       FROM submissions sub
       INNER JOIN trainer_assignments a ON a.id = sub.assignment_id
       INNER JOIN batches b ON b.id = a.batch_id
       LEFT JOIN students s ON s.id = sub.student_id
       WHERE ${where.join(' AND ')}
       ORDER BY sub.submitted_at DESC`,
      params
    )
    return NextResponse.json(rows)
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch submissions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const body = await req.json()
    const { assignment_id, student_id, content_url } = body || {}
    if (!assignment_id || !student_id) return NextResponse.json({ error: 'assignment_id and student_id are required' }, { status: 400 })
    const owns = await db.get<{ id: string }>(`SELECT a.id FROM trainer_assignments a INNER JOIN batches b ON b.id = a.batch_id WHERE a.id = $1 AND b.school_id = $2`, [assignment_id, schoolId])
    if (!owns?.id) return NextResponse.json({ error: 'Assignment not in your school' }, { status: 403 })
    const row = await db.get<{ id:string }>(
      `INSERT INTO submissions (assignment_id, student_id, content_url)
       VALUES ($1,$2,$3) RETURNING id`,
      [assignment_id, student_id, content_url || null]
    )
    return NextResponse.json({ id: row?.id, success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to create submission' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const owns = await db.get<{ id: string }>(
      `SELECT sub.id FROM submissions sub INNER JOIN trainer_assignments a ON a.id = sub.assignment_id INNER JOIN batches b ON b.id = a.batch_id WHERE sub.id = $1 AND b.school_id = $2`,
      [id, schoolId]
    )
    if (!owns?.id) return NextResponse.json({ error: 'Submission not in your school' }, { status: 403 })
    // Resolve the assignment trainer UUID to stamp graded_by correctly (UUID type)
    const tRow = await db.get<{ trainer_id: string }>(
      `SELECT a.trainer_id FROM submissions sub INNER JOIN trainer_assignments a ON a.id = sub.assignment_id WHERE sub.id = $1`,
      [id]
    )
    const body = await req.json()
    const allowed = ['content_url','grade','feedback']
    const fields:string[]=[]; const values:any[]=[]
    for (const k of allowed) {
      if (k in body) {
        fields.push(`${k} = $${values.length + 1}`)
        values.push(body[k])
      }
    }
    if ('grade' in body || 'feedback' in body) {
      fields.push(`graded_at = NOW()`)
      if (tRow?.trainer_id) {
        fields.push(`graded_by = $${values.length + 1}`)
        values.push(tRow.trainer_id)
      } else {
        fields.push(`graded_by = NULL`)
      }
    }
    if (fields.length===0) return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    await db.run(`UPDATE submissions SET ${fields.join(', ')} WHERE id = $${values.length + 1}`,[...values, id])
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to update submission' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const owns = await db.get<{ id: string }>(
      `SELECT sub.id FROM submissions sub INNER JOIN trainer_assignments a ON a.id = sub.assignment_id INNER JOIN batches b ON b.id = a.batch_id WHERE sub.id = $1 AND b.school_id = $2`,
      [id, schoolId]
    )
    if (!owns?.id) return NextResponse.json({ error: 'Submission not in your school' }, { status: 403 })
    await db.run(`DELETE FROM submissions WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to delete submission' }, { status: 500 })
  }
}
