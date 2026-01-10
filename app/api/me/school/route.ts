import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDb, sql } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'

export const dynamic = 'force-dynamic'

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS schools (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT,
      clerk_org_id TEXT UNIQUE
    );
  `
  try { await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS clerk_org_id TEXT`; } catch {}
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_clerk_org_id ON schools(clerk_org_id)`; } catch {}
}

export async function GET(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'no active organization' }, { status: 404 })

  const db = getDb()
  const row = await db.get<{ id: string; name?: string }>(`SELECT id, name FROM schools WHERE clerk_org_id = $1`, [orgId])
  if (!row?.id) {
    return NextResponse.json({ error: 'No school linked to this organization' }, { status: 404 })
  }
  return NextResponse.json({ schoolId: row.id, name: row.name || null })
}
