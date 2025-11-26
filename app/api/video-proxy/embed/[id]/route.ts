import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const primary = `https://api.aiskool.com/api/videos/embed/${encodeURIComponent(id)}`;
    const fallback = `http://216.48.182.5:5000/api/videos/embed/${encodeURIComponent(id)}`;

    let res: Response | null = null;
    let target = primary;
    try {
      res = await fetch(primary, { method: 'GET' });
      if (!res.ok) throw new Error('non-ok');
    } catch (err) {
      try {
        res = await fetch(fallback, { method: 'GET' });
        target = fallback;
      } catch (e) {
        console.error('video-proxy: fetch error', String(e));
        return NextResponse.json({ directUrl: null, embedUrl: primary });
      }
    }

    if (!res || !res.ok) {
      return NextResponse.json({ directUrl: null, embedUrl: target });
    }

    const text = await res.text();

    // Try to extract a direct video src from common patterns: <video src="..."> or <source src="...">
    const videoSrcMatch = text.match(/<video[^>]*>[\s\S]*?<source[^>]*src=["']([^"']+)["']/i) || text.match(/<video[^>]*src=["']([^"']+)["']/i);
    const mp4Match = text.match(/https?:\/\/[^"'<>]+\.(mp4|m3u8|webm)(?:\?[^"'<>]*)?/i);

    let direct: string | null = null;
    if (videoSrcMatch && videoSrcMatch[1]) direct = videoSrcMatch[1];
    else if (mp4Match && mp4Match[0]) direct = mp4Match[0];

    if (!direct) {
      // As a fallback, return the original embed URL so the client can choose to iframe it
      return NextResponse.json({ directUrl: null, embedUrl: target });
    }

    // Normalize relative URLs
    try {
      const u = new URL(direct, target).toString();
      return NextResponse.json({ directUrl: u });
    } catch (e) {
      return NextResponse.json({ directUrl: direct });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Server error', details: String(e) }, { status: 500 });
  }
}
