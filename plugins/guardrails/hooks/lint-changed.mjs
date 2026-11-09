#!/usr/bin/env node
// PostToolUse hook: lint the file Claude just edited with the project's own linter.
// Problems go back to Claude (exit 2) so it fixes them in the same turn.
// If no linter is set up for that file type, it does nothing.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const MAX_OUTPUT = 4000;

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

/** Nearest ancestor of `start` that contains `marker`, stopping at `stop`. */
function findUp(start, marker, stop) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, marker))) return dir;
    const parent = dirname(dir);
    if (parent === dir || dir === stop) return undefined;
    dir = parent;
  }
}

function onPath(cmd) {
  try {
    execFileSync("command", ["-v", cmd], { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

/** Returns [command, args, cwd] for this file, or undefined when there is no linter to run. */
function linterFor(file, projectDir) {
  const ext = extname(file).toLowerCase();
  const dir = dirname(file);

  if ([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".vue", ".svelte"].includes(ext)) {
    const root = findUp(dir, join("node_modules", ".bin", "eslint"), projectDir);
    if (!root) return undefined;
    return [join(root, "node_modules", ".bin", "eslint"), ["--no-warn-ignored", file], root];
  }
  if (ext === ".py") {
    const venv = findUp(dir, join(".venv", "bin", "ruff"), projectDir);
    if (venv) return [join(venv, ".venv", "bin", "ruff"), ["check", "--quiet", file], venv];
    if (onPath("ruff")) return ["ruff", ["check", "--quiet", file], projectDir];
    return undefined;
  }
  if (ext === ".tf" && onPath("terraform")) return ["terraform", ["fmt", "-check", "-diff", file], dir];
  if (ext === ".go" && onPath("gofmt")) return ["gofmt", ["-l", "-d", file], dir];
  if ((ext === ".sh" || ext === ".bash") && onPath("shellcheck")) return ["shellcheck", [file], dir];
  return undefined;
}

const event = readInput();
const file = event.tool_input?.file_path;
if (typeof file !== "string" || !existsSync(file)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? process.cwd();
const linter = linterFor(file, projectDir);
if (!linter) process.exit(0);

const [cmd, args, cwd] = linter;
try {
  const out = execFileSync(cmd, args, { cwd, encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
  // gofmt -l exits 0 but prints the file name when it needs formatting.
  if (cmd === "gofmt" && out.trim()) throw Object.assign(new Error("needs gofmt"), { stdout: out, stderr: "" });
  process.exit(0);
} catch (err) {
  if (err.code === "ENOENT" || err.signal === "SIGTERM") process.exit(0); // linter missing or timed out: don't block
  let output = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  if (!output) process.exit(0);
  // ESLint v8 doesn't know --no-warn-ignored; retry without it.
  if (output.includes("--no-warn-ignored") && args[0] === "--no-warn-ignored") {
    try {
      execFileSync(cmd, args.slice(1), { cwd, encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
      process.exit(0);
    } catch (retry) {
      output = `${retry.stdout ?? ""}${retry.stderr ?? ""}`.trim();
      if (!output) process.exit(0);
    }
  }
  if (output.length > MAX_OUTPUT) output = `${output.slice(0, MAX_OUTPUT)}\n… (truncated)`;
  process.stderr.write(
    `guardrails: ${relative(projectDir, file) || file} has lint problems after this edit. Fix them before moving on:\n${output}\n`,
  );
  process.exit(2);
}
