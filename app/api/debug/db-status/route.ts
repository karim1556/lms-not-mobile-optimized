import '@/lib/fetchWithTimeout'
import { NextResponse } from 'next/server'
import { dbStatus } from '@/lib/db'

export async function GET() {
  try {
    const status = dbStatus()
    return NextResponse.json({ success: true, status })
  } catch (e:any) {
    console.error('[api/debug/db-status] Error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}
