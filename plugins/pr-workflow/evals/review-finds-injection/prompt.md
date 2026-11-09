---
max_turns: 14
allowed_tools: [Skill, Bash, Write, Read]
---

Review this PR before I merge it.

```diff
diff --git a/src/routes/admin.ts b/src/routes/admin.ts
new file mode 100644
--- /dev/null
+++ b/src/routes/admin.ts
@@ -0,0 +1,22 @@
+import { Router } from "express";
+import { db } from "../db";
+
+export const admin = Router();
+
+// Search workers by name for the support dashboard.
+admin.get("/workers", async (req, res) => {
+  const name = String(req.query.name ?? "");
+  const rows = await db.query(
+    `SELECT id, name, email, phone FROM workers WHERE name ILIKE '%${name}%' LIMIT 50`,
+  );
+  res.json(rows);
+});
+
+admin.post("/workers/:id/deactivate", async (req, res) => {
+  await db.query("UPDATE workers SET active = false WHERE id = $1", [req.params.id]);
+  res.status(204).end();
+});
diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -12,4 +12,5 @@ app.use("/api", requireUser, api);
+app.use("/admin", admin);
 app.listen(port);
```
