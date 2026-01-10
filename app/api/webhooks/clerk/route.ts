import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
// Webhooks disabled: proceeding without svix dependency
import { getDb, sql } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'

export const dynamic = 'force-dynamic'

// Utility: get required env
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

// Ensure minimal schema pieces we depend on
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

  // Coordinators table
  await sql`
    CREATE TABLE IF NOT EXISTS coordinators (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id TEXT NOT NULL,
      context TEXT DEFAULT 'school',
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      status TEXT,
      clerk_user_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  try { await sql`ALTER TABLE coordinators ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`; } catch {}
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_coordinators_clerk_user_id ON coordinators(clerk_user_id)`; } catch {}

  // Trainers
  await sql`
    CREATE TABLE IF NOT EXISTS trainers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      status TEXT,
      clerk_user_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  try { await sql`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`; } catch {}
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_clerk_user_id ON trainers(clerk_user_id)`; } catch {}

  // Students
  await sql`
    CREATE TABLE IF NOT EXISTS students (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      status TEXT,
      clerk_user_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`; } catch {}
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_students_clerk_user_id ON students(clerk_user_id)`; } catch {}
}

// Helpers
function canonicalRole(role: string | null | undefined) {
  const r = (role || '').toLowerCase().replace(/^org:/, '').replace(/[\s_-]/g, '')
  return r
}

async function getOrCreateSchoolByOrg(orgId: string, name?: string | null) {
  const db = getDb()
  const existing = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
  if (existing?.id) return existing.id
  const row = await db.get<{ id: string }>(
    `INSERT INTO schools (name, clerk_org_id) VALUES ($1, $2) RETURNING id`,
    [name || 'Unnamed School', orgId]
  )
  return row?.id as string
}

export async function POST(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  // Disabled endpoint: using no-webhook sync flow
  return NextResponse.json({ ok: false, reason: 'webhook disabled; using /api/sync/me' }, { status: 410 })
}
