import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/__tests__/**/*.test.ts"],
    // Resolve .js extensions to .ts for ESM imports (TypeScript source)
    resolve: {
      extensions: [".ts", ".js"],
    },
  },
});
