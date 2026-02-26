import pg from 'pg';
import { getDatabaseUrl } from '../services/secret-manager.js';

const { Pool } = pg;

let pool: pg.Pool;

export async function initializeDb(): Promise<void> {
  const dbUrl = getDatabaseUrl();

  // Cloud Run connects to Cloud SQL via Unix socket
  // Format: postgresql://user:pass@/dbname?host=/cloudsql/CONNECTION_NAME
  const instanceConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
  const poolConfig: pg.PoolConfig = instanceConnectionName
    ? {
        connectionString: dbUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      }
    : {
        connectionString: dbUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      };

  pool = new Pool(poolConfig);

  // Test connection - non-fatal in production (DB may not be reachable yet)
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('Database connection verified');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('Database connection test failed (will retry on demand):', (err as Error).message);
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
