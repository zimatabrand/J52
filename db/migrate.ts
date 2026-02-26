import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://j52:j52dev@localhost:5432/j52';

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Ensure migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await pool.query(
      'SELECT version FROM public.schema_migrations ORDER BY version'
    );
    const appliedVersions = new Set(applied.map(r => r.version));

    // Read migration files
    const migrationsDir = join(import.meta.dirname || __dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      const version = parseInt(file.split('_')[0], 10);
      if (appliedVersions.has(version)) {
        console.log(`  skip: ${file} (already applied)`);
        continue;
      }

      console.log(`  apply: ${file}`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      await pool.query(sql);
      count++;
    }

    if (count === 0) {
      console.log('Database is up to date.');
    } else {
      console.log(`Applied ${count} migration(s).`);
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

console.log('Running J52 database migrations...');
console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
migrate();
