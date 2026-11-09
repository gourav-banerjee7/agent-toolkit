import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "../src/diff.js";

const DIFF = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 import x from "x";
-const a = 1;
+const a = 2;
+const b = 3;
diff --git a/db/migrations/002.sql b/db/migrations/002.sql
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/db/migrations/002.sql
@@ -0,0 +1,2 @@
+ALTER TABLE users
+  ADD COLUMN mfa boolean;
diff --git a/tests/old.test.ts b/tests/old.test.ts
deleted file mode 100644
index 4444444..0000000
--- a/tests/old.test.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-it("works", () => {});
-// --- not a header
diff --git a/src/auth/a.ts b/src/session/a.ts
similarity index 90%
rename from src/auth/a.ts
rename to src/session/a.ts
index 5555555..6666666 100644
--- a/src/auth/a.ts
+++ b/src/session/a.ts
@@ -1 +1 @@
-export const x = 1;
+export const x = 2;
diff --git a/logo.png b/logo.png
index 7777777..8888888 100644
Binary files a/logo.png and b/logo.png differ
`;

describe("parseUnifiedDiff", () => {
  const files = parseUnifiedDiff(DIFF);

  it("finds every file", () => {
    expect(files.map((f) => f.path)).toEqual(["src/app.ts", "db/migrations/002.sql", "tests/old.test.ts", "src/session/a.ts", "logo.png"]);
  });

  it("counts additions and deletions", () => {
    expect(files[0]).toMatchObject({ status: "modified", additions: 2, deletions: 1 });
  });

  it("detects added and removed files", () => {
    expect(files[1]).toMatchObject({ status: "added", additions: 2, deletions: 0 });
    expect(files[2]).toMatchObject({ status: "removed", additions: 0, deletions: 2 });
  });

  it("does not mistake a removed line starting with --- for a header", () => {
    expect(files[2]!.path).toBe("tests/old.test.ts");
  });

  it("tracks renames", () => {
    expect(files[3]).toMatchObject({ status: "renamed", previousPath: "src/auth/a.ts", additions: 1, deletions: 1 });
  });

  it("keeps binary files with no patch", () => {
    expect(files[4]).toMatchObject({ path: "logo.png", additions: 0, deletions: 0 });
    expect(files[4]!.patch).toBeUndefined();
  });
});
