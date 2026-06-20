import 'dotenv/config';
import { Pool } from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'emergency_requests'
      ORDER BY ordinal_position
    `);
    console.log('emergency_requests columns:');
    console.table(res.rows);

    const amb = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'ambulances'
      ORDER BY ordinal_position
    `);
    console.log('\nambulances columns:');
    console.table(amb.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
