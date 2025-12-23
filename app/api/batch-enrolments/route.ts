import '@/lib/fetchWithTimeout'
import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getDb, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS batch_students (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      batch_id UUID NOT NULL,
      student_id UUID NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (batch_id, student_id)
    );
  `
}

export async function GET(req: NextRequest) {
  await ensureSchema()
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId')
  const studentId = searchParams.get('studentId')
  const studentClerkId = searchParams.get('studentClerkId')
  try {
    const where: string[] = []
    const params: any[] = []
    if (batchId) { where.push(`bs.batch_id = $${params.length+1}`); params.push(batchId) }
    if (studentId) { where.push(`bs.student_id = $${params.length+1}`); params.push(studentId) }
    if (studentClerkId) {
      // Try to match by clerk_user_id OR by email of current user (for legacy records not linked yet)
      let email: string | null = null
      try {
        const u = await currentUser()
        const primaryEmail = u?.emailAddresses?.find(e => e.id === u?.primaryEmailAddressId) || u?.emailAddresses?.[0]
        email = primaryEmail?.emailAddress || null
      } catch {}
      if (email) {
        where.push(`(s.clerk_user_id = $${params.length+1} OR lower(s.email) = lower($${params.length+2}))`)
        params.push(studentClerkId, email)
      } else {
        where.push(`s.clerk_user_id = $${params.length+1}`)
        params.push(studentClerkId)
      }
    }
    const rows = await db.all(
      `SELECT bs.id, bs.batch_id, bs.student_id, bs.added_at,
              b.name as batch_name, b.school_id as school_id,
              s.first_name, s.last_name, s.email, s.clerk_user_id
       FROM batch_students bs
       LEFT JOIN batches b ON b.id = bs.batch_id
       LEFT JOIN students s ON s.id = bs.student_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY bs.added_at DESC`,
      params
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch batch enrolments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  await ensureSchema()
  try {
    const body = await req.json()
    const { student_id, batch_id } = body || {}
    if (!student_id || !batch_id) {
      return NextResponse.json({ error: 'student_id and batch_id are required' }, { status: 400 })
    }
    await sql`
      INSERT INTO batch_students (batch_id, student_id)
      VALUES (${batch_id}, ${student_id})
      ON CONFLICT (batch_id, student_id) DO NOTHING
    `
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to enrol student to batch' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  await ensureSchema()
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const batchId = searchParams.get('batchId')
    const studentId = searchParams.get('studentId')

    if (id) {
      await sql`DELETE FROM batch_students WHERE id = ${id}`
      return NextResponse.json({ success: true })
    }
    if (batchId && studentId) {
      await sql`DELETE FROM batch_students WHERE batch_id = ${batchId} AND student_id = ${studentId}`
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Provide id or (batchId and studentId)' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete batch enrolment' }, { status: 500 })
  }
}
