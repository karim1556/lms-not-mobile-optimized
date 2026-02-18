'use client'

import { useEffect } from 'react'

export default function PlausibleProvider() {
  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const mod = await import('@plausible-analytics/tracker')
        const m = mod as any
        const plausibleFn = (m.default ?? m) as any
        if (mounted && typeof plausibleFn === 'function') {
          plausibleFn({ domain: 'aiskool.com' })
        }
      } catch (e) {
        // ignore load error
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  return null
}
