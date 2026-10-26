import pg from "pg";
import { getConfig } from "./config.js";

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value);

export function getPool() {
  if (!globalThis.pgPool) {
    globalThis.pgPool = new Pool({
      connectionString: getConfig().databaseUrl,
      connectionTimeoutMillis: 5000,
    });
  }
  return globalThis.pgPool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (globalThis.pgPool) {
    await globalThis.pgPool.end();
    globalThis.pgPool = undefined;
  }
}

export function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => "\\" + char);
}
