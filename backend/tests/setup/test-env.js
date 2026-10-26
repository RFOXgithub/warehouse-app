export function useTestEnv() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    fail("TEST_DATABASE_URL belum diisi di backend/.env.local.");
  }
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    fail(
      `TEST_DATABASE_URL harus menunjuk ke database berakhiran _test, bukan "${databaseName}".`,
    );
  }

  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET = "jwt-secret-khusus-test-minimal-32-karakter";
  process.env.JWT_EXPIRES_IN = "8h";
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  throw new Error(message);
}
