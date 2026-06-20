/**
 * fix-schema.ts — Alter patient_id and driver_id columns from UUID to TEXT
 * to be compatible with Better Auth's alphanumeric user IDs.
 *
 * Run: npx ts-node --transpile-only src/fix-schema.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fix() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing schema...\n');

    // Drop FK constraints first, then alter types, then re-add
    await client.query('BEGIN');

    // ── emergency_requests.patient_id UUID → TEXT ────────────────────────────
    console.log('1. Fixing emergency_requests.patient_id...');
    // Drop the FK constraint on patient_id (if exists)
    const fkRes = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'emergency_requests'
        AND constraint_type = 'FOREIGN KEY'
    `);
    for (const row of fkRes.rows) {
      await client.query(`ALTER TABLE emergency_requests DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
      console.log(`   Dropped FK: ${row.constraint_name}`);
    }
    // Change column type: UUID → TEXT (USING casts uuid to text)
    await client.query(`
      ALTER TABLE emergency_requests
        ALTER COLUMN patient_id TYPE TEXT USING patient_id::TEXT
    `);
    // Re-add FK to the Better Auth "user" table
    await client.query(`
      ALTER TABLE emergency_requests
        ADD CONSTRAINT emergency_requests_patient_id_fkey
        FOREIGN KEY (patient_id) REFERENCES "user"(id) ON DELETE CASCADE
    `);
    console.log('   ✅ patient_id is now TEXT\n');

    // ── ambulances.driver_id UUID → TEXT ────────────────────────────────────
    console.log('2. Fixing ambulances.driver_id...');
    const ambFkRes = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'ambulances'
        AND constraint_type = 'FOREIGN KEY'
    `);
    for (const row of ambFkRes.rows) {
      await client.query(`ALTER TABLE ambulances DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
      console.log(`   Dropped FK: ${row.constraint_name}`);
    }
    await client.query(`
      ALTER TABLE ambulances
        ALTER COLUMN driver_id TYPE TEXT USING driver_id::TEXT
    `);
    // driver_id is nullable — only add FK if you want to enforce it
    await client.query(`
      ALTER TABLE ambulances
        ADD CONSTRAINT ambulances_driver_id_fkey
        FOREIGN KEY (driver_id) REFERENCES "user"(id) ON DELETE SET NULL
    `);
    console.log('   ✅ driver_id is now TEXT\n');

    await client.query('COMMIT');
    console.log('🎉 Schema fixed! Restart the backend: npm run dev');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Fix failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(() => process.exit(1));
