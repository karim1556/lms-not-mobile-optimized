import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureLevelsSchema } from "@/lib/levels-schema";
import { supabase } from "@/lib/supabase";
import '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { levelId: string }}) {
  const db = await getDb();
  await ensureLevelsSchema();
  const id = Number(params.levelId);
  const row = await db.get<any>("SELECT * FROM levels WHERE id = $1", [id]);
  if (!row) return NextResponse.json({ error: 'Level not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: { params: { levelId: string }}) {
  const db = await getDb();
  await ensureLevelsSchema();
  const id = Number(params.levelId);

  const contentType = req.headers.get('content-type') || '';
  let name: string | undefined;
  let category: string | undefined;
  let level_order: number | undefined;
  let description: string | undefined;
  let thumbnail: string | undefined;
  let is_free: boolean | undefined;
  let price: number | undefined;
  let original_price: number | undefined;
  let subtitle: string | undefined;
  let who_is_this_for: string | undefined;
  let what_you_will_learn: string | undefined;
  let prerequisites: string | undefined;
  let included_courses_note: string | undefined;
  let estimated_duration: string | undefined;
  let language: string | undefined;
  let meta_keywords: string | undefined;
  let meta_description: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    name = (form.get('name') as string) ?? undefined;
    category = (form.get('category') as string) ?? undefined;
    level_order = form.get('level_order') != null ? Number(form.get('level_order') as string) : undefined;
    description = (form.get('description') as string) ?? undefined;
    subtitle = (form.get('subtitle') as string) ?? undefined;
    who_is_this_for = (form.get('who_is_this_for') as string) ?? undefined;
    what_you_will_learn = (form.get('what_you_will_learn') as string) ?? undefined;
    prerequisites = (form.get('prerequisites') as string) ?? undefined;
    included_courses_note = (form.get('included_courses_note') as string) ?? undefined;
    estimated_duration = (form.get('estimated_duration') as string) ?? undefined;
    language = (form.get('language') as string) ?? undefined;
    meta_keywords = (form.get('meta_keywords') as string) ?? undefined;
    meta_description = (form.get('meta_description') as string) ?? undefined;
    is_free = form.get('is_free') != null ? String(form.get('is_free')).toLowerCase() === 'true' : undefined;
    price = form.get('price') != null && String(form.get('price')).length > 0 ? Number(form.get('price')) : undefined;
    original_price = form.get('original_price') != null && String(form.get('original_price')).length > 0 ? Number(form.get('original_price')) : undefined;

    const thumbnailFile = form.get('thumbnail_file') as File | null;
    if (thumbnailFile && thumbnailFile.size > 0) {
      const safeName = `levels/${Date.now()}-${(thumbnailFile.name || 'file').replace(/[^a-zA-Z0-9-_\.]+/g, '-')}`;
      const { error } = await supabase.storage
        .from('course-thumbnails')
        .upload(safeName, thumbnailFile, { contentType: thumbnailFile.type || undefined, upsert: false, cacheControl: '3600' });
      if (error) {
        return NextResponse.json({ error: 'Failed to upload thumbnail', details: error.message }, { status: 500 });
      }
      const { data: urlData } = supabase.storage.from('course-thumbnails').getPublicUrl(safeName);
      thumbnail = urlData.publicUrl;
    }
  } else {
    const body = await req.json();
    name = body.name as string | undefined;
    category = body.category as string | undefined;
    level_order = body.level_order as number | undefined;
    description = body.description as string | undefined;
    thumbnail = body.thumbnail as string | undefined;
    is_free = typeof body.is_free === 'boolean' ? body.is_free : undefined;
    price = body.price !== undefined && body.price !== null ? Number(body.price) : undefined;
    original_price = body.original_price !== undefined && body.original_price !== null ? Number(body.original_price) : undefined;
    subtitle = body.subtitle as string | undefined;
    who_is_this_for = body.who_is_this_for as string | undefined;
    what_you_will_learn = body.what_you_will_learn as string | undefined;
    prerequisites = body.prerequisites as string | undefined;
    included_courses_note = body.included_courses_note as string | undefined;
    estimated_duration = body.estimated_duration as string | undefined;
    language = body.language as string | undefined;
    meta_keywords = body.meta_keywords as string | undefined;
    meta_description = body.meta_description as string | undefined;
  }

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
  if (category !== undefined) { fields.push(`category = $${idx++}`); values.push(category); }
  if (level_order !== undefined) { fields.push(`level_order = $${idx++}`); values.push(level_order); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
  if (thumbnail !== undefined) { fields.push(`thumbnail = $${idx++}`); values.push(thumbnail); }
  if (is_free !== undefined) { fields.push(`is_free = $${idx++}`); values.push(is_free); }
  if (price !== undefined) { fields.push(`price = $${idx++}`); values.push(price); }
  if (original_price !== undefined) { fields.push(`original_price = $${idx++}`); values.push(original_price); }
  if (subtitle !== undefined) { fields.push(`subtitle = $${idx++}`); values.push(subtitle); }
  if (who_is_this_for !== undefined) { fields.push(`who_is_this_for = $${idx++}`); values.push(who_is_this_for); }
  if (what_you_will_learn !== undefined) { fields.push(`what_you_will_learn = $${idx++}`); values.push(what_you_will_learn); }
  if (prerequisites !== undefined) { fields.push(`prerequisites = $${idx++}`); values.push(prerequisites); }
  if (included_courses_note !== undefined) { fields.push(`included_courses_note = $${idx++}`); values.push(included_courses_note); }
  if (estimated_duration !== undefined) { fields.push(`estimated_duration = $${idx++}`); values.push(estimated_duration); }
  if (language !== undefined) { fields.push(`language = $${idx++}`); values.push(language); }
  if (meta_keywords !== undefined) { fields.push(`meta_keywords = $${idx++}`); values.push(meta_keywords); }
  if (meta_description !== undefined) { fields.push(`meta_description = $${idx++}`); values.push(meta_description); }

  if (fields.length === 0) return NextResponse.json({ success: true });

  values.push(id);
  await db.run(`UPDATE levels SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { levelId: string }}) {
  const db = await getDb();
  await ensureLevelsSchema();
  await db.run("DELETE FROM levels WHERE id = $1", [Number(params.levelId)]);
  return NextResponse.json({ success: true });
}
