import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { ensureProductsSchema } from "@/lib/products-schema"

// Simple in-memory cache for product list (10s)
let productsCache: { data: any[]; ts: number } | null = null
const CACHE_TTL_MS = 10_000

export async function GET() {
  try {
    const db = getDb()
    // Serve from cache if fresh
    if (productsCache && Date.now() - productsCache.ts < CACHE_TTL_MS) {
      return NextResponse.json(productsCache.data)
    }
    // Do not run schema in GET to avoid locks during traffic
    const rows = await db.all<any>(`SELECT * FROM products ORDER BY created_at DESC`)
    const parsed = rows.map((row: any) => {
      const r = { ...row }
      ;["theme","highlights","technologies","kits","addons","tech_specs","features","tags"].forEach((k) => {
        const v = (r as any)[k]
        if (typeof v === 'string') {
          try { (r as any)[k] = JSON.parse(v) } catch {}
        }
      })
      return r
    })
    productsCache = { data: parsed, ts: Date.now() }
    return NextResponse.json(parsed)
  } catch (err: any) {
    // Log on server for easier debugging
    console.error('[API] GET /api/products error', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb()
    // Ensure schema but don't let a long migration block the function invocation.
    // If schema setup takes longer than SCHEMA_TIMEOUT_MS, fail fast with 503.
    const SCHEMA_TIMEOUT_MS = 3000
    const ensure = ensureProductsSchema()
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('schema-timeout')), SCHEMA_TIMEOUT_MS))
    try {
      await Promise.race([ensure, timeout])
    } catch (err: any) {
      console.error('[API] ensureProductsSchema timeout or error', err)
      return NextResponse.json({ error: 'Service busy, try again shortly' }, { status: 503 })
    }
    const body = await req.json()
  const {
    name,
    slug,
    tagline = null,
    description = null,
    hero_image = null,
    technologies_title = null,
    technologies_subtitle = null,
    highlights_title = null,
    highlights_subtitle = null,
    tech_overview = null,
    theme = null,
    highlights = null,
    technologies = null,
    kits = null,
    addons = null,
    tech_specs = null,
    // listing fields
    price = null,
    original_price = null,
    rating = null,
    reviews = null,
    image = null,
    category = null,
    is_best_seller = null,
    is_new = null,
    in_stock = null,
    features = null,
    delivery = null,
    level = null,
    instructor = null,
    duration = null,
    students = null,
    tags = null,
    discount = null,
    video_preview = null,
  } = body || {}

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 })
  }

  await db.run(
    `INSERT INTO products (
       name, slug, tagline, description, hero_image, technologies_title, technologies_subtitle,
       highlights_title, highlights_subtitle, tech_overview,
       price, original_price, rating, reviews, image, category, is_best_seller, is_new, in_stock,
       features, delivery, level, instructor, duration, students, tags, discount, video_preview,
       theme, highlights, technologies, kits, addons, tech_specs
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,$16,$17,$18,$19,
       $20,$21,$22,$23,$24,$25,$26,$27,$28,
       $29::jsonb,$30::jsonb,$31::jsonb,$32::jsonb,$33::jsonb,$34::jsonb
     )
    ON CONFLICT (slug) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, products.name),
      tagline = COALESCE(EXCLUDED.tagline, products.tagline),
      description = COALESCE(EXCLUDED.description, products.description),
      hero_image = COALESCE(EXCLUDED.hero_image, products.hero_image),
      technologies_title = COALESCE(EXCLUDED.technologies_title, products.technologies_title),
      technologies_subtitle = COALESCE(EXCLUDED.technologies_subtitle, products.technologies_subtitle),
      highlights_title = COALESCE(EXCLUDED.highlights_title, products.highlights_title),
      highlights_subtitle = COALESCE(EXCLUDED.highlights_subtitle, products.highlights_subtitle),
      tech_overview = COALESCE(EXCLUDED.tech_overview, products.tech_overview),
      price = COALESCE(EXCLUDED.price, products.price),
      original_price = COALESCE(EXCLUDED.original_price, products.original_price),
      rating = COALESCE(EXCLUDED.rating, products.rating),
      reviews = COALESCE(EXCLUDED.reviews, products.reviews),
      image = COALESCE(EXCLUDED.image, products.image),
      category = COALESCE(EXCLUDED.category, products.category),
      is_best_seller = COALESCE(EXCLUDED.is_best_seller, products.is_best_seller),
      is_new = COALESCE(EXCLUDED.is_new, products.is_new),
      in_stock = COALESCE(EXCLUDED.in_stock, products.in_stock),
      features = COALESCE(EXCLUDED.features, products.features),
      delivery = COALESCE(EXCLUDED.delivery, products.delivery),
      level = COALESCE(EXCLUDED.level, products.level),
      instructor = COALESCE(EXCLUDED.instructor, products.instructor),
      duration = COALESCE(EXCLUDED.duration, products.duration),
      students = COALESCE(EXCLUDED.students, products.students),
      tags = COALESCE(EXCLUDED.tags, products.tags),
      discount = COALESCE(EXCLUDED.discount, products.discount),
      video_preview = COALESCE(EXCLUDED.video_preview, products.video_preview),
      theme = COALESCE(EXCLUDED.theme, products.theme),
      highlights = COALESCE(EXCLUDED.highlights, products.highlights),
      technologies = COALESCE(EXCLUDED.technologies, products.technologies),
      kits = COALESCE(EXCLUDED.kits, products.kits),
      addons = COALESCE(EXCLUDED.addons, products.addons),
      tech_specs = COALESCE(EXCLUDED.tech_specs, products.tech_specs),
      updated_at = NOW()
    `,
    [
      name,
      slug,
      tagline,
      description,
      hero_image,
      technologies_title,
      technologies_subtitle,
      highlights_title,
      highlights_subtitle,
      tech_overview,
      price,
      original_price,
      rating,
      reviews,
      image,
      category,
      is_best_seller,
      is_new,
      in_stock,
      features ? JSON.stringify(features) : null,
      delivery,
      level,
      instructor,
      duration,
      students,
      tags ? JSON.stringify(tags) : null,
      discount,
      video_preview,
      theme ? JSON.stringify(theme) : null,
      highlights ? JSON.stringify(highlights) : null,
      technologies ? JSON.stringify(technologies) : null,
      kits ? JSON.stringify(kits) : null,
      addons ? JSON.stringify(addons) : null,
      tech_specs ? JSON.stringify(tech_specs) : null,
    ]
  )


    const saved = await db.get<any>(`SELECT * FROM products WHERE slug = $1`, [slug])
    // Invalidate cache after write
  productsCache = null
  // clear per-slug cache if present
  try { (global as any).bySlugCache?.delete(slug) } catch {}
    // saved product (server-side)
    return NextResponse.json(saved, { status: 201 })
  } catch (err: any) {
    console.error('[API] POST /api/products error', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
