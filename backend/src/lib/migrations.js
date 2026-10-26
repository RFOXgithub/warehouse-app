import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.js";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);

const MIGRATION_LOCK_ID = 727001;

export async function runMigrations({ log = console.log } = {}) {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    varchar(255) PRIMARY KEY,
        applied_at timestamptz  NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query(
      "SELECT version FROM schema_migrations",
    );
    const applied = new Set(rows.map((row) => row.version));

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migrasi ${file} gagal: ${error.message}`);
      }
      log(`✔ ${file}`);
      count++;
    }

    log(
      count === 0
        ? "Database sudah up to date."
        : `${count} migrasi dijalankan.`,
    );
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID])
      .catch(() => {});
    client.release();
  }
}
