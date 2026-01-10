import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'
import { generatePassword } from '@/lib/password'
import { findUserByEmail, createUser, setUserPassword, addUserToOrganization, listOrganizationMemberships, updateOrganizationMembershipRole, inviteUserToOrganization } from '@/lib/clerk'
import { sendPasswordEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

async function ensureSchema(db:any) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      status TEXT,
      clerk_user_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  // Backfill columns if table exists without them
  await db.run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT;`)
  await db.run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS password TEXT;`)
  await db.run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;`)
  await db.run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;`)
  // Drop legacy unique constraint if created via UNIQUE column syntax
  await db.run(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_clerk_user_id_key;`)
  // Ensure composite uniqueness per school for clerk_user_id and drop old single-column unique index if exists
  await db.run(`DROP INDEX IF EXISTS idx_students_clerk_user_id;`)
  await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_clerk_uid ON students(school_id, clerk_user_id);`)
}

async function getSchoolId(db:any, orgId:string) {
  const row = await db.get(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId]) as any
  return row?.id || null
}

function parseCsv(text:string) {
  // Simple CSV parser: expects header row with first_name,last_name,email,phone
  // Handles quoted values and commas inside quotes minimally
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0)
  if (lines.length === 0) return [] as any[]
  const header = lines[0].split(',').map(h=>h.trim().toLowerCase())
  const rows:any[] = []
  for (let i=1;i<lines.length;i++) {
    const raw = lines[i]
    const cells:string[] = []
    let cur = ''
    let inQ = false
    for (let j=0;j<raw.length;j++) {
      const ch = raw[j]
      if (ch === '"') {
        if (inQ && raw[j+1] === '"') { cur += '"'; j++; }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        cells.push(cur); cur = ''
      } else { cur += ch }
    }
    cells.push(cur)
    const obj:any = {}
    header.forEach((h, idx) => { obj[h] = (cells[idx] ?? '').trim() })
    rows.push(obj)
  }
  return rows
}

