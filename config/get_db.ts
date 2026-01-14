import 'dotenv/config';
import { Pool } from 'pg';


const pool = new Pool({
    host: process.env.PGHOST || 'localhost', 
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'admin',
    password: process.env.PGPASSWORD || 'admin123',
    database: process.env.PGDATABASE || 'guestara_backend',
    max: Number(process.env.PG_MAX_CLIENTS) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});


export async function verifyConnection(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        // connection OK
    } finally {
        client.release();
    }
}

export default pool;