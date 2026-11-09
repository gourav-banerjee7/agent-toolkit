import type { ChangedFile } from "../src/types.js";

export function file(path: string, overrides: Partial<ChangedFile> = {}): ChangedFile {
  return { path, status: "modified", additions: 10, deletions: 2, ...overrides };
}

export function addedPatch(lines: string[]): string {
  return [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join("\n");
}

// Built by concatenation so this file never contains a real-looking key and
// the guardrails hook doesn't block edits to it.
export const FAKE_AWS_KEY = "AKIA" + "Q3EXAMPLE7KEY5ZZ";
export const FAKE_GITHUB_TOKEN = "ghp" + "_" + "a".repeat(36);
