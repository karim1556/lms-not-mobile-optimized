import '@/lib/fetchWithTimeout'
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
// Edge-safe UUID generator: use Web Crypto when available, fallback to Math.random
function makeUUID(): string {
  const g: any = globalThis as any
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(16)
    g.crypto.getRandomValues(buf)
    // Per RFC4122 v4
    buf[6] = (buf[6] & 0x0f) | 0x40
    buf[8] = (buf[8] & 0x3f) | 0x80
    const hex = [...buf].map(b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  }
  // Weak fallback (rarely used)
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1)
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
}

export const dynamic = "force-dynamic";

// Ensure table exists (avoid extension requirements in serverless DBs)
async function ensureTable() {
  const db = getDb();
  // Create without relying on gen_random_uuid to avoid extension dependency
  await db.run(`CREATE TABLE IF NOT EXISTS schools (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    tagline text,
    description text,
    logo_url text,
    banner_url text,
    website text,
    email text,
    phone text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    country text,
    postal_code text,
    principal text,
    established_year int,
    student_count int,
    accreditation text,
    social_links jsonb,
    created_at timestamptz DEFAULT now()
  )`);
  // Add new focal point columns if missing (ignore errors if they already exist)
  try { await db.run(`ALTER TABLE schools ADD COLUMN banner_focal_x int`); } catch {}
  try { await db.run(`ALTER TABLE schools ADD COLUMN banner_focal_y int`); } catch {}
  // Add Clerk organization binding column if missing
  try { await db.run(`ALTER TABLE schools ADD COLUMN clerk_org_id text UNIQUE`); } catch {}
}

