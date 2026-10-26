import { useTestEnv } from "./test-env.js";
import { runMigrations } from "@/src/lib/migrations.js";
import { closePool } from "@/src/lib/db.js";

export default async function setup() {
  useTestEnv();
  await runMigrations({ log: () => {} });
  await closePool();
}
