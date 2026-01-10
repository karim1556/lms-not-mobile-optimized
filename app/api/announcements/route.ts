import { NextRequest, NextResponse } from 'next/server'
import { getDb, Database } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function ensureSchema(db: Database) {
  // Ensure UUID/crypto extensions exist (no-op if already installed)
  try { await db.run(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`) } catch {}
  try { await db.run(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`) } catch {}
  await db.run(`
    CREATE TABLE IF NOT EXISTS batch_announcements (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      batch_id UUID NOT NULL,
      trainer_id UUID NOT NULL,
      title TEXT,
      body TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
}

async function getSchoolId(db: Database, orgId:string) {
  const row = await db.get(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
  return (row as any)?.id || null
}

export async function GET(req: NextRequest) {
  const db = getDb()
  await runOnce('ensureSchema', () => ensureSchema(db))
  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId')
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    const where: string[] = ['b.school_id = $1']
    const params: any[] = [schoolId]
    if (batchId) { where.push('a.batch_id = $'+(params.length+1)); params.push(batchId) }
    const rows = await db.all(
      `SELECT a.*
       FROM batch_announcements a
       INNER JOIN batches b ON b.id = a.batch_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC
      `,
      params
    )
    return NextResponse.json(rows)
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch announcements' }, { status: 500 })
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
    const { batch_id, trainer_id, title, body: msg } = body || {}
    if (!batch_id || !trainer_id) return NextResponse.json({ error: 'batch_id and trainer_id are required' }, { status: 400 })
    // ensure batch and trainer are in this school
    const b = await db.get(`SELECT id FROM batches WHERE id = $1 AND school_id = $2`, [batch_id, schoolId])
    if (!(b as any)?.id) return NextResponse.json({ error: 'Batch not in your school' }, { status: 403 })
    const t = await db.get(`SELECT id FROM trainers WHERE id = $1 AND school_id = $2`, [trainer_id, schoolId])
    if (!(t as any)?.id) return NextResponse.json({ error: 'Trainer not in your school' }, { status: 403 })
    const row = await db.get(
      `INSERT INTO batch_announcements (batch_id, trainer_id, title, body)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [batch_id, trainer_id, title || null, msg || null]
    )
    return NextResponse.json({ id: (row as any)?.id, success: true })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to create announcement' }, { status: 500 })
  }
}
