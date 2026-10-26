import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup/env.js", "tests/setup/hooks.js"],
    globalSetup: "tests/setup/global-setup.js",
    fileParallelism: false,
    testTimeout: 15000,
  },
});
