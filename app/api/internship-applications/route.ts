import '@/lib/fetchWithTimeout'
import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { hasSupabase, supabase } from '@/lib/supabase'

const FALLBACK_PATH = join(process.cwd(), 'data', 'internship-applications.json')

export async function GET() {
  // Return list of applications. Prefer Supabase when available.
  try {
    if (hasSupabase && supabase) {
      const { data, error } = await supabase
        .from('internship_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Supabase query error', error)
      } else if (data) {
        return NextResponse.json({ applications: data })
      }
    }

    // Fallback to local file
    try {
      const raw = await readFile(FALLBACK_PATH, 'utf-8')
      const apps = JSON.parse(raw || '[]')
      return NextResponse.json({ applications: apps })
    } catch (err) {
      // no file -> empty
      return NextResponse.json({ applications: [] })
    }
  } catch (err) {
    return NextResponse.json({ applications: [] })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // minimal validation
    if (!body.fullName || !body.email) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const payload = {
      internship_id: body.selectedInternshipId || body.internshipId || null,
      full_name: body.fullName || body.personalInfo?.fullName || null,
      email: body.email || body.personalInfo?.email || null,
      phone: body.phone || body.personalInfo?.phone || null,
      location: body.location || body.personalInfo?.location || null,
      portfolio: body.portfolio || body.personalInfo?.portfolio || null,
      linkedin: body.linkedin || body.personalInfo?.linkedin || null,
      github: body.github || body.personalInfo?.github || null,
      institution: body.institution || body.education?.institution || null,
      degree: body.degree || body.education?.degree || null,
      field: body.field || body.education?.field || null,
      graduation_year: body.graduationYear || body.education?.graduationYear || null,
      cgpa: body.cgpa || body.education?.cgpa || null,
      resume_url: body.resumeUrl || null,
      cover_letter: body.coverLetter || body.experience?.coverLetter || null,
      skills: body.skills || body.experience?.skills || null,
      projects: body.projects || body.experience?.projects || null,
      why_interested: body.whyInterested || body.experience?.whyInterested || null,
      created_at: new Date().toISOString(),
    }

    if (hasSupabase && supabase) {
      const { data, error } = await supabase.from('internship_applications').insert([payload]).select()
      if (error) {
        console.error('Supabase insert error', error)
      } else {
        return NextResponse.json({ success: true, application: data?.[0] || null })
      }
    }

    // Fallback: write to data file
    try {
      let existing: any[] = []
      try {
        const raw = await readFile(FALLBACK_PATH, 'utf-8')
        existing = JSON.parse(raw || '[]')
      } catch (_) {
        existing = []
      }
      const id = Date.now()
      const record = { id, ...payload }
      existing.unshift(record)
      await writeFile(FALLBACK_PATH, JSON.stringify(existing, null, 2), 'utf-8')
      return NextResponse.json({ success: true, application: record })
    } catch (err) {
      console.error('Fallback write error', err)
      return NextResponse.json({ success: false, error: 'Failed to persist application' }, { status: 500 })
    }

  } catch (err) {
    console.error('Application POST error', err)
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 500 })
  }
}
