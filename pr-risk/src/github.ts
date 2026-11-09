import type { ChangedFile, FileStatus } from "./types.js";

export interface ApiResponse {
  status: number;
  data: unknown;
}

/** Tiny GitHub REST client on top of fetch, so the action ships with zero dependencies. */
export type Api = (method: string, path: string, body?: unknown) => Promise<ApiResponse>;

export function createApi(token: string, baseUrl = "https://api.github.com"): Api {
  return async (method, path, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "agent-toolkit-pr-risk",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON body; keep the text
    }
    return { status: res.status, data };
  };
}

async function ok(api: Api, method: string, path: string, body?: unknown, allowed: number[] = []): Promise<unknown> {
  const res = await api(method, path, body);
  if ((res.status >= 200 && res.status < 300) || allowed.includes(res.status)) return res.data;
  const message = (res.data as { message?: string } | null)?.message ?? String(res.data);
  throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${message}`);
}

interface ApiFile {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

const STATUS_MAP: Record<string, FileStatus> = {
  added: "added",
  removed: "removed",
  modified: "modified",
  renamed: "renamed",
  copied: "added",
  changed: "modified",
  unchanged: "modified",
};

export async function listPullFiles(api: Api, repo: string, pull: number): Promise<ChangedFile[]> {
  const files: ChangedFile[] = [];
  // GitHub caps this endpoint at 3000 files (30 pages of 100).
  for (let page = 1; page <= 30; page++) {
    const batch = (await ok(api, "GET", `/repos/${repo}/pulls/${pull}/files?per_page=100&page=${page}`)) as ApiFile[];
    for (const f of batch) {
      files.push({
        path: f.filename,
        previousPath: f.previous_filename,
        status: STATUS_MAP[f.status] ?? "modified",
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      });
    }
    if (batch.length < 100) break;
  }
  return files;
}

/** Read a file from a ref. Returns undefined when it does not exist. */
export async function readRepoFile(api: Api, repo: string, path: string, ref: string): Promise<string | undefined> {
  const res = await api("GET", `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`);
  if (res.status === 404) return undefined;
  if (res.status < 200 || res.status >= 300) throw new Error(`GitHub API could not read ${path}: ${res.status}`);
  const data = res.data as { content?: string; encoding?: string };
  if (data.encoding !== "base64" || typeof data.content !== "string") return undefined;
  return Buffer.from(data.content, "base64").toString("utf8");
}

export async function setRiskLabel(
  api: Api,
  repo: string,
  issue: number,
  label: { name: string; color: string; description: string },
  allRiskLabels: string[],
): Promise<void> {
  // Create the label if this repo doesn't have it yet. 422 = already exists.
  await ok(api, "POST", `/repos/${repo}/labels`, label, [422]);

  const current = (await ok(api, "GET", `/repos/${repo}/issues/${issue}/labels?per_page=100`)) as Array<{ name: string }>;
  for (const { name } of current) {
    if (allRiskLabels.includes(name) && name !== label.name) {
      await ok(api, "DELETE", `/repos/${repo}/issues/${issue}/labels/${encodeURIComponent(name)}`, undefined, [404]);
    }
  }
  if (!current.some((l) => l.name === label.name)) {
    await ok(api, "POST", `/repos/${repo}/issues/${issue}/labels`, { labels: [label.name] });
  }
}

/** Create the risk comment, or update it in place on later pushes so the PR keeps one comment. */
export async function upsertComment(api: Api, repo: string, issue: number, marker: string, body: string): Promise<"created" | "updated"> {
  for (let page = 1; page <= 20; page++) {
    const comments = (await ok(api, "GET", `/repos/${repo}/issues/${issue}/comments?per_page=100&page=${page}`)) as Array<{
      id: number;
      body?: string;
    }>;
    const mine = comments.find((c) => c.body?.startsWith(marker));
    if (mine) {
      await ok(api, "PATCH", `/repos/${repo}/issues/comments/${mine.id}`, { body });
      return "updated";
    }
    if (comments.length < 100) break;
  }
  await ok(api, "POST", `/repos/${repo}/issues/${issue}/comments`, { body });
  return "created";
}