export async function POST(req: NextRequest) {
  const db = getDb(); await runOnce('ensureSchema', () => ensureSchema(db))
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolId = await getSchoolId(db, orgId)
  if (!schoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  try {
    // Only coordinators can import students
    const coord = await db.get(`SELECT id FROM coordinators WHERE school_id = $1 AND clerk_user_id = $2`, [schoolId, userId]) as any
    if (!coord?.id) return NextResponse.json({ error: 'Only coordinators can import students' }, { status: 403 })

    const ctype = req.headers.get('content-type') || ''
    let text = ''
    if (ctype.includes('multipart/form-data')) {
      const data = await req.formData()
      const file = data.get('file') as unknown as File | null
      if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
      text = await file.text()
    } else {
      text = await req.text()
    }
    if (!text || text.trim() === '') return NextResponse.json({ error: 'Empty CSV' }, { status: 400 })

    const url = new URL(req.url)
    const inviteMode = ['1','true','yes','on'].includes(String(url.searchParams.get('invite') || '').toLowerCase())
    const rows = parseCsv(text)
    let inserted = 0, skipped = 0, errors: { line:number, error:string }[] = []
    for (let i=0;i<rows.length;i++) {
      const r = rows[i]
      // Accept either first_name/last_name, or a single name column
      let first = r.first_name || r.firstname || null
      let last = r.last_name || r.lastname || null
      if ((!first || !last) && r.name) {
        const parts = String(r.name).trim().split(/\s+/)
        if (!first && parts.length > 0) first = parts[0]
        if (!last && parts.length > 1) last = parts.slice(1).join(' ')
      }
      const email = (r.email || '').toLowerCase()
      // Accept common aliases including 'phone number'
      const phone = (
        r['phone number'] || r.phone_number || r.phonenumber ||
        r.mobile_number || r.mobilenumber || r.mobile || r.phone || null
      )
      if (!email) { skipped++; errors.push({ line: i+2, error: 'Missing email' }); continue }
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRe.test(email)) { skipped++; errors.push({ line: i+2, error: `Invalid email format: ${email}` }); continue }
      const exists = await db.get(`SELECT id FROM students WHERE lower(email) = lower($1) AND school_id = $2`, [email, schoolId]) as any

      if (inviteMode) {
        // Invite flow: create Clerk invitation and upsert student as invited
        const roleId = process.env.CLERK_STUDENT_ROLE_ID || ''
        const roleKey = process.env.CLERK_STUDENT_ROLE || 'student'
        const prefixed = roleKey.includes(':') ? roleKey : `org:${roleKey}`
        try {
          if (roleId) {
            await inviteUserToOrganization(orgId, email, { roleId })
          } else {
            await inviteUserToOrganization(orgId, email, { role: prefixed })
          }
        } catch (e:any) {
          // If already invited or rate limit, record warning but proceed
          const msg = String(e?.message || '')
          errors.push({ line: i+2, error: `Invite warning: ${msg}` })
        }
        try {
          if (exists?.id) {
            await db.run(
              `UPDATE students SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), phone = COALESCE($3, phone), status = 'invited', updated_at = NOW() WHERE id = $4`,
              [first, last, phone || null, exists.id]
            )
          } else {
            const row = await db.get<{ id: string }>(
              `INSERT INTO students (school_id, first_name, last_name, email, phone, status)
               VALUES ($1,$2,$3,$4,$5,'invited')
               RETURNING id`,
              [schoolId, first, last, email, phone || null]
            )
            if (row?.id) inserted++; else skipped++
          }
        } catch (e:any) {
          skipped++; errors.push({ line: i+2, error: `DB invite insert error: ${e?.message || 'failed to upsert invited student'}` })
        }
        // Skip the rest of the non-invite flow for this row
        continue
      }

      // Non-invite mode below
      // Use provided password if present; else generate
      const providedPwd = r.password ? String(r.password) : ''
      if (exists?.id) { skipped++; continue }
      // Create/find Clerk user and password
      const pwd = providedPwd && providedPwd.trim().length > 0 ? providedPwd.trim() : generatePassword()
      let clerkUserId: string | null = null
      try {
        const existing = await findUserByEmail(email)
        if (existing && existing.id) {
          clerkUserId = existing.id
          try { await setUserPassword(existing.id as string, pwd) } catch (e:any) {
            errors.push({ line: i+2, error: `Password update skipped: ${e?.message || 'unknown error'}` })
          }
        } else {
          const created = await createUser({ email, password: pwd, firstName: first || undefined, lastName: last || undefined })
          clerkUserId = created.id
        }
      } catch (e:any) {
        skipped++; errors.push({ line: i+2, error: `Clerk user error: ${e?.message || 'failed to create/find user'}` }); continue
      }
      // Add to current org, then verify.
      // Strategy: try without role -> if Clerk complains about role, try role_id from env -> then try role key from env.
      try {
        await addUserToOrganization({ organizationId: orgId, userId: clerkUserId! })
      } catch (e:any) {
        const msg = String(e?.message || '')
        if (/role/i.test(msg)) {
          const envRoleId = process.env.CLERK_STUDENT_ROLE_ID || ''
          const envRoleKey = process.env.CLERK_STUDENT_ROLE || 'student'
          // First try role_id if provided
          if (envRoleId) {
            try {
              await addUserToOrganization({ organizationId: orgId, userId: clerkUserId!, roleId: envRoleId })
            } catch (e2:any) {
              // Then try role key
              try {
                await addUserToOrganization({ organizationId: orgId, userId: clerkUserId!, role: envRoleKey })
              } catch (e3:any) {
                const msg3 = String(e3?.message || '')
                if (/already\s*a\s*member/i.test(msg3)) {
                  // already a member, treat as success
                } else {
                  // Finally, try Clerk's org-prefixed role (e.g., org:student)
                  try {
                    const prefixed = envRoleKey.includes(':') ? envRoleKey : `org:${envRoleKey}`
                    await addUserToOrganization({ organizationId: orgId, userId: clerkUserId!, role: prefixed })
                  } catch (e4:any) {
                    const prefixed = envRoleKey.includes(':') ? envRoleKey : `org:${envRoleKey}`
                    const msg4 = String(e4?.message || '')
                    if (/already\s*a\s*member/i.test(msg4)) {
                      // already a member, treat as success
                    } else {
                      errors.push({ line: i+2, error: `Org membership warning (role_id='${envRoleId}', role='${envRoleKey}', prefixed='${prefixed}') failed: ${msg4 || 'could not add to organization'}` })
                    }
                  }
                }
              }
            }
          } else {
            // No role_id present, try role key directly
            try {
              await addUserToOrganization({ organizationId: orgId, userId: clerkUserId!, role: envRoleKey })
            } catch (e4:any) {
              const msg4 = String(e4?.message || '')
              if (/already\s*a\s*member/i.test(msg4)) {
                // already a member, treat as success
              } else {
                // Try org-prefixed role as a final fallback
                try {
                  const prefixed = envRoleKey.includes(':') ? envRoleKey : `org:${envRoleKey}`
                  await addUserToOrganization({ organizationId: orgId, userId: clerkUserId!, role: prefixed })
                } catch (e5:any) {
                  const prefixed = envRoleKey.includes(':') ? envRoleKey : `org:${envRoleKey}`
                  const msg5 = String(e5?.message || '')
                  if (/already\s*a\s*member/i.test(msg5)) {
                    // already a member, treat as success
                  } else {
                    errors.push({ line: i+2, error: `Org membership warning (role='${envRoleKey}', prefixed='${prefixed}') failed: ${msg5 || 'could not add to organization'}` })
                  }
                }
              }
            }
          }
        } else {
          // If the user is already a member of the organization, do not report it as an error
          if (/already\s*a\s*member/i.test(msg)) {
            // no-op
          } else {
            errors.push({ line: i+2, error: `Org membership warning: ${msg || 'could not add to organization'}` })
          }
        }
      }
      // Verify membership exists; if missing, skip DB insert
      const targetRoleKey = (process.env.CLERK_STUDENT_ROLE || 'student');
      const targetPrefixed = targetRoleKey.includes(':') ? targetRoleKey : `org:${targetRoleKey}`;
      let membershipOk = false;
      try {
        const memRes: any = await listOrganizationMemberships(orgId, clerkUserId!);
        const membership = Array.isArray(memRes?.data) ? memRes.data[0] : null;
        if (membership?.id) {
          membershipOk = true;
          // If role differs, try to correct it (best-effort)
          if (membership.role !== targetPrefixed) {
            try {
              const envRoleId = process.env.CLERK_STUDENT_ROLE_ID || ''
              if (envRoleId) {
                await updateOrganizationMembershipRole(orgId, membership.id, { roleId: envRoleId });
              } else {
                await updateOrganizationMembershipRole(orgId, membership.id, { role: targetPrefixed });
              }
            } catch (e:any) {
              errors.push({ line: i+2, error: `Org role patch warning: ${e?.message || 'failed to update role'}` })
            }
          }
        }
      } catch (e:any) {
        errors.push({ line: i+2, error: `Membership verify warning: ${e?.message || 'failed to verify membership'}` })
      }
      if (!membershipOk) { skipped++; continue }
      // Insert into DB with clerk_user_id and status verified
      try {
        const row = await db.get<{ inserted: number }>(
          `INSERT INTO students (school_id, first_name, last_name, email, phone, status, clerk_user_id, password)
           VALUES ($1,$2,$3,$4,$5,'verified',$6,$7)
           ON CONFLICT (school_id, clerk_user_id)
           DO NOTHING
           RETURNING 1 as inserted`,
          [schoolId, first, last, email, phone, clerkUserId, pwd]
        )
        if (row) inserted++; else skipped++
      } catch (e:any) {
        skipped++; errors.push({ line: i+2, error: `DB insert error: ${e?.message || 'failed to insert student'}` }); continue
      }
      // Send credentials email (non-blocking)
      try { await sendPasswordEmail(email, pwd, { name: [first, last].filter(Boolean).join(' ') }) } catch (e:any) {
        errors.push({ line: i+2, error: `Email warning: ${e?.message || 'failed to send email'}` })
      }
    }

    return NextResponse.json({ success: true, inserted, skipped, errors })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Failed to import students' }, { status: 500 })
  }
}
