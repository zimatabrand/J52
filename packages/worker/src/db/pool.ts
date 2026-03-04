import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool;

export async function initializeWorkerDb(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  pool = new Pool({
    connectionString: dbUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  // Test connection
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('Worker database connection verified');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('Worker database connection test failed (will retry on demand):', (err as Error).message);
  }
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Worker database not initialized');
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}
