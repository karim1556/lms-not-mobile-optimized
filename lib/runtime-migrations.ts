// Guarded one-time runtime migrations helper
const RUN_AT_RUNTIME = Boolean(process.env.RUNTIME_MIGRATIONS === '1' || process.env.NODE_ENV !== 'production');
let _oncePromise: Promise<void> | null = null;

export async function runOnce(name: string, fn: () => Promise<void>) {
  if (!RUN_AT_RUNTIME) return;
  if (!_oncePromise) {
    _oncePromise = (async () => {
      try {
        console.log(`runtime-migrations: running ${name}`)
        await fn()
        console.log(`runtime-migrations: ${name} done`)
      } catch (err) {
        // reset so next request can retry in dev
        _oncePromise = null
        console.error(`runtime-migrations: ${name} failed`, err)
        throw err
      }
    })()
  }
  return _oncePromise
}

export const enabled = RUN_AT_RUNTIME
