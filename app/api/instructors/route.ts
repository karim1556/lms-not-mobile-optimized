import '@/lib/fetchWithTimeout'
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    // Assuming profiles with a specific role or flag are instructors.
    // Adjust the query based on your actual schema for identifying instructors.
    const instructors = await db.all('SELECT id, full_name FROM profiles WHERE role = $1', ['instructor']);
    return NextResponse.json(instructors);
  } catch (error) {
    console.error('Failed to fetch instructors:', error);
    return NextResponse.json({ error: 'Failed to fetch instructors' }, { status: 500 });
  }
}
