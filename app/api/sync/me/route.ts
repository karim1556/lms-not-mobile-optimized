import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getDb, sql } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'

export const dynamic = 'force-dynamic'

function canonicalRole(role?: string | null) {
  return (role || '')
    .toLowerCase()
    .replace(/^org:/, '')
    .replace(/[\s_-]/g, '')
}

async function ensureSchema() {
  // Ensure schools has clerk_org_id
  await sql`
    CREATE TABLE IF NOT EXISTS schools (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT,
      clerk_org_id TEXT UNIQUE
    );
  `
  try { await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS clerk_org_id TEXT`; } catch {}
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_clerk_org_id ON schools(clerk_org_id)`; } catch {}

  // Coordinators
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
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_one_per_school ON trainers(school_id)`; } catch {}

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

async function getOrCreateSchoolByOrg(orgId: string) {
  const db = getDb()
  const existing = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
  if (existing?.id) return existing.id
  const row = await db.get<{ id: string }>(
    `INSERT INTO schools (name, clerk_org_id) VALUES ($1, $2) RETURNING id`,
    ['Unnamed School', orgId]
  )
  return row?.id as string
}

export async function POST(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const { userId, orgId, orgRole } = await auth()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // If no org, nothing to sync
  if (!orgId) return NextResponse.json({ ok: true, skipped: 'no-org' })

  const role = canonicalRole(orgRole)

  // Prefer resolving an existing school linked to this user (email or clerk_user_id)
  const db = getDb()
  let schoolId: string | null = null
  try {
    if (userId) {
      const hit = await db.get<{ school_id: string }>(
        `SELECT school_id FROM coordinators WHERE clerk_user_id = $1 AND school_id IS NOT NULL
         UNION
         SELECT school_id FROM trainers WHERE clerk_user_id = $1 AND school_id IS NOT NULL
         UNION
         SELECT school_id FROM students WHERE clerk_user_id = $1 AND school_id IS NOT NULL
         LIMIT 1`,
        [userId]
      )
      if (hit?.school_id) schoolId = hit.school_id
    }
  } catch {}

  if (!schoolId) {
    // Try by email as a secondary resolver
    let emailForLookup: string | null = null
    try {
      const user = await currentUser()
      if (user) {
        const primaryEmail = user.emailAddresses?.find(e => e.id === user.primaryEmailAddressId) || user.emailAddresses?.[0]
        emailForLookup = (primaryEmail?.emailAddress || null) as any
      }
    } catch {}
    if (emailForLookup) {
      const hitByEmail = await db.get<{ school_id: string }>(
        `SELECT school_id FROM coordinators WHERE lower(email) = lower($1) AND school_id IS NOT NULL
         UNION
         SELECT school_id FROM trainers WHERE lower(email) = lower($1) AND school_id IS NOT NULL
         UNION
         SELECT school_id FROM students WHERE lower(email) = lower($1) AND school_id IS NOT NULL
         LIMIT 1`,
        [emailForLookup]
      )
      if (hitByEmail?.school_id) schoolId = hitByEmail.school_id
    }
  }

  // If we resolved a school, bind it to this org to maintain continuity
  if (schoolId) {
    try {
      await db.run(`UPDATE schools SET clerk_org_id = $1 WHERE id = $2 AND (clerk_org_id IS NULL OR clerk_org_id = '' OR clerk_org_id = $1)`, [orgId, schoolId])
    } catch {}
  } else {
    // Fall back to original behavior
    schoolId = await getOrCreateSchoolByOrg(orgId)
  }

  // Enrich from Clerk user
  let firstName: string | null = null
  let lastName: string | null = null
  let email: string | null = null
  try {
    const user = await currentUser()
    if (user) {
      firstName = (user.firstName || null) as any
      lastName = (user.lastName || null) as any
      const primaryEmail = user.emailAddresses?.find(e => e.id === user.primaryEmailAddressId) || user.emailAddresses?.[0]
      email = (primaryEmail?.emailAddress || null) as any
    }
  } catch {}

  // Link strategy: prefer updating existing admin-created records by email
  if (role === 'schoolcoordinator' || role === 'coordinator') {
    let linked = false
    if (email) {
      const existing = await db.get<{ id: string }>(`SELECT id FROM coordinators WHERE lower(email) = lower($1)`, [email])
      if (existing?.id) {
        await db.run(
          `UPDATE coordinators SET school_id = $1, context = 'school', first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), clerk_user_id = $5, status = COALESCE(status, 'verified'), updated_at = NOW() WHERE id = $6`,
          [schoolId, firstName, lastName, email, userId, existing.id]
        )
        linked = true
      }
    }
    if (!linked) {
      // If a single coordinator exists for this school without clerk_user_id, attach
      const orphan = await db.get<{ id: string }>(
        `SELECT id FROM coordinators WHERE school_id = $1 AND (clerk_user_id IS NULL OR clerk_user_id = '') LIMIT 1`,
        [schoolId]
      )
      if (orphan?.id) {
        await db.run(
          `UPDATE coordinators SET context = 'school', first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), email = COALESCE($3, email), clerk_user_id = $4, status = COALESCE(status, 'verified'), updated_at = NOW() WHERE id = $5`,
          [firstName, lastName, email, userId, orphan.id]
        )
        linked = true
      }
    }
    if (!linked) {
      await sql`
        INSERT INTO coordinators (school_id, context, status, clerk_user_id, first_name, last_name, email)
        VALUES (${schoolId}, 'school', 'verified', ${userId}, ${firstName}, ${lastName}, ${email})
        ON CONFLICT (clerk_user_id) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          context = 'school',
          first_name = COALESCE(EXCLUDED.first_name, coordinators.first_name),
          last_name = COALESCE(EXCLUDED.last_name, coordinators.last_name),
          email = COALESCE(EXCLUDED.email, coordinators.email),
          updated_at = NOW();
      `
    }
  } else if (role === 'campcoordinator') {
    let linked = false
    if (email) {
      const existing = await db.get<{ id: string }>(`SELECT id FROM coordinators WHERE lower(email) = lower($1)`, [email])
      if (existing?.id) {
        await db.run(
          `UPDATE coordinators SET school_id = $1, context = 'camp', first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), clerk_user_id = $5, status = COALESCE(status, 'verified'), updated_at = NOW() WHERE id = $6`,
          [schoolId, firstName, lastName, email, userId, existing.id]
        )
        linked = true
      }
    }
    if (!linked) {
      await sql`
        INSERT INTO coordinators (school_id, context, status, clerk_user_id, first_name, last_name, email)
        VALUES (${schoolId}, 'camp', 'verified', ${userId}, ${firstName}, ${lastName}, ${email})
        ON CONFLICT (clerk_user_id) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          context = 'camp',
          first_name = COALESCE(EXCLUDED.first_name, coordinators.first_name),
          last_name = COALESCE(EXCLUDED.last_name, coordinators.last_name),
          email = COALESCE(EXCLUDED.email, coordinators.email),
          updated_at = NOW();
      `
    }
  } else if (role === 'trainer') {
    let linked = false
    if (email) {
      const existing = await db.get<{ id: string }>(`SELECT id FROM trainers WHERE lower(email) = lower($1)`, [email])
      if (existing?.id) {
        await db.run(
          `UPDATE trainers SET school_id = $1, first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), clerk_user_id = $5, status = COALESCE(status, 'verified'), updated_at = NOW() WHERE id = $6`,
          [schoolId, firstName, lastName, email, userId, existing.id]
        )
        linked = true
      }
    }
    if (!linked) {
      // Check if a trainer already exists for this school
      const schoolTrainer = await db.get<{ id: string, clerk_user_id: string | null }>(`SELECT id, clerk_user_id FROM trainers WHERE school_id = $1 LIMIT 1`, [schoolId])
      if (schoolTrainer?.id) {
        // If the existing trainer is unclaimed, attach current user; otherwise do not create another trainer
        if (!schoolTrainer.clerk_user_id) {
          await db.run(
            `UPDATE trainers SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), email = COALESCE($3, email), clerk_user_id = $4, status = COALESCE(status, 'verified'), updated_at = NOW() WHERE id = $5`,
            [firstName, lastName, email, userId, schoolTrainer.id]
          )
          linked = true
        } else {
          // Another trainer already exists and is linked; do not create/link a new one
          linked = false
        }
      } else {
        // No trainer exists for this school; create one and link
        await sql`
          INSERT INTO trainers (school_id, status, clerk_user_id, first_name, last_name, email)
          VALUES (${schoolId}, 'verified', ${userId}, ${firstName}, ${lastName}, ${email})
          ON CONFLICT (clerk_user_id) DO UPDATE SET
            school_id = EXCLUDED.school_id,
            first_name = COALESCE(EXCLUDED.first_name, trainers.first_name),
            last_name = COALESCE(EXCLUDED.last_name, trainers.last_name),
            email = COALESCE(EXCLUDED.email, trainers.email),
            updated_at = NOW();
        `
        linked = true
      }
    }
  } else if (role === 'student') {
    let linked = false
    if (email) {
      const existing = await db.get<{ id: string }>(`SELECT id FROM students WHERE lower(email) = lower($1)`, [email])
      if (existing?.id) {
        await db.run(
          `UPDATE students SET school_id = $1, first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), clerk_user_id = $5, status = 'verified', updated_at = NOW() WHERE id = $6`,
          [schoolId, firstName, lastName, email, userId, existing.id]
        )
        linked = true
      }
    }
    if (!linked) {
      await sql`
        INSERT INTO students (school_id, status, clerk_user_id, first_name, last_name, email)
        VALUES (${schoolId}, 'verified', ${userId}, ${firstName}, ${lastName}, ${email})
        ON CONFLICT (clerk_user_id) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          first_name = COALESCE(EXCLUDED.first_name, students.first_name),
          last_name = COALESCE(EXCLUDED.last_name, students.last_name),
          email = COALESCE(EXCLUDED.email, students.email),
          updated_at = NOW();
      `
    }
  }

  return NextResponse.json({ ok: true, userId, orgId, role })
}
