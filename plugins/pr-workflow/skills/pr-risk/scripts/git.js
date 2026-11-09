import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseUnifiedDiff } from "./diff.js";
const MAX_UNTRACKED_BYTES = 512 * 1024;
function git(args, cwd) {
    return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}
function refExists(ref, cwd) {
    try {
        git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
        return true;
    }
    catch {
        return false;
    }
}
/** origin's default branch if known, else main/master, local or remote. */
export function detectBase(cwd) {
    try {
        const ref = git(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], cwd).trim();
        if (ref)
            return ref.replace("refs/remotes/", "");
    }
    catch {
        // no origin/HEAD; fall through
    }
    for (const candidate of ["origin/main", "origin/master", "main", "master"]) {
        if (refExists(candidate, cwd))
            return candidate;
    }
    throw new Error("pr-risk: could not find a base branch. Pass --base <ref>.");
}
/**
 * Everything this branch would put in a PR: committed changes since the merge-base,
 * plus uncommitted and untracked work, so it can be scored before pushing.
 */
export function collectLocalChanges(cwd, base) {
    if (!refExists(base, cwd))
        throw new Error(`pr-risk: base ref "${base}" not found.`);
    const mergeBase = git(["merge-base", base, "HEAD"], cwd).trim();
    const files = parseUnifiedDiff(git(["diff", "-M", "--no-color", "--no-ext-diff", mergeBase], cwd));
    const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"], cwd).split("\0").filter(Boolean);
    for (const path of untracked) {
        const full = join(cwd, path);
        if (statSync(full).size > MAX_UNTRACKED_BYTES) {
            files.push({ path, status: "added", additions: 0, deletions: 0 });
            continue;
        }
        const lines = readFileSync(full, "utf8").split("\n");
        if (lines.at(-1) === "")
            lines.pop();
        files.push({
            path,
            status: "added",
            additions: lines.length,
            deletions: 0,
            patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join("\n"),
        });
    }
    return files;
}
