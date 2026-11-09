#!/usr/bin/env node
/**
 * pr-risk CLI: score the current branch (or a diff file) the same way the GitHub Action does.
 *
 *   node cli.js                      # current branch vs origin's default branch, incl. uncommitted work
 *   node cli.js --base develop       # explicit base
 *   node cli.js --diff-file pr.diff  # score a saved diff ("-" reads stdin)
 *   node cli.js --json | --markdown  # machine-readable or PR-comment output
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadConfigFile } from "./config.js";
import { parseUnifiedDiff } from "./diff.js";
import { toMarkdown, toText } from "./format.js";
import { collectLocalChanges, detectBase } from "./git.js";
import { scorePullRequest } from "./score.js";
function main() {
    const { values } = parseArgs({
        options: {
            base: { type: "string" },
            "diff-file": { type: "string" },
            config: { type: "string" },
            cwd: { type: "string" },
            json: { type: "boolean", default: false },
            markdown: { type: "boolean", default: false },
            help: { type: "boolean", short: "h", default: false },
        },
        strict: true,
    });
    if (values.help) {
        process.stdout.write("Usage: pr-risk [--base <ref>] [--diff-file <path|->] [--config <path>] [--cwd <dir>] [--json|--markdown]\n");
        return 0;
    }
    const cwd = values.cwd ?? process.cwd();
    const config = loadConfigFile(values.config ?? join(cwd, ".github", "pr-risk.json"));
    let files;
    if (values["diff-file"]) {
        const text = values["diff-file"] === "-" ? readFileSync(0, "utf8") : readFileSync(values["diff-file"], "utf8");
        files = parseUnifiedDiff(text);
    }
    else {
        files = collectLocalChanges(cwd, values.base ?? detectBase(cwd));
    }
    const report = scorePullRequest(files, config);
    if (values.json)
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else if (values.markdown)
        process.stdout.write(toMarkdown(report) + "\n");
    else
        process.stdout.write(toText(report) + "\n");
    return 0;
}
try {
    process.exitCode = main();
}
catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
}
