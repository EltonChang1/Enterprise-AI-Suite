import knex from "knex";
import { config } from "../config.js";

export async function runMigrations() {
  if (!config.postgres.connectionString) {
    return { ran: false, reason: "DATABASE_URL not configured" };
  }

  const db = knex({
    client: "pg",
    connection: config.postgres.connectionString,
    migrations: {
      directory: new URL("../../migrations", import.meta.url).pathname,
      extension: "js"
    }
  });

  try {
    const [batchNo, log] = await db.migrate.latest();
    return { ran: true, batchNo, log };
  } finally {
    await db.destroy();
  }
}
