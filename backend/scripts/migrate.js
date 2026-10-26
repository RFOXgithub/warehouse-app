import { getConfig } from "../src/lib/config.js";
import { closePool } from "../src/lib/db.js";
import { runMigrations } from "../src/lib/migrations.js";

try {
  getConfig();
  await runMigrations();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
