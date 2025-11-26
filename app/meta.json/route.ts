import { NextResponse } from 'next/server';

export async function GET() {
  // Provide an empty JSON response for /meta.json to avoid 404 noise in devtools.
  return NextResponse.json({});
}