// export async function GET(req: NextRequest) {
//   await ensureTable();
//   const db = getDb();
//   const { orgId } = await auth();
//   if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 });
//   const rows = await db.all("SELECT * FROM schools WHERE clerk_org_id = $1 ORDER BY created_at DESC", [orgId]);
//   return NextResponse.json(rows);
// }
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('bypass') === '1') {
      console.log('API: /api/schools bypass response')
      return NextResponse.json([])
    }
    console.log('API: GET /api/schools called')
    // 1. Ensure the table exists — run with timeout so DDL doesn't hang the request
    console.log('API: /api/schools ensureTable start')
    try {
      await Promise.race([
        ensureTable(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ensureTable-timeout')), 5000)),
      ])
    } catch (et: any) {
      console.error('API: ensureTable failed or timed out', et)
      return NextResponse.json({ error: et?.message || 'ensureTable failed' }, { status: 500 })
    }
    console.log('API: /api/schools ensureTable done')

    // 2. Get a database connection
    const db = getDb();

    // 3. Fetch all schools, ordered by newest first
    const t0 = Date.now()
    // add a server-side timeout so a stuck DB query doesn't hang the request
    const QUERY_TIMEOUT_MS = 5000
    let rows: any[] = []
    try {
      rows = await Promise.race([
        db.all("SELECT * FROM schools ORDER BY created_at DESC"),
        new Promise((_, rej) => setTimeout(() => rej(new Error('db-timeout')), QUERY_TIMEOUT_MS)),
      ]) as any[]
    } catch (qerr: any) {
      const tookErr = Date.now() - t0
      console.error(`API: /api/schools query failed after ${tookErr}ms`, qerr)
      return NextResponse.json({ error: qerr?.message || 'DB query failed or timed out' }, { status: qerr?.message === 'db-timeout' ? 504 : 500 })
    }
    const took = Date.now() - t0
    console.log(`API: /api/schools fetched ${Array.isArray(rows) ? rows.length : 0} rows in ${took}ms`)

    // 4. Return all schools as JSON
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("GET /api/schools failed", err);
    const message = err?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  await ensureTable();
  const db = getDb();

  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 });
    const formData = await req.formData();

    const name = (formData.get("name") as string || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Basic validations
    const errors: string[] = [];
    const email = (formData.get("email") as string | null)?.toString().trim() || null;
    const website = (formData.get("website") as string | null)?.toString().trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email format");
    if (website && !/^https?:\/\//i.test(website)) errors.push("Website must start with http(s)://");

    // Optional files
    let logoUrl: string | null = null;
    let bannerUrl: string | null = null;

    const logoFile = formData.get("logo") as File | null;
    if (logoFile && logoFile.size > 0) {
      const fileName = `logos/${Date.now()}-${logoFile.name}`;
      const { error } = await supabase.storage.from("course-thumbnails").upload(fileName, logoFile);
      if (error) {
        console.warn("Logo upload failed, continuing without logo:", error.message);
      } else {
        const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(fileName);
        logoUrl = data.publicUrl;
      }
    }

    const bannerFile = formData.get("banner") as File | null;
    if (bannerFile && bannerFile.size > 0) {
      const fileName = `banners/${Date.now()}-${bannerFile.name}`;
      const { error } = await supabase.storage.from("course-thumbnails").upload(fileName, bannerFile);
      if (error) {
        console.warn("Banner upload failed, continuing without banner:", error.message);
      } else {
        const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(fileName);
        bannerUrl = data.publicUrl;
      }
    }

    // Scalars
    const fields = [
      "tagline","description","website","email","phone","address_line1","address_line2","city","state","country","postal_code","principal","accreditation"
    ] as const;
    const values: Record<string, any> = { name };
    for (const f of fields) values[f] = formData.get(f) || null;

    // Numbers
    const established_year_raw = formData.get("established_year");
    const student_count_raw = formData.get("student_count");
    const banner_focal_x_raw = formData.get("banner_focal_x");
    const banner_focal_y_raw = formData.get("banner_focal_y");
    const established_year = established_year_raw != null && `${established_year_raw}` !== "" ? Number(established_year_raw) : null;
    const student_count = student_count_raw != null && `${student_count_raw}` !== "" ? Number(student_count_raw) : null;
    const banner_focal_x = banner_focal_x_raw != null && `${banner_focal_x_raw}` !== "" ? Number(banner_focal_x_raw) : null;
    const banner_focal_y = banner_focal_y_raw != null && `${banner_focal_y_raw}` !== "" ? Number(banner_focal_y_raw) : null;
    const currentYear = new Date().getFullYear();
    if (established_year != null) {
      if (!Number.isInteger(established_year) || established_year < 1800 || established_year > currentYear) {
        errors.push(`established_year must be between 1800 and ${currentYear}`);
      }
    }
    if (student_count != null) {
      if (!Number.isFinite(student_count) || student_count < 0) errors.push("student_count must be a non-negative number");
    }
    // Validate focal points 0-100
    const inRange = (n: number | null) => n == null || (Number.isFinite(n) && n >= 0 && n <= 100);
    if (!inRange(banner_focal_x)) errors.push("banner_focal_x must be between 0 and 100");
    if (!inRange(banner_focal_y)) errors.push("banner_focal_y must be between 0 and 100");

    // JSON
    let social_links: any = null;
    const rawLinks = formData.get("social_links");
    if (rawLinks) {
      try { social_links = JSON.parse(rawLinks as string); } catch { errors.push("social_links must be valid JSON"); }
      if (social_links && typeof social_links !== "object") errors.push("social_links must be an object");
      if (social_links) {
        const allowed = new Set(["facebook","instagram","twitter","linkedin","youtube"]); 
        for (const key of Object.keys(social_links)) {
          if (!allowed.has(key)) errors.push(`social_links.${key} is not allowed`);
          const val = social_links[key];
          if (val && !/^https?:\/\//i.test(String(val))) errors.push(`social_links.${key} must be a URL starting with http(s)://`);
        }
      }
    }

    if (errors.length) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // Generate UUID on the server to avoid DB extensions
    const id = (globalThis as any).crypto?.randomUUID?.() || makeUUID();

    try {
      const result = await db.get<{ id: string }>(
      `INSERT INTO schools (
        id, name, tagline, description, logo_url, banner_url, website, email, phone,
        address_line1, address_line2, city, state, country, postal_code,
        principal, established_year, student_count, accreditation, social_links,
        banner_focal_x, banner_focal_y, clerk_org_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      ) RETURNING id`,
      [
        id,
        values.name,
        values.tagline,
        values.description,
        logoUrl,
        bannerUrl,
        website,
        email,
        values.phone,
        values.address_line1,
        values.address_line2,
        values.city,
        values.state,
        values.country,
        values.postal_code,
        values.principal,
        established_year,
        student_count,
        values.accreditation,
        social_links,
        banner_focal_x,
        banner_focal_y,
        orgId
      ]
      );
      return NextResponse.json({ id: result?.id, success: true });
    } catch (e: any) {
      // Unique violation on clerk_org_id -> return conflict with existing id
      if (e && (e.code === '23505' || String(e.message || '').includes('unique constraint') )) {
        const existing = await db.get<{ id: string }>(`SELECT id FROM schools WHERE clerk_org_id = $1`, [orgId]);
        return NextResponse.json({ success: false, error: 'School already exists for this organization', id: existing?.id }, { status: 409 });
      }
      throw e;
    }
  } catch (err) {
    console.error("Create school failed", err);
    return NextResponse.json({ error: "Failed to create school" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const db = getDb();
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: 'Organization not selected' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const body = await req.json();
    const allowed = [
      'name','tagline','description','logo_url','banner_url','website','email','phone','address_line1','address_line2','city','state','country','postal_code','principal','established_year','student_count','accreditation','social_links','banner_focal_x','banner_focal_y'
    ];
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${fields.length + 1}`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    // Ensure the school belongs to the same org
    const row = await db.get<{ id: string }>(`SELECT id FROM schools WHERE id = $1 AND clerk_org_id = $2`, [id, orgId]);
    if (!row?.id) return NextResponse.json({ error: 'School not found for this organization' }, { status: 404 });
    await db.run(`UPDATE schools SET ${fields.join(', ')}, created_at = created_at WHERE id = $${fields.length + 1}`, [...values, id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update school' }, { status: 500 });
  }
}
