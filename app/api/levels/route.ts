import '@/lib/fetchWithTimeout'
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

async function ensureLevelsSchema() {
  const db = await getDb();
  // Create levels table
  await db.run(`
    CREATE TABLE IF NOT EXISTS levels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      level_order INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      thumbnail TEXT DEFAULT '',
      is_free BOOLEAN DEFAULT false,
      price NUMERIC(10,2),
      original_price NUMERIC(10,2),
      subtitle TEXT DEFAULT '',
      who_is_this_for TEXT DEFAULT '',
      what_you_will_learn TEXT DEFAULT '',
      prerequisites TEXT DEFAULT '',
      included_courses_note TEXT DEFAULT '',
      estimated_duration TEXT DEFAULT '',
      language TEXT DEFAULT '',
      meta_keywords TEXT DEFAULT '',
      meta_description TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  // Backfill columns if existing table
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT '';`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS who_is_this_for TEXT DEFAULT '';`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS what_you_will_learn TEXT DEFAULT '';`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS prerequisites TEXT DEFAULT '';`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS included_courses_note TEXT DEFAULT '';`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS estimated_duration TEXT DEFAULT '';`);
  await db.run(`ALTER TABLE levels ADD COLUMN IF NOT EXISTS language TEXT DEFAULT '';`);
  // Create mapping table
  await db.run(`
    CREATE TABLE IF NOT EXISTS level_courses (
      level_id INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      PRIMARY KEY (level_id, course_id)
    );
  `);
  // Helpful indexes
  await db.run(`CREATE INDEX IF NOT EXISTS idx_levels_category ON levels(category);`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_levels_order ON levels(level_order);`);
}

// GET /api/levels?category=Beginner
export async function GET(req: NextRequest) {
  const db = await getDb();
  await ensureLevelsSchema();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  if (category) {
    const rows = await db.all(
      "SELECT * FROM levels WHERE category = $1 ORDER BY level_order ASC, id ASC",
      [category]
    );
    return NextResponse.json(rows);
  }
  const rows = await db.all("SELECT * FROM levels ORDER BY category ASC, level_order ASC, id ASC");
  return NextResponse.json(rows);
}

// Utility copied from courses route
function sanitizeFileName(name: string): string {
  const dotIdx = name.lastIndexOf('.')
  const rawBase = dotIdx > 0 ? name.slice(0, dotIdx) : name
  const rawExt = dotIdx > 0 ? name.slice(dotIdx + 1) : ''
  const normalized = rawBase.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  const safeBase = normalized
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'file'
  const safeExt = (rawExt || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return safeExt ? `${safeBase}.${safeExt}` : safeBase
}

// POST /api/levels (multipart/form-data)
export async function POST(req: NextRequest) {
  const db = await getDb();
  try {
    await ensureLevelsSchema();
    const form = await req.formData();
    const name = (form.get('name') as string) || '';
    const category = (form.get('category') as string) || '';
    const level_order = Number((form.get('level_order') as string) ?? 1);
    const description = ((form.get('description') as string) || '');
    const subtitle = ((form.get('subtitle') as string) || '');
    const who_is_this_for = ((form.get('who_is_this_for') as string) || '');
    const what_you_will_learn = ((form.get('what_you_will_learn') as string) || '');
    const prerequisites = ((form.get('prerequisites') as string) || '');
    const included_courses_note = ((form.get('included_courses_note') as string) || '');
    const estimated_duration = ((form.get('estimated_duration') as string) || '');
    const language = ((form.get('language') as string) || '');
    const is_free = String(form.get('is_free') ?? '').toLowerCase() === 'true';
    const priceRaw = form.get('price') as string | null;
    const originalPriceRaw = form.get('original_price') as string | null;
    const price = priceRaw ? Number.parseFloat(priceRaw) : null;
    const original_price = originalPriceRaw ? Number.parseFloat(originalPriceRaw) : null;
    const meta_keywords = ((form.get('meta_keywords') as string) || '');
    const meta_description = ((form.get('meta_description') as string) || '');

    if (!name || !category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 });
    }

    // Require thumbnail file upload (no URL allowed)
    const thumbnailFile = form.get('thumbnail_file') as File | null;
    if (!thumbnailFile || thumbnailFile.size === 0) {
      return NextResponse.json({ error: 'thumbnail_file is required' }, { status: 400 });
    }

    const fileName = `levels/${Date.now()}-${sanitizeFileName(thumbnailFile.name)}`
    const { error: uploadError } = await supabase.storage
      .from('course-thumbnails')
      .upload(fileName, thumbnailFile, { contentType: thumbnailFile.type || undefined, upsert: false, cacheControl: '3600' });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload thumbnail', details: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('course-thumbnails')
      .getPublicUrl(fileName);
    const thumbnail = urlData.publicUrl;

    type Row = { id: number } | null;
    const row = await db.get<Row>(
      `INSERT INTO levels (
        name, category, level_order, description, thumbnail,
        is_free, price, original_price,
        subtitle, who_is_this_for, what_you_will_learn, prerequisites,
        included_courses_note, estimated_duration, language,
        meta_keywords, meta_description
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,$11,$12,
        $13,$14,$15,
        $16,$17
      ) RETURNING id`,
      [
        name, category, level_order, description, thumbnail,
        is_free, price, original_price,
        subtitle, who_is_this_for, what_you_will_learn, prerequisites,
        included_courses_note, estimated_duration, language,
        meta_keywords, meta_description,
      ]
    );

    if (!row) throw new Error('Failed to insert level');
    return NextResponse.json({ id: row.id, success: true });
  } catch (e: any) {
    console.error('Create level error', e);
    return NextResponse.json({ error: 'Failed to create level', details: e?.message }, { status: 500 });
  }
}
