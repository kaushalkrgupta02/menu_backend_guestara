import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PGHOST || 'localhost', // or the docker service name if connecting from another container
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
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

/**
 * Convenience wrapper for queries.
 */
export async function query<T = any>(text: string, params?: any[]) {
    return pool.query<T>(text, params);
}

export default pool;