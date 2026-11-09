// Structural checks for the marketplace, so a broken manifest or skill fails CI
// instead of failing silently when someone installs the plugin.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (where, msg) => errors.push(`${relative(root, where) || where}: ${msg}`);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(path, `invalid JSON (${err.message})`);
    return undefined;
  }
}

function frontmatter(path) {
  const text = readFileSync(path, "utf8");
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) {
    fail(path, "missing YAML frontmatter");
    return {};
  }
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-z_-]+):\s*(.*)$/i.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) : []);

const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
const marketplace = readJson(marketplacePath);
let checked = 0;

for (const entry of marketplace?.plugins ?? []) {
  if (!entry.name || !entry.description || !entry.source) fail(marketplacePath, `plugin entry missing name, description or source`);
  if (typeof entry.source !== "string") continue; // external plugin (e.g. GitHub source)

  const dir = join(root, entry.source);
  const manifestPath = join(dir, ".claude-plugin", "plugin.json");
  if (!existsSync(manifestPath)) {
    fail(dir, "missing .claude-plugin/plugin.json");
    continue;
  }
  const manifest = readJson(manifestPath);
  if (manifest && manifest.name !== entry.name) fail(manifestPath, `name "${manifest.name}" != marketplace entry "${entry.name}"`);
  if (manifest && !/^\d+\.\d+\.\d+/.test(manifest.version ?? "")) fail(manifestPath, "version must be semver");

  for (const skill of dirs(join(dir, "skills"))) {
    const skillMd = join(dir, "skills", skill, "SKILL.md");
    if (!existsSync(skillMd)) {
      fail(join(dir, "skills", skill), "missing SKILL.md");
      continue;
    }
    const fm = frontmatter(skillMd);
    if (fm.name !== skill) fail(skillMd, `frontmatter name "${fm.name}" must match folder "${skill}"`);
    if (!fm.description || fm.description.length < 40) fail(skillMd, "description missing or too short to trigger reliably");
    if ((fm.description ?? "").length > 1024) fail(skillMd, "description over 1024 characters");
  }

  const agentsDir = join(dir, "agents");
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir).filter((f) => f.endsWith(".md"))) {
      const fm = frontmatter(join(agentsDir, f));
      if (!fm.name || !fm.description) fail(join(agentsDir, f), "agent needs name and description");
    }
  }

  const hooksPath = join(dir, "hooks", "hooks.json");
  if (existsSync(hooksPath)) {
    const hooks = readJson(hooksPath);
    for (const [event, groups] of Object.entries(hooks?.hooks ?? {})) {
      for (const g of groups) {
        for (const h of g.hooks ?? []) {
          const script = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+)/.exec(h.command ?? "")?.[1];
          if (script && !existsSync(join(dir, script))) fail(hooksPath, `${event} hook points at missing ${script}`);
        }
      }
    }
  }

  for (const c of dirs(join(dir, "evals")).filter((d) => d !== "results")) {
    const caseDir = join(dir, "evals", c);
    if (!existsSync(join(caseDir, "prompt.md"))) fail(caseDir, "eval case missing prompt.md");
    const graders = existsSync(join(caseDir, "graders")) ? readdirSync(join(caseDir, "graders")) : [];
    if (graders.length === 0) fail(caseDir, "eval case has no graders");
    for (const g of graders) {
      const type = frontmatter(join(caseDir, "graders", g)).type;
      if (!["regex", "tool_order", "tool_used", "file_exists", "llm", "baseline"].includes(type)) {
        fail(join(caseDir, "graders", g), `unknown grader type "${type}"`);
      }
    }
  }
  checked++;
}

if (errors.length > 0) {
  console.error(`✗ ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ marketplace and ${checked} local plugins look valid`);
