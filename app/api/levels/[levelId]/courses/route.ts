import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureLevelsSchema } from "@/lib/levels-schema";

export const dynamic = 'force-dynamic';

// GET /api/levels/:levelId/courses - list courses for a level
export async function GET(_req: NextRequest, { params }: { params: Promise<{ levelId: string }> | { levelId: string }}) {
  const db = await getDb();
  await ensureLevelsSchema();
  const p = await params as { levelId?: string };
  const levelId = Number(p.levelId);
  if (!Number.isFinite(levelId)) {
    return NextResponse.json({ error: 'Invalid levelId' }, { status: 400 });
  }
  const rows = await db.all(
    `SELECT c.*, lc.label FROM level_courses lc
     JOIN courses c ON c.id::text = lc.course_id
     WHERE lc.level_id = $1
     ORDER BY c.title ASC`,
    [levelId]
  );
  return NextResponse.json(rows);
}

// POST /api/levels/:levelId/courses { course_id }
export async function POST(req: NextRequest, { params }: { params: Promise<{ levelId: string }> | { levelId: string }}) {
  const db = await getDb();
  try {
    await ensureLevelsSchema();
    const p = await params as { levelId?: string };
    const levelId = Number(p.levelId);
    if (!Number.isFinite(levelId)) {
      return NextResponse.json({ error: 'Invalid levelId' }, { status: 400 });
    }
    const body = await req.json();
    const courseId = String(body.course_id || '').trim();
    const label = String(body.label || 'Easy').trim();
    if (!courseId) {
      return NextResponse.json({ error: 'course_id is required' }, { status: 400 });
    }
    await db.run(
      `INSERT INTO level_courses (level_id, course_id, label)
       VALUES ($1, $2, $3)
       ON CONFLICT (level_id, course_id) DO UPDATE SET label = $3`,
      [levelId, courseId, label]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Add course to level error', e);
    return NextResponse.json({ error: 'Failed to map course to level', details: e?.message }, { status: 500 });
  }
}

// DELETE /api/levels/:levelId/courses?course_id=123
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ levelId: string }> | { levelId: string }}) {
  const db = await getDb();
  await ensureLevelsSchema();
  const p = await params as { levelId?: string };
  const levelId = Number(p.levelId);
  if (!Number.isFinite(levelId)) {
    return NextResponse.json({ error: 'Invalid levelId' }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const courseId = String(searchParams.get('course_id') || '').trim();
  if (!courseId) {
    return NextResponse.json({ error: 'course_id is required' }, { status: 400 });
  }
  await db.run("DELETE FROM level_courses WHERE level_id = $1 AND course_id = $2", [levelId, courseId]);
  return NextResponse.json({ success: true });
}
