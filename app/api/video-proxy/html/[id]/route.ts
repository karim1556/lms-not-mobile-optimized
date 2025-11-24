import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const targetOrigin = 'http://216.48.182.5:5000';
    const target = `${targetOrigin}/api/videos/embed/${encodeURIComponent(id)}`;

    let res;
    try {
      res = await fetch(target, { method: 'GET' });
    } catch (err) {
      console.error('video-proxy/html fetch error', err);
      return new Response('Failed to fetch embed page', { status: 502 });
    }

    if (!res.ok) {
      console.error('video-proxy/html non-ok', res.status);
      return new Response('Failed to fetch embed page', { status: 502 });
    }

    let text = await res.text();

    // Inject a <base> tag so relative URLs in the embed page resolve to the target origin
    try {
      if (/\<base[^>]*>/i.test(text) === false) {
        text = text.replace(/<head(.*?)>/i, (m) => `${m}<base href="${targetOrigin}/" />`);
      }

      // Inject lightweight CSS to center the player and ensure media elements fit the container
      const injectedCSS = `
        <style>
          html,body{height:100%;margin:0;background:#000!important}
          body{display:flex;align-items:center;justify-content:center}
          video, iframe, .video-player, .plyr__video-embed{max-width:100% !important;height:auto !important;display:block;margin:0 auto}
          .player, #player, .video-container, .plyr{max-width:100% !important;height:auto !important}
          /* force embedded iframes inside the proxied page to be responsive */
          iframe{width:100% !important;max-width:100% !important;height:auto !important;border:0}
        </style>
      `;

      // Inject CSS after head open (or before body if head not found)
      if (/<head[^>]*>/i.test(text)) {
        text = text.replace(/<head([^>]*)>/i, (m) => `${m}${injectedCSS}`);
      } else if (/<body[^>]*>/i.test(text)) {
        text = text.replace(/<body([^>]*)>/i, (m) => `${m}<head>${injectedCSS}</head>${m}`);
      } else {
        text = injectedCSS + text;
      }
    } catch (e) {
      // ignore injection failures
    }

    return new Response(text, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    console.error('video-proxy/html error', e);
    return new Response('Server error', { status: 500 });
  }
}
