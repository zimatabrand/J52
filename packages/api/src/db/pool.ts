import pg from 'pg';
import { getDatabaseUrl } from '../services/secret-manager.js';

const { Pool } = pg;

let pool: pg.Pool;

export async function initializeDb(): Promise<void> {
  pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}
