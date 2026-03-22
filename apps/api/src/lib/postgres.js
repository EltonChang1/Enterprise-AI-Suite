import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

let pool;

export function hasPostgres() {
  return Boolean(config.postgres.connectionString);
}

export async function initPostgres() {
  if (!hasPostgres()) {
    return null;
  }
  if (pool) {
    return pool;
  }
  pool = new Pool({
    connectionString: config.postgres.connectionString,
    ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false
  });
  await pool.query("SELECT 1");
  return pool;
}

export function getPgPool() {
  return pool;
}
