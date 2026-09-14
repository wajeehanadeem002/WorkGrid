import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "src/test/server-only.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    pool: "threads",
    maxWorkers: 1,
    isolate: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/lib/auth/context.ts",
        "src/lib/auth/clerk-email.ts",
        "src/lib/auth/permissions.ts",
        "src/lib/security/errors.ts",
        "src/lib/security/export.ts",
        "src/lib/security/identifiers.ts",
        "src/lib/security/pagination.ts",
        "src/lib/security/rate-limit.ts",
        "src/lib/security/server-proof.ts",
        "src/lib/security/uploads.ts",
        "src/lib/data/rpc.ts",
        "src/features/shared/schemas.ts",
      ],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 75,
        statements: 85,
      },
    },
  },
});
