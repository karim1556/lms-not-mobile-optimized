import { NextRequest, NextResponse } from 'next/server';
import { getDb, sql } from '@/lib/db';
import { runOnce } from '@/lib/runtime-migrations'

export const dynamic = 'force-dynamic';

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS coordinators (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      school_id TEXT NOT NULL,
      context TEXT DEFAULT 'school',
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
      organization TEXT,
      responsibilities TEXT,
      phone TEXT,
      alternate_phone TEXT,
      linkedin TEXT,
      bio TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (school_id)
    );
  `;
  // Add new columns if they don't exist
  try { await sql`ALTER TABLE coordinators ADD COLUMN context TEXT DEFAULT 'school'`; } catch {}
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
      'school_id','context','first_name','last_name','gender','dob','pincode','address','image_url','status','email','password',
      'highest_school','experience_years','organization','responsibilities','phone','alternate_phone','linkedin','bio'
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
    // enforce uniqueness if school_id changed
    if ('school_id' in body && body.school_id) {
      const exists = await db.get(`SELECT id FROM coordinators WHERE school_id = $1 AND id <> $2`, [body.school_id, id]);
      if (exists) return NextResponse.json({ error: 'Coordinator already exists for this school' }, { status: 409 });
    }
    await db.run(`UPDATE coordinators SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${fields.length + 1}`, [...values, id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update coordinator' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await db.run(`DELETE FROM coordinators WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete coordinator' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const schoolId = searchParams.get('schoolId');

  try {
    let rows;
    if (id) {
      rows = await db.all(`SELECT * FROM coordinators WHERE id = $1`, [id]);
    } else if (schoolId) {
      rows = await db.all(`SELECT * FROM coordinators WHERE school_id = $1 ORDER BY created_at DESC`, [schoolId]);
    } else {
      rows = await db.all(`SELECT * FROM coordinators ORDER BY created_at DESC`);
    }
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch coordinators' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  try {
    const body = await req.json();
    const {
      school_id,
      context,
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
      organization,
      responsibilities,
      phone,
      alternate_phone,
      linkedin,
      bio,
    } = body || {};

    // school_id is required for school coordinators; for other contexts, generate a placeholder id
    let finalSchoolId = school_id;
    const ctx = (context || 'school').toString();
    if (!finalSchoolId && ctx === 'school') {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
    }
    if (!finalSchoolId && ctx !== 'school') {
      finalSchoolId = `ctx_${ctx}_${Date.now()}`;
    }

    // Enforce 1 coordinator per school
    const existing = await db.get(`SELECT id FROM coordinators WHERE school_id = $1`, [finalSchoolId]);
    if (existing) {
      return NextResponse.json({ error: 'Coordinator already exists for this school' }, { status: 409 });
    }

    const row = await db.get<{ id: string }>(
      `INSERT INTO coordinators (
        school_id, context, first_name, last_name, gender, dob, pincode, address, image_url, status, email, password,
        highest_school, experience_years, organization, responsibilities, phone, alternate_phone, linkedin, bio
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) RETURNING id`,
      [
        finalSchoolId,
        context || 'school',
        first_name || null,
        last_name || null,
        gender || null,
        dob || null,
        pincode || null,
        address || null,
        image_url || null,
        status || 'verified',
        email || null,
        password || null,
        highest_school || null,
        Number.isFinite(+experience_years) ? +experience_years : null,
        organization || null,
        responsibilities || null,
        phone || null,
        alternate_phone || null,
        linkedin || null,
        bio || null,
      ]
    );

    return NextResponse.json({ id: row?.id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create coordinator' }, { status: 500 });
  }
}
