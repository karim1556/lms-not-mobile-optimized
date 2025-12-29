import postgres from 'postgres';

// Define the interface for our database operations for better compatibility.
export interface Database {
  get<T>(query: string, params?: any[]): Promise<T | null>;
  all<T>(query: string, params?: any[]): Promise<T[]>;
  run(query: string, params?: any[]): Promise<void>;
}

// The 'postgres' library automatically handles connection pooling.
// We create a single, shared instance of the client when a connection string is provided.
const connectionString = process.env.POSTGRES_URL;
let _sqlInternal: ReturnType<typeof postgres> | null = null;
let dbInitError: Error | null = null;
try {
    if (connectionString) {
    _sqlInternal = postgres(connectionString, {
      prepare: false,
      ssl: 'require',
      max: 5,               // limit pool size to avoid local exhaustion
      idle_timeout: 20,     // seconds
      connect_timeout: 10,  // seconds
    });
    console.log('Postgres client initialized.');
  } else {
    dbInitError = new Error('POSTGRES_URL environment variable is not set.');
    console.warn('[DB] POSTGRES_URL not set. API routes will return 500 with an informative error.');
  }
} catch (err: any) {
  dbInitError = err instanceof Error ? err : new Error(String(err));
}

// Simple retry wrapper for transient errors
async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const code = err?.code
      // retry on common transient conditions
      const transient = code === 'XX000' /* pool timeout */
        || code === '57014' /* statement timeout */
        || code === '57P01' /* admin shutdown */
        || code === 'ECONNRESET'
        || /timeout/i.test(String(err?.message || ''))
      if (!transient || i === attempts - 1) throw err
      // small backoff
      await new Promise((r) => setTimeout(r, 250 * (i + 1)))
    }
  }
  throw lastErr
}

// This is our singleton database object.
const db: Database = {
  async get<T>(query: string, params: any[] = []): Promise<T | null> {
    if (dbInitError) throw dbInitError
    if (!_sqlInternal) throw new Error('Database client is not initialized.')
    const safeParams = params.map(p => p === undefined ? null : p)
    if (params.some(p => p === undefined)) {
      console.warn('[DB] Replacing undefined query parameter(s) with null for query:', query, safeParams)
    }
    const rows = await withRetry(() => _sqlInternal!.unsafe(query, safeParams))
    return (rows[0] as unknown as T) || null
  },
  async all<T>(query: string, params: any[] = []): Promise<T[]> {
    if (dbInitError) throw dbInitError
    if (!_sqlInternal) throw new Error('Database client is not initialized.')
    const safeParams = params.map(p => p === undefined ? null : p)
    if (params.some(p => p === undefined)) {
      console.warn('[DB] Replacing undefined query parameter(s) with null for query:', query, safeParams)
    }
    const rows = await withRetry(() => _sqlInternal!.unsafe(query, safeParams))
    return rows as unknown as T[]
  },
  async run(query: string, params: any[] = []): Promise<void> {
    if (dbInitError) throw dbInitError
    if (!_sqlInternal) throw new Error('Database client is not initialized.')
    const safeParams = params.map(p => p === undefined ? null : p)
    if (params.some(p => p === undefined)) {
      console.warn('[DB] Replacing undefined query parameter(s) with null for query:', query, safeParams)
    }
    await withRetry(() => _sqlInternal!.unsafe(query, safeParams))
  },
};

/**
 * Returns a shared instance of the database connection.
 * In a serverless environment, this allows connection reuse across function invocations.
 */
export function getDb(): Database {
  return db;
}

/**
 * Returns the current DB initialization status so API routes can give clearer
 * error messages instead of generic 500s when the DB client isn't configured.
 */
export function dbStatus() {
  return {
    ready: !_sqlInternal ? false : true,
    error: dbInitError ? String(dbInitError.message || dbInitError) : null,
  };
}

// Export the raw sql client for transactions or advanced features.
// Provide a concrete typed export based on the `postgres` factory return type so
// call sites (sql.begin, tagged templates, trx callbacks) receive proper types
// instead of implicit `any` in strict mode.
type PostgresClient = ReturnType<typeof postgres>;
// We cast here so TypeScript has the correct shape at compile time. At runtime,
// if the client wasn't initialized (no POSTGRES_URL), attempts to use `sql` will
// throw from the underlying `_sqlInternal` usage elsewhere. This keeps ergonomics
// for existing code while restoring type-safety for transactions and template tags.
export const sql = (_sqlInternal as unknown) as PostgresClient;

// Note: There is no closeDb function. The 'postgres' library manages the connection
// lifecycle automatically. You do not need to manually close the connection.