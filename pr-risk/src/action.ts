/**
 * GitHub Action entry point. Reads the PR's changed files through the API (it never
 * checks out or runs PR code), scores them, then labels the PR and posts one comment.
 * Safe to run on `pull_request_target`, so fork PRs get labelled too.
 */
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { mergeConfig, parseOverrides } from "./config.js";
import { ALL_LABELS, COMMENT_MARKER, LEVEL_META, toMarkdown } from "./format.js";
import { createApi, listPullFiles, readRepoFile, setRiskLabel, upsertComment, type Api } from "./github.js";
import { scorePullRequest } from "./score.js";
import type { Report, RiskLevel } from "./types.js";

export interface ActionInputs {
  repo: string;
  pull: number;
  baseSha: string;
  configPath: string;
  comment: boolean;
  label: boolean;
  failOn: RiskLevel | "none";
}

export interface ActionResult {
  report: Report;
  failed: boolean;
}

const RANK: Record<RiskLevel, number> = { routine: 0, significant: 1, critical: 2 };

export async function runAction(api: Api, inputs: ActionInputs, log: (msg: string) => void = () => {}): Promise<ActionResult> {
  const configText = await readRepoFile(api, inputs.repo, inputs.configPath, inputs.baseSha);
  const config = mergeConfig(configText ? parseOverrides(configText, inputs.configPath) : {});
  log(configText ? `Using config from ${inputs.configPath} on the base branch.` : "Using default config.");

  const files = await listPullFiles(api, inputs.repo, inputs.pull);
  const report = scorePullRequest(files, config);
  const meta = LEVEL_META[report.level];
  log(`${meta.emoji} ${meta.title} — score ${report.score} across ${files.length} files.`);

  if (inputs.label) {
    await setRiskLabel(
      api,
      inputs.repo,
      inputs.pull,
      { name: meta.label, color: meta.color, description: `pr-risk: ${meta.advice}` },
      ALL_LABELS,
    );
  }
  if (inputs.comment) {
    const how = await upsertComment(api, inputs.repo, inputs.pull, COMMENT_MARKER, toMarkdown(report));
    log(`Risk comment ${how}.`);
  }

  const failed = inputs.failOn !== "none" && RANK[report.level] >= RANK[inputs.failOn];
  return { report, failed };
}

function readInputs(env: NodeJS.ProcessEnv): ActionInputs & { token: string } {
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is not set; run this inside GitHub Actions.");
  const event = JSON.parse(readFileSync(eventPath, "utf8")) as {
    pull_request?: { number: number; base: { sha: string } };
  };
  if (!event.pull_request) throw new Error("pr-risk only runs on pull_request or pull_request_target events.");

  const token = env.INPUT_GITHUB_TOKEN ?? "";
  if (!token) throw new Error("github-token input is empty.");
  const failOn = (env.INPUT_FAIL_ON ?? "none").trim() as ActionInputs["failOn"];
  if (!["none", "significant", "critical"].includes(failOn)) throw new Error(`fail-on must be none, significant or critical, got "${failOn}".`);

  return {
    token,
    repo: env.GITHUB_REPOSITORY ?? "",
    pull: event.pull_request.number,
    baseSha: event.pull_request.base.sha,
    configPath: env.INPUT_CONFIG_PATH || ".github/pr-risk.json",
    comment: (env.INPUT_COMMENT ?? "true") !== "false",
    label: (env.INPUT_LABEL ?? "true") !== "false",
    failOn,
  };
}

async function main(): Promise<void> {
  const inputs = readInputs(process.env);
  const { report, failed } = await runAction(createApi(inputs.token, process.env.GITHUB_API_URL), inputs, (m) => console.log(m));

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `level=${report.level}\nscore=${report.score}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, toMarkdown(report) + "\n");
  }
  if (failed) {
    console.log(`::error::PR risk is ${report.level}, at or above fail-on=${inputs.failOn}.`);
    process.exitCode = 1;
  }
}

// Only run when executed directly, so tests can import runAction.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((err: Error) => {
    console.log(`::error::${err.message}`);
    process.exitCode = 1;
  });
}
