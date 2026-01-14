import { NextRequest, NextResponse } from 'next/server';
import '@/lib/fetchWithTimeout';
import { getDb, sql } from '@/lib/db';
import { runOnce } from '@/lib/runtime-migrations'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic';

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS batches (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      school_id TEXT,
      course_id UUID,
      start_date DATE,
      end_date DATE,
      max_students INTEGER,
      status TEXT DEFAULT 'pending',
      schedule TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS batch_students (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      batch_id UUID NOT NULL,
      student_id UUID NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (batch_id, student_id)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS batch_trainers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      batch_id UUID NOT NULL,
      trainer_id UUID NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (batch_id, trainer_id)
    );
  `;
}

export async function GET(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all');
  const schoolIdParam = searchParams.get('schoolId');
  // Derive school from Clerk organization
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
  const schoolRow = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId])
  if (!schoolRow?.id) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
  let schoolId = schoolRow.id
  // Allow overriding by query param in development; in production only if it matches
  if (schoolIdParam && (process.env.NODE_ENV !== 'production' || schoolIdParam === schoolId)) {
    schoolId = schoolIdParam
  }

  try {
    let rows;
    if (process.env.NODE_ENV !== 'production' && all === '1' && !id) {
      // Dev/debug: list all batches across schools
      rows = await db.all(
        `SELECT b.*,
                (SELECT COUNT(*) FROM batch_students WHERE batch_id = b.id) AS student_count,
                (SELECT COUNT(*) FROM batch_trainers WHERE batch_id = b.id) AS trainer_count,
                (SELECT string_agg(trainer_id::text, ',') FROM batch_trainers WHERE batch_id = b.id) AS trainer_ids,
                (SELECT string_agg(student_id::text, ',') FROM batch_students WHERE batch_id = b.id) AS student_ids
         FROM batches b
         ORDER BY b.created_at DESC`
      );
    } else if (id) {
      rows = await db.all(
        `SELECT b.*,
                (SELECT string_agg(trainer_id::text, ',') FROM batch_trainers WHERE batch_id = b.id) AS trainer_ids,
                (SELECT string_agg(student_id::text, ',') FROM batch_students WHERE batch_id = b.id) AS student_ids,
                (SELECT COUNT(*) FROM batch_students WHERE batch_id = b.id) AS student_count
         FROM batches b
         WHERE b.id = $1 AND (b.school_id = $2 OR b.school_id IS NULL)`,
        [id, schoolId]
      );
    } else {
      rows = await db.all(
        `SELECT b.*,
                (SELECT COUNT(*) FROM batch_students WHERE batch_id = b.id) AS student_count,
                (SELECT COUNT(*) FROM batch_trainers WHERE batch_id = b.id) AS trainer_count,
                (SELECT string_agg(trainer_id::text, ',') FROM batch_trainers WHERE batch_id = b.id) AS trainer_ids,
                (SELECT string_agg(student_id::text, ',') FROM batch_students WHERE batch_id = b.id) AS student_ids
         FROM batches b
         WHERE (b.school_id = $1 OR b.school_id IS NULL)
         ORDER BY b.created_at DESC`,
        [schoolId]
      );
    }
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch batches' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  try {
    const body = await req.json();
    const {
      name,
      course_id,
      start_date,
      end_date,
      max_students,
      status,
      schedule,
      description,
      trainerIds = [],
      studentIds = [],
    } = body || {};

    // Validate name: must be a non-empty string after trimming whitespace
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    // Validate max_students if provided
    if (max_students !== undefined && max_students !== null && String(max_students).trim() !== '') {
      const ms = Number(max_students)
      if (!Number.isFinite(ms) || ms < 1) {
        return NextResponse.json({ error: 'max_students must be a positive integer' }, { status: 400 })
      }
    }
    // Require and validate dates
    if (!start_date) return NextResponse.json({ error: 'start_date is required' }, { status: 400 })
    if (!end_date) return NextResponse.json({ error: 'end_date is required' }, { status: 400 })
    if (isNaN(Date.parse(start_date))) {
      return NextResponse.json({ error: 'start_date is invalid' }, { status: 400 })
    }
    if (isNaN(Date.parse(end_date))) {
      return NextResponse.json({ error: 'end_date is invalid' }, { status: 400 })
    }
    if (Date.parse(start_date) > Date.parse(end_date)) {
      return NextResponse.json({ error: 'start_date must be before end_date' }, { status: 400 })
    }

    // Require schedule/description and validate lengths
    if (typeof schedule !== 'string' || !schedule.trim()) {
      return NextResponse.json({ error: 'schedule is required' }, { status: 400 })
    }
    if (typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    if (schedule.trim().length > 200) {
      return NextResponse.json({ error: 'schedule too long' }, { status: 400 })
    }
    if (description.trim().length > 1000) {
      return NextResponse.json({ error: 'description too long' }, { status: 400 })
    }

    const { orgId } = await auth()
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
    const schoolRow = await sql`SELECT id FROM schools WHERE clerk_org_id = ${orgId}`
    const derivedSchoolId = schoolRow?.[0]?.id as string | undefined
    if (!derivedSchoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })

    const result = await sql.begin(async (trx) => {
      const inserted = await trx`
        INSERT INTO batches (name, school_id, course_id, start_date, end_date, max_students, status, schedule, description)
        VALUES (
          ${name.trim()},
          ${derivedSchoolId},
          ${course_id || null},
          ${start_date || null},
          ${end_date || null},
          ${Number.isFinite(+max_students) ? +max_students : null},
          ${status || 'pending'},
          ${typeof schedule === 'string' && schedule.trim() ? schedule.trim() : null},
          ${typeof description === 'string' && description.trim() ? description.trim() : null}
        )
        RETURNING id
      `;
      const batchId = inserted[0]?.id as string;

      if (Array.isArray(trainerIds) && trainerIds.length) {
        for (const tid of trainerIds) {
          await trx`
            INSERT INTO batch_trainers (batch_id, trainer_id)
            VALUES (${batchId}, ${tid})
            ON CONFLICT (batch_id, trainer_id) DO NOTHING
          `;
        }
      }

      const cap = Number.isFinite(+max_students) ? +max_students : null
      if (Array.isArray(studentIds) && studentIds.length) {
        if (cap != null && studentIds.length > cap) {
          throw new Error(`Requested ${studentIds.length} students exceeds max_students ${cap}`)
        }
        let insertedCount = 0
        for (const sid of studentIds) {
          if (cap != null && insertedCount >= cap) break
          const res = await trx`
            INSERT INTO batch_students (batch_id, student_id)
            VALUES (${batchId}, ${sid})
            ON CONFLICT (batch_id, student_id) DO NOTHING
            RETURNING id
          `;
          if (res?.[0]?.id) insertedCount++
        }
      }

      return batchId;
    });

    return NextResponse.json({ id: result, success: true });
  } catch (e: any) {
    // If cap exceeded, return 400
    if (String(e?.message || '').includes('exceeds max_students')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: e.message || 'Failed to create batch' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = await req.json();
    const {
      name,
      course_id,
      start_date,
      end_date,
      max_students,
      status,
      schedule,
      description,
      trainerIds,
      studentIds,
    } = body || {};

    const { orgId } = await auth()
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
    const schoolRow = await sql`SELECT id FROM schools WHERE clerk_org_id = ${orgId}`
    const derivedSchoolId = schoolRow?.[0]?.id as string | undefined
    if (!derivedSchoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
    // Ensure this batch belongs to the current school
    const owner = await sql`SELECT id FROM batches WHERE id = ${id} AND school_id = ${derivedSchoolId}`
    if (!owner?.[0]?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await sql.begin(async (trx) => {
      const sets: string[] = [];
      const vals: any[] = [];
      function add(field: string, value: any) {
        sets.push(`${field} = $${sets.length + 1}`);
        vals.push(value);
      }
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return NextResponse.json({ error: 'name is required' }, { status: 400 })
        }
        add('name', name.trim() || null);
      }
      if (schedule !== undefined) {
        add('schedule', typeof schedule === 'string' ? (schedule.trim() || null) : null);
      }
      if (description !== undefined) {
        add('description', typeof description === 'string' ? (description.trim() || null) : null);
      }
      if (course_id !== undefined) add('course_id', course_id || null);
      if (start_date !== undefined) add('start_date', start_date || null);
      if (end_date !== undefined) add('end_date', end_date || null);
      if (max_students !== undefined) add('max_students', Number.isFinite(+max_students) ? +max_students : null);
      if (status !== undefined) add('status', status || null);
      if (schedule !== undefined) add('schedule', schedule || null);
      if (description !== undefined) add('description', description || null);

      if (sets.length) {
        const setClause = sets.join(', ');
        await trx.unsafe(`UPDATE batches SET ${setClause}, updated_at = NOW() WHERE id = $${sets.length + 1}`, [...vals, id]);
      }

      if (Array.isArray(trainerIds)) {
        await trx`DELETE FROM batch_trainers WHERE batch_id = ${id}`;
        for (const tid of trainerIds) {
          await trx`INSERT INTO batch_trainers (batch_id, trainer_id) VALUES (${id}, ${tid}) ON CONFLICT (batch_id, trainer_id) DO NOTHING`;
        }
      }

      if (Array.isArray(studentIds)) {
        // Determine cap: updated max_students (if provided) or current value in DB
        let cap: number | null = null
        if (max_students !== undefined) {
          cap = Number.isFinite(+max_students) ? +max_students : null
        } else {
          const cur = await trx`SELECT max_students FROM batches WHERE id = ${id}`
          const v = cur?.[0]?.max_students
          cap = (v === null || v === undefined) ? null : Number(v)
        }
        if (cap != null && studentIds.length > cap) {
          throw new Error(`Requested ${studentIds.length} students exceeds max_students ${cap}`)
        }
        await trx`DELETE FROM batch_students WHERE batch_id = ${id}`;
        let insertedCount = 0
        for (const sid of studentIds) {
          if (cap != null && insertedCount >= cap) break
          const res = await trx`INSERT INTO batch_students (batch_id, student_id) VALUES (${id}, ${sid}) ON CONFLICT (batch_id, student_id) DO NOTHING RETURNING id`;
          if (res?.[0]?.id) insertedCount++
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (String(e?.message || '').includes('exceeds max_students')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: e.message || 'Failed to update batch' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await runOnce('ensureSchema', ensureSchema)
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { orgId } = await auth()
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 })
    const schoolRow = await sql`SELECT id FROM schools WHERE clerk_org_id = ${orgId}`
    const derivedSchoolId = schoolRow?.[0]?.id as string | undefined
    if (!derivedSchoolId) return NextResponse.json({ error: 'No school bound to this organization' }, { status: 403 })
    const owner = await sql`SELECT id FROM batches WHERE id = ${id} AND school_id = ${derivedSchoolId}`
    if (!owner?.[0]?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await sql.begin(async (trx) => {
      await trx`DELETE FROM batch_students WHERE batch_id = ${id}`;
      await trx`DELETE FROM batch_trainers WHERE batch_id = ${id}`;
      await trx`DELETE FROM batches WHERE id = ${id}`;
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete batch' }, { status: 500 });
  }
}
