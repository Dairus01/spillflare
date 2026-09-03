import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
