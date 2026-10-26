let cached;

export function getConfig() {
  if (cached) return cached;

  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  const problems = [];
  if (!databaseUrl) problems.push("DATABASE_URL belum diisi");
  if (!jwtSecret) problems.push("JWT_SECRET belum diisi");
  else if (jwtSecret.length < 32)
    problems.push("JWT_SECRET minimal 32 karakter");

  if (problems.length > 0) {
    throw new Error(
      `Konfigurasi tidak valid: ${problems.join("; ")}. Lihat .env.example.`,
    );
  }

  cached = {
    databaseUrl,
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  };
  return cached;
}
