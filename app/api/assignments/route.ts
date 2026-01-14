import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function ensureSchema(db:any) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS trainer_assignments (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      batch_id UUID NOT NULL,
      trainer_id UUID NOT NULL,
      title TEXT,
      instructions TEXT,
      due_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
}
async function getSchoolId(db:any, orgId:string) {
  const row = await db.get(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId]) as any
  return row?.id || null
}

async function ensureCoordinatorForSchool(db:any, schoolId:string) {
  const { userId, orgRole } = await auth()
  if (!userId) return { error: 'Not authenticated', status: 401 } as const
  const role = (orgRole || '').toLowerCase().replace(/^org:/,'').replace(/[^a-z]/g,'')
  if (role === 'admin' || role === 'coordinator' || role === 'schoolcoordinator') return {} as const
  const row = await db.get(`SELECT id FROM coordinators WHERE school_id = $1 AND clerk_user_id = $2`, [schoolId, userId]) as any
  if (!row?.id) return { error: 'Only coordinators can create assignments', status: 403 } as const
  return {} as const
}

export async function GET(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId')
  const trainerId = searchParams.get('trainerId')
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const rows = await db.all(
      `SELECT a.* FROM trainer_assignments a
       INNER JOIN batches b ON b.id = a.batch_id
       WHERE b.school_id = $1
       ${batchId ? 'AND a.batch_id = $2' : ''}
       ${trainerId ? (batchId ? 'AND a.trainer_id = $3' : 'AND a.trainer_id = $2') : ''}
       ORDER BY a.created_at DESC`,
      batchId && trainerId ? [schoolId, batchId, trainerId] : batchId ? [schoolId, batchId] : trainerId ? [schoolId, trainerId] : [schoolId]
    )
    return NextResponse.json(rows)
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch assignments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    // Only coordinators (or org admins/roles) can create assignments
    const coordCheck = await ensureCoordinatorForSchool(db, schoolId)
    if ('error' in coordCheck) return NextResponse.json({ error: coordCheck.error }, { status: coordCheck.status })
    const body = await req.json()
    const { batch_id, trainer_id, title, instructions, due_date } = body || {}
    if (!batch_id || !trainer_id) return NextResponse.json({ error: 'batch_id and trainer_id are required' }, { status: 400 })
    const b = await db.get(`SELECT id FROM batches WHERE id = $1 AND school_id = $2`, [batch_id, schoolId]) as any
    if (!b?.id) return NextResponse.json({ error: 'Batch not in your school' }, { status: 403 })
    const t = await db.get(`SELECT id FROM trainers WHERE id = $1 AND school_id = $2`, [trainer_id, schoolId]) as any
    if (!t?.id) return NextResponse.json({ error: 'Trainer not in your school' }, { status: 403 })
    const row = await db.get(`INSERT INTO trainer_assignments (batch_id, trainer_id, title, instructions, due_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`, [batch_id, trainer_id, title || null, instructions || null, due_date || null]) as any
    return NextResponse.json({ id: row?.id, success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to create assignment' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const owns = await db.get(`SELECT a.id FROM trainer_assignments a INNER JOIN batches b ON b.id = a.batch_id WHERE a.id = $1 AND b.school_id = $2`, [id, schoolId]) as any
  if (!owns?.id) return NextResponse.json({ error: 'Assignment not in your school' }, { status: 403 })
    const body = await req.json()
    const allowed = ['title','instructions','due_date','batch_id','trainer_id']
    const fields:string[]=[]; const values:any[]=[]
    for (const k of allowed) { if (k in body) { fields.push(`${k} = $${fields.length+1}`); values.push(body[k]) } }
    if (fields.length===0) return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    await db.run(`UPDATE trainer_assignments SET ${fields.join(', ')} WHERE id = $${fields.length+1}`, [...values, id])
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to update assignment' }, { status: 500 })
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
  const owns = await db.get(`SELECT a.id FROM trainer_assignments a INNER JOIN batches b ON b.id = a.batch_id WHERE a.id = $1 AND b.school_id = $2`, [id, schoolId]) as any
  if (!owns?.id) return NextResponse.json({ error: 'Assignment not in your school' }, { status: 403 })
    await db.run(`DELETE FROM trainer_assignments WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to delete assignment' }, { status: 500 })
  }
}
