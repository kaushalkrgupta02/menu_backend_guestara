import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function verifyConnection(): Promise<void> {
  const client = await pool.connect();
  await client.query('SELECT 1');
  console.log('✓ Database connected successfully');
  client.release();
}

export default pool;