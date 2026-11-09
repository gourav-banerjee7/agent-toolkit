import { describe, expect, it } from "vitest";
import { runAction, type ActionInputs } from "../src/action.js";
import { COMMENT_MARKER } from "../src/format.js";
import type { Api } from "../src/github.js";

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

/** In-memory stand-in for the GitHub API that records every call. */
function fakeGitHub(opts: { files: unknown[]; labels?: string[]; comments?: Array<{ id: number; body: string }>; config?: string }) {
  const calls: Call[] = [];
  const api: Api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === "GET" && path.includes("/contents/")) {
      return opts.config
        ? { status: 200, data: { encoding: "base64", content: Buffer.from(opts.config).toString("base64") } }
        : { status: 404, data: { message: "Not Found" } };
    }
    if (method === "GET" && path.includes("/files")) return { status: 200, data: opts.files };
    if (method === "GET" && path.includes("/labels")) return { status: 200, data: (opts.labels ?? []).map((name) => ({ name })) };
    if (method === "GET" && path.includes("/comments")) return { status: 200, data: opts.comments ?? [] };
    if (method === "POST" && path.endsWith("/labels") && !path.includes("/issues/")) return { status: 422, data: { message: "already_exists" } };
    return { status: 200, data: {} };
  };
  return { api, calls };
}

const inputs: ActionInputs = {
  repo: "acme/shop",
  pull: 7,
  baseSha: "abc123",
  configPath: ".github/pr-risk.json",
  comment: true,
  label: true,
  failOn: "none",
};

const migrationFiles = [
  { filename: "db/migrations/9.sql", status: "added", additions: 5, deletions: 0 },
  { filename: "infra/main.tf", status: "modified", additions: 5, deletions: 1 },
];

describe("runAction", () => {
  it("labels the PR, swaps out stale risk labels, and creates one comment", async () => {
    const { api, calls } = fakeGitHub({ files: migrationFiles, labels: ["risk: routine", "bug"] });
    const { report, failed } = await runAction(api, inputs);

    expect(report.level).toBe("critical");
    expect(failed).toBe(false);
    expect(calls).toContainEqual({ method: "DELETE", path: "/repos/acme/shop/issues/7/labels/risk%3A%20routine", body: undefined });
    expect(calls).toContainEqual({ method: "POST", path: "/repos/acme/shop/issues/7/labels", body: { labels: ["risk: critical"] } });
    expect(calls.some((c) => c.method === "DELETE" && c.path.endsWith("/bug"))).toBe(false);

    const comment = calls.find((c) => c.method === "POST" && c.path.endsWith("/comments"));
    expect((comment!.body as { body: string }).body).toContain("Critical");
  });

  it("updates the existing comment instead of adding another", async () => {
    const { api, calls } = fakeGitHub({ files: migrationFiles, comments: [{ id: 99, body: `${COMMENT_MARKER}\nold` }] });
    await runAction(api, inputs);
    expect(calls.some((c) => c.method === "PATCH" && c.path === "/repos/acme/shop/issues/comments/99")).toBe(true);
    expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/comments"))).toBe(false);
  });

  it("reads config from the base commit, not the PR head", async () => {
    const config = JSON.stringify({ categories: [{ id: "database-migrations", points: 0 }, { id: "infrastructure", points: 0 }] });
    const { api, calls } = fakeGitHub({ files: migrationFiles, config });
    const { report } = await runAction(api, inputs);
    expect(report.level).toBe("routine");
    expect(calls[0]!.path).toBe("/repos/acme/shop/contents/.github/pr-risk.json?ref=abc123");
  });

  it("fails the check at or above fail-on", async () => {
    const { api } = fakeGitHub({ files: migrationFiles });
    expect((await runAction(api, { ...inputs, failOn: "significant" })).failed).toBe(true);
  });

  it("can skip labels and comments", async () => {
    const { api, calls } = fakeGitHub({ files: migrationFiles });
    await runAction(api, { ...inputs, label: false, comment: false });
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
});
