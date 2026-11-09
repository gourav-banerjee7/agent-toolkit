import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["pr-risk/test/**/*.test.ts", "tests/**/*.test.ts"],
    globals: false,
  },
});
