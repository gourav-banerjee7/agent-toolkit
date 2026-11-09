import { describe, expect, it } from "vitest";
import { matchesGlob } from "../src/glob.js";

describe("matchesGlob", () => {
  it.each([
    ["db/migrations/004_add_index.sql", "**/migrations/**", true],
    ["migrations/001.sql", "**/migrations/**", true],
    ["src/migrationsHelper.ts", "**/migrations/**", false],
    ["services/api/Dockerfile", "Dockerfile", true],
    ["Dockerfile.dev", "Dockerfile", false],
    [".github/workflows/ci.yml", ".github/workflows/**", true],
    ["infra/main.tf", "**/*.tf", true],
    ["main.tf", "**/*.tf", true],
    ["api/openapi.yaml", "**/openapi*.{yml,yaml,json}", true],
    ["api/openapi.v2.json", "**/openapi*.{yml,yaml,json}", true],
    ["src/auth/login.ts", "**/{auth,oauth}/**", true],
    ["src/author/profile.ts", "**/{auth,oauth}/**", false],
    ["src/user-auth.service.ts", "**/*{-,_,.}{auth,jwt}{.,-,_}*", true],
    ["src/author.ts", "**/*{-,_,.}{auth,jwt}{.,-,_}*", false],
    ["web/package.json", "package.json", true],
  ])("%s vs %s -> %s", (path, pattern, expected) => {
    expect(matchesGlob(path, pattern)).toBe(expected);
  });
});
