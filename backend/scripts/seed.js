import { getConfig } from "../src/lib/config.js";
import { closePool } from "../src/lib/db.js";
import { seedDatabase } from "../src/lib/seed.js";

const MIN_PASSWORD_LENGTH = 8;

function requirePassword(name) {
  const value = process.env[name];
  if (!value || value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${name} wajib diisi, minimal ${MIN_PASSWORD_LENGTH} karakter. Lihat .env.example.`,
    );
  }
  return value;
}

try {
  getConfig();
  await seedDatabase({
    supervisorPassword: requirePassword("SEED_SUPERVISOR_PASSWORD"),
    operatorPassword: requirePassword("SEED_OPERATOR_PASSWORD"),
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
