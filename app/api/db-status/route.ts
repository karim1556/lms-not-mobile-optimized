import { NextResponse } from "next/server";
import { dbStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = dbStatus();
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
