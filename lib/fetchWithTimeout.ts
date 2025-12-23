async function _fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 10000
) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const gAny: any = globalThis as any
    const actualFetch: any = gAny.__originalFetch ?? (gAny.fetch?.bind ? gAny.fetch.bind(gAny) : gAny.fetch)
    return await actualFetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(id)
  }
}

export const fetchWithTimeout = _fetchWithTimeout;

// Patch server-side global fetch so existing server fetch(...) calls
// automatically get a timeout without editing every file. Do not
// patch in the browser (window is defined) to avoid changing client
// behavior.
if (typeof window === 'undefined') {
  const g: any = globalThis as any
  if (!g.__fetchWithTimeoutPatched) {
    const orig = g.fetch?.bind(g)
    g.fetch = (input: RequestInfo, init?: RequestInit) => _fetchWithTimeout(input, init || {}, 10000)
    // keep reference to original in case it's needed
    g.__originalFetch = orig
    g.__fetchWithTimeoutPatched = true
  }
}
