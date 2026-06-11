import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Allow unit-testing server modules (webhook signature verification,
      // payout resolution) without a React Server runtime.
      "server-only": fileURLToPath(new URL("./lib/__tests__/helpers/server-only-stub.ts", import.meta.url)),
    },
  },
});
