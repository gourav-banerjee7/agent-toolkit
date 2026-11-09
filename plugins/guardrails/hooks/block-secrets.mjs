#!/usr/bin/env node
// PreToolUse hook: stop Claude from writing a secret into a file or committing one.
// Exit 2 blocks the tool call and shows stderr to Claude so it can fix the problem.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ALLOW_MARKER, findSecret } from "./lib/secrets.js";

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

/** Text the tool is about to write, per tool. */
function textsToScan(toolName, input) {
  switch (toolName) {
    case "Write":
      return [input.content];
    case "Edit":
      return [input.new_string];
    case "MultiEdit":
      return (input.edits ?? []).map((e) => e.new_string);
    case "NotebookEdit":
      return [input.new_source];
    case "Bash":
      return [input.command];
    default:
      return [];
  }
}

function stagedAddedLines(cwd) {
  try {
    const diff = execFileSync("git", ["diff", "--cached", "--no-color", "--no-ext-diff", "-U0"], {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const hits = [];
    let file = "";
    for (const line of diff.split("\n")) {
      if (line.startsWith("+++ ")) file = line.slice(4).replace(/^b\//, "");
      else if (line.startsWith("+") && !line.startsWith("+++")) hits.push({ file, line: line.slice(1) });
    }
    return hits;
  } catch {
    return [];
  }
}

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

const event = readInput();
const toolName = event.tool_name ?? "";
const input = event.tool_input ?? {};
const target = input.file_path ?? input.notebook_path ?? "the command";

for (const text of textsToScan(toolName, input)) {
  if (typeof text !== "string") continue;
  for (const line of text.split("\n")) {
    const kind = findSecret(line);
    if (kind) {
      block(
        `guardrails: blocked — this looks like a ${kind} in ${target}.\n` +
          `Read it from an environment variable or secret manager instead.\n` +
          `If it is a fake value for tests or docs, add the comment "${ALLOW_MARKER}" on that line.`,
      );
    }
  }
}

if (toolName === "Bash" && /\bgit\b[^|;&]*\bcommit\b/.test(input.command ?? "")) {
  for (const { file, line } of stagedAddedLines(event.cwd ?? process.cwd())) {
    const kind = findSecret(line);
    if (kind) {
      block(
        `guardrails: blocked git commit — a staged change in ${file} looks like a ${kind}.\n` +
          `Unstage it (git restore --staged ${file}), move the value to an environment variable, and rotate it if it is real.`,
      );
    }
  }
}

process.exit(0);
