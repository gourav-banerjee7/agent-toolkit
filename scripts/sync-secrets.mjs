// Copy the compiled secret patterns into the guardrails plugin, so the commit hook and the
// PR risk scorer always agree on what a secret looks like. Each plugin installs on its own,
// so they can't import each other at runtime.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "plugins/pr-workflow/skills/pr-risk/scripts/secrets.js");
const toDir = join(root, "plugins/guardrails/hooks/lib");

mkdirSync(toDir, { recursive: true });
copyFileSync(from, join(toDir, "secrets.js"));
writeFileSync(join(toDir, "package.json"), '{\n  "//": "secrets.js is copied from pr-risk/src by npm run build.",\n  "type": "module"\n}\n');
console.log("synced secret patterns -> plugins/guardrails/hooks/lib/secrets.js");
