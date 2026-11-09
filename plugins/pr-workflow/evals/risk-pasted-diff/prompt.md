---
max_turns: 12
allowed_tools: [Skill, Bash, Write, Read]
---

How risky is this PR? Should it get a second reviewer?

```diff
diff --git a/db/migrations/0042_drop_legacy_tokens.sql b/db/migrations/0042_drop_legacy_tokens.sql
new file mode 100644
--- /dev/null
+++ b/db/migrations/0042_drop_legacy_tokens.sql
@@ -0,0 +1,2 @@
+ALTER TABLE users DROP COLUMN legacy_token;
+DROP INDEX IF EXISTS users_legacy_token_idx;
diff --git a/src/auth/session.ts b/src/auth/session.ts
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -10,7 +10,6 @@ export async function resolveSession(req: Request) {
   const header = req.headers.get("authorization");
-  if (user.legacy_token && header === user.legacy_token) return user;
   return verifyJwt(header);
 }
diff --git a/src/auth/session.test.ts b/src/auth/session.test.ts
deleted file mode 100644
--- a/src/auth/session.test.ts
+++ /dev/null
@@ -1,4 +0,0 @@
-it("accepts legacy tokens", async () => {
-  const user = await seedUser({ legacy_token: "abc" });
-  expect(await resolveSession(req("abc"))).toEqual(user);
-});
```
