import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const HOOKS = join(import.meta.dirname, "..", "plugins", "guardrails", "hooks");
const FAKE_AWS_KEY = "AKIA" + "Q3EXAMPLE7KEY5ZZ";
const FAKE_PRIVATE_KEY = "-----BEGIN RSA " + "PRIVATE KEY-----";

function runHook(script: string, event: object, env: NodeJS.ProcessEnv = {}) {
  const res = spawnSync("node", [join(HOOKS, script)], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: res.status, stderr: res.stderr };
}

describe("block-secrets", () => {
  it("allows normal writes", () => {
    const r = runHook("block-secrets.mjs", { tool_name: "Write", tool_input: { file_path: "a.ts", content: "const x = process.env.KEY;" } });
    expect(r.code).toBe(0);
  });

  it("blocks a Write containing an AWS key", () => {
    const r = runHook("block-secrets.mjs", { tool_name: "Write", tool_input: { file_path: "a.ts", content: `const k = "${FAKE_AWS_KEY}";` } });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("AWS access key ID");
    expect(r.stderr).toContain("a.ts");
  });

  it("blocks an Edit and a MultiEdit", () => {
    expect(runHook("block-secrets.mjs", { tool_name: "Edit", tool_input: { file_path: "k.pem", new_string: FAKE_PRIVATE_KEY } }).code).toBe(2);
    expect(
      runHook("block-secrets.mjs", {
        tool_name: "MultiEdit",
        tool_input: { file_path: "a.ts", edits: [{ new_string: "ok" }, { new_string: FAKE_AWS_KEY }] },
      }).code,
    ).toBe(2);
  });

  it("respects the allow marker", () => {
    const r = runHook("block-secrets.mjs", {
      tool_name: "Write",
      tool_input: { file_path: "a.test.ts", content: `"${FAKE_AWS_KEY}" // secret-scan:allow` },
    });
    expect(r.code).toBe(0);
  });

  it("blocks a Bash command that echoes a secret", () => {
    const r = runHook("block-secrets.mjs", { tool_name: "Bash", tool_input: { command: `echo ${FAKE_AWS_KEY} >> .env` } });
    expect(r.code).toBe(2);
  });

  describe("git commit", () => {
    const repo = mkdtempSync(join(tmpdir(), "guardrails-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    it("allows a commit with clean staged changes", () => {
      writeFileSync(join(repo, "ok.ts"), "export const a = 1;\n");
      git("add", "ok.ts");
      expect(runHook("block-secrets.mjs", { tool_name: "Bash", cwd: repo, tool_input: { command: "git commit -m ok" } }).code).toBe(0);
    });

    it("blocks a commit when a staged file has a secret", () => {
      writeFileSync(join(repo, "config.ts"), `export const key = "${FAKE_AWS_KEY}";\n`);
      git("add", "config.ts");
      const r = runHook("block-secrets.mjs", { tool_name: "Bash", cwd: repo, tool_input: { command: "git add . && git commit -m wip" } });
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("config.ts");
    });
  });
});

describe("lint-changed", () => {
  it("does nothing for a file type with no linter", () => {
    const dir = mkdtempSync(join(tmpdir(), "lint-"));
    const f = join(dir, "notes.xyz");
    writeFileSync(f, "anything");
    expect(runHook("lint-changed.mjs", { tool_name: "Write", cwd: dir, tool_input: { file_path: f } }).code).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does nothing when the file is gone", () => {
    expect(runHook("lint-changed.mjs", { tool_name: "Write", tool_input: { file_path: "/nope/missing.ts" } }).code).toBe(0);
  });

  const hasTerraform = spawnSync("terraform", ["version"]).status === 0;
  it.skipIf(!hasTerraform)("reports unformatted Terraform back to Claude", () => {
    const dir = mkdtempSync(join(tmpdir(), "lint-"));
    const f = join(dir, "main.tf");
    writeFileSync(f, 'variable "x" {\ntype=string\n}\n');
    const r = runHook("lint-changed.mjs", { tool_name: "Write", cwd: dir, tool_input: { file_path: f } }, { CLAUDE_PROJECT_DIR: dir });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("lint problems");

    writeFileSync(f, 'variable "x" {\n  type = string\n}\n');
    expect(runHook("lint-changed.mjs", { tool_name: "Write", cwd: dir, tool_input: { file_path: f } }, { CLAUDE_PROJECT_DIR: dir }).code).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
