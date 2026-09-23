import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@frontend": fileURLToPath(new URL("./apps/frontend", import.meta.url)),
      "@backend": fileURLToPath(new URL("./apps/backend/src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./packages/shared", import.meta.url)),
      "@domain": fileURLToPath(new URL("./packages/domain", import.meta.url)),
      "@ai": fileURLToPath(new URL("./packages/ai", import.meta.url)),
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
