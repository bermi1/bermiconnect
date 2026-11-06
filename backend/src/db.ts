import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

// numeric -> number, bigint (count) -> number
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)) as any);
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)) as any);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });
pool.on('error', (err) => logger.error({ err }, 'pg pool error'));

export type Db = pg.Pool | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query<T>(text, params as any[]);
  return r.rows;
}

export async function queryOne<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const r = await pool.query<T>(text, params as any[]);
  return r.rows[0] ?? null;
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
