import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    // Attempt to read users table; if it doesn't exist this will throw and be handled below
    const rows = await db.all("SELECT * FROM users ORDER BY created_at DESC");
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("GET /api/users/all failed", err);
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
