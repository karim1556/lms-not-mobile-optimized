export const runtime = 'nodejs'

import '@/lib/fetchWithTimeout'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { NextResponse } from 'next/server'

const HMAC_SECRET = process.env.MEDIA_HMAC_SECRET || 'dev_media_secret'

function verifyToken(token: string) {
  try {
    const [b64, sig] = token.split('.')
    if (!b64 || !sig) return null
    const dataJson = Buffer.from(b64, 'base64url').toString()
    const expected = crypto.createHmac('sha256', HMAC_SECRET).update(dataJson).digest('base64url')
    // timingSafeEqual requires Buffers of same length
    if (sig.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const data = JSON.parse(dataJson)
    if (!data.exp || Math.floor(Date.now() / 1000) > data.exp) return null
    return data as { path: string; exp: number; userId?: string }
  } catch (e) {
    return null
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return new Response('Unauthorized or expired', { status: 401 })

  // Map to protected-videos directory. Sanitize path to prevent traversal.
  const safeBase = path.join(process.cwd(), 'protected-videos')
  const requested = path.normalize(String(payload.path))
  if (requested.startsWith('..')) return new Response('Forbidden', { status: 403 })

  const filePath = path.join(safeBase, requested)
  if (!fs.existsSync(filePath)) return new Response('Not found', { status: 404 })

  const stat = fs.statSync(filePath)
  const fileSize = stat.size

  const range = req.headers.get('range')
  const contentType = mimeTypeFromName(filePath) || 'application/octet-stream'

  const headers = new Headers()
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Type', contentType)
  // Don't let proxies cache the private stream
  headers.set('Cache-Control', 'private, no-store, max-age=0')

  if (!range) {
    headers.set('Content-Length', String(fileSize))
    const stream = fs.createReadStream(filePath)
    return new Response(stream as any, { status: 200, headers })
  }

  // Parse range header
  const m = /bytes=(\d+)-(\d+)?/.exec(range)
  if (!m) return new Response('Range Not Satisfiable', { status: 416 })
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : fileSize - 1
  if (start >= fileSize || end >= fileSize) return new Response('Range Not Satisfiable', { status: 416 })

  const chunkSize = end - start + 1
  headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`)
  headers.set('Content-Length', String(chunkSize))

  const stream = fs.createReadStream(filePath, { start, end })
  return new Response(stream as any, { status: 206, headers })
}

function mimeTypeFromName(name: string) {
  const ext = path.extname(name).toLowerCase()
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogg' || ext === '.ogv') return 'video/ogg'
  if (ext === '.mov' || ext === '.qt') return 'video/quicktime'
  return null
}
