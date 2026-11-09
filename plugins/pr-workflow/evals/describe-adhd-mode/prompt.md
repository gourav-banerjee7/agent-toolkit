---
max_turns: 12
allowed_tools: [Skill, Bash, Write, Read]
---

I have ADHD mode on (I ran /i-have-adhd earlier). Write the PR description for this so my reviewer knows exactly where to start. Just the text, don't open a PR.

```diff
diff --git a/infra/alb.tf b/infra/alb.tf
--- a/infra/alb.tf
+++ b/infra/alb.tf
@@ -20,7 +20,7 @@ resource "aws_lb_target_group" "api" {
   health_check {
-    path                = "/"
-    interval            = 30
+    path                = "/healthz"
+    interval            = 10
     healthy_threshold   = 2
   }
 }
diff --git a/src/server.ts b/src/server.ts
--- a/src/server.ts
+++ b/src/server.ts
@@ -40,6 +40,11 @@ app.use(express.json());
+app.get("/healthz", async (_req, res) => {
+  const dbOk = await db.ping().then(() => true, () => false);
+  res.status(dbOk ? 200 : 503).json({ db: dbOk });
+});
+
 app.use("/api", routes);
```
