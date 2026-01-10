import { NextRequest, NextResponse } from 'next/server';
import { getDb, sql } from '@/lib/db';
import { runOnce } from '@/lib/runtime-migrations'
import { inviteUserToOrganization } from '@/lib/clerk'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic';

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS trainers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id TEXT,
      coordinator_id UUID,
      first_name TEXT,
      last_name TEXT,
      gender TEXT,
      dob DATE,
      pincode TEXT,
      address TEXT,
      image_url TEXT,
      status TEXT,
      email TEXT,
      password TEXT,
      highest_school TEXT,
      experience_years INTEGER,
      specialization TEXT,
      certifications TEXT,
      phone TEXT,
      linkedin TEXT,
      twitter TEXT,
      bio TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  // Ensure we do NOT have a unique index on school_id anymore (we allow multiple when unverified)
  try { await sql`DROP INDEX IF EXISTS idx_trainers_one_per_school` } catch {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_trainers_school ON trainers(school_id)` } catch {}
}

export async function PATCH(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const body = await req.json();
    const allowed = [
      'school_id','coordinator_id','first_name','last_name','gender','dob','pincode','address','image_url','status','email','password',
      'highest_school','experience_years','specialization','certifications','phone','linkedin','twitter','bio'
    ];
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${fields.length + 1}`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    const { orgId } = await auth()
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
    const requestedSchoolId = searchParams.get('schoolId');
    let schoolId: string | null = null;
    if (requestedSchoolId) {
      const verify = await db.get<{ id: string }>(`SELECT id FROM schools WHERE id = $1 AND clerk_org_id = $2`, [requestedSchoolId, orgId]);
      if (verify?.id) schoolId = verify.id;
      else return NextResponse.json({ error: 'School does not belong to this organization' }, { status: 403 });
    }
    if (!schoolId) {
      const schoolRow = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
      if (!schoolRow?.id) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
      schoolId = schoolRow.id;
    }
    // Allow multiple verified trainers per school: removed single-verified constraint
    await db.run(`UPDATE trainers SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${fields.length + 1} AND school_id = $${fields.length + 2}`, [...values, id, schoolId]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update trainer' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { orgId } = await auth()
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
    const requestedSchoolId = searchParams.get('schoolId');
    let schoolId: string | null = null;
    if (requestedSchoolId) {
      const verify = await db.get<{ id: string }>(`SELECT id FROM schools WHERE id = $1 AND clerk_org_id = $2`, [requestedSchoolId, orgId]);
      if (!verify?.id) return NextResponse.json({ error: 'School does not belong to this organization' }, { status: 403 });
      schoolId = verify.id;
    } else {
      const schoolRow = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
      if (!schoolRow?.id) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
      schoolId = schoolRow.id;
    }
    await db.run(`DELETE FROM trainers WHERE id = $1 AND school_id = $2`, [id, schoolId]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete trainer' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  // Admin may pass an explicit schoolId; verify it belongs to this org
  const requestedSchoolId = searchParams.get('schoolId');
  let schoolId: string | null = null;
  if (requestedSchoolId) {
    const verify = await db.get<{ id: string }>(`SELECT id FROM schools WHERE id = $1 AND clerk_org_id = $2`, [requestedSchoolId, orgId]);
    if (verify?.id) schoolId = verify.id;
  }
  if (!schoolId) {
    const schoolRow = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
    if (!schoolRow?.id) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
    schoolId = schoolRow.id;
  }

  try {
    let rows;
    if (id) {
      rows = await db.all(`SELECT * FROM trainers WHERE id = $1 AND school_id = $2`, [id, schoolId]);
    } else {
      rows = await db.all(`SELECT * FROM trainers WHERE school_id = $1 ORDER BY created_at DESC`, [schoolId]);
    }
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch trainers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  try {
    const body = await req.json();
    const {
      coordinator_id,
      first_name,
      last_name,
      gender,
      dob,
      pincode,
      address,
      image_url,
      status,
      email,
      password,
      highest_school,
      experience_years,
      specialization,
      certifications,
      phone,
      linkedin,
      twitter,
      bio,
      invite,
    } = body || {};

    const { orgId } = await auth()
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
    const { searchParams } = new URL(req.url);
    const requestedSchoolId = searchParams.get('schoolId');
    let schoolId: string | null = null;
    if (requestedSchoolId) {
      const verify = await db.get<{ id: string }>(`SELECT id FROM schools WHERE id = $1 AND clerk_org_id = $2`, [requestedSchoolId, orgId]);
      if (!verify?.id) return NextResponse.json({ error: 'School does not belong to this organization' }, { status: 403 });
      schoolId = verify.id;
    } else {
      const schoolRow = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
      if (!schoolRow?.id) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
      schoolId = schoolRow.id;
    }

    // If invite mode requested, create Clerk invitation and upsert trainer as 'invited'
    if (invite === true || String(invite).toLowerCase() === 'true') {
      const emailLower = email ? String(email).toLowerCase() : ''
      if (!emailLower) return NextResponse.json({ error: 'email is required for invite' }, { status: 400 })
      const roleId = process.env.CLERK_TRAINER_ROLE_ID || ''
      const roleKey = process.env.CLERK_TRAINER_ROLE || 'trainer'
      const prefixed = roleKey.includes(':') ? roleKey : `org:${roleKey}`
      try {
        if (roleId) {
          await inviteUserToOrganization(orgId, emailLower, { roleId })
        } else {
          await inviteUserToOrganization(orgId, emailLower, { role: prefixed })
        }
      } catch (e:any) {
        // If Clerk returns an error (already invited, rate limit), continue and persist invited state
      }

      // Upsert trainer record by lower(email) within this school
      try {
        const existing = await db.get<{ id: string }>(`SELECT id FROM trainers WHERE lower(email) = lower($1) AND school_id = $2`, [emailLower, schoolId])
        if (existing?.id) {
          await db.run(
            `UPDATE trainers SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), phone = COALESCE($3, phone), status = 'invited', updated_at = NOW() WHERE id = $4`,
            [first_name || null, last_name || null, phone || null, existing.id]
          )
          return NextResponse.json({ id: existing.id, success: true, mode: 'invited' })
        } else {
          const newRow = await db.get<{ id: string }>(
            `INSERT INTO trainers (school_id, coordinator_id, first_name, last_name, gender, dob, pincode, address, image_url, status, email, highest_school, experience_years, specialization, certifications, phone, linkedin, twitter, bio)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'invited',$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING id`,
            [
              schoolId,
              coordinator_id || null,
              first_name || null,
              last_name || null,
              gender || null,
              dob || null,
              pincode || null,
              address || null,
              image_url || null,
              emailLower,
              highest_school || null,
              Number.isFinite(+experience_years) ? +experience_years : null,
              specialization || null,
              certifications || null,
              phone || null,
              linkedin || null,
              twitter || null,
              bio || null,
            ]
          )
          return NextResponse.json({ id: newRow?.id, success: true, mode: 'invited' })
        }
      } catch (e:any) {
        return NextResponse.json({ error: e?.message || 'Failed to upsert invited trainer' }, { status: 500 })
      }
    }

    // Non-invite flow: insert trainer directly (existing behavior)
    const row = await db.get<{ id: string }>(
      `INSERT INTO trainers (
        school_id, coordinator_id, first_name, last_name, gender, dob, pincode, address, image_url, status,
        email, password, highest_school, experience_years, specialization, certifications, phone, linkedin, twitter, bio
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) RETURNING id`,
      [
        schoolId,
        coordinator_id || null,
        first_name || null,
        last_name || null,
        gender || null,
        dob || null,
        pincode || null,
        address || null,
        image_url || null,
        (status || 'verified') as string,
        email || null,
        password || null,
        highest_school || null,
        Number.isFinite(+experience_years) ? +experience_years : null,
        specialization || null,
        certifications || null,
        phone || null,
        linkedin || null,
        twitter || null,
        bio || null,
      ]
    );

    return NextResponse.json({ id: row?.id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create trainer' }, { status: 500 });
  }
}
