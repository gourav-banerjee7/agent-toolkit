---
name: pr-risk
description: Score how risky a pull request or the current branch is (critical, significant or routine) using transparent rules, not guesses. Use when the user asks how risky a change is, whether a PR needs extra review, what to look at first, or wants a PR labelled by risk. Also used by pr-describe and pr-review.
---

# pr-risk

Score a change with the bundled rule-based scorer, then explain the result. The scorer is the
same code the `pr-risk` GitHub Action runs, so the answer here matches the label the PR will get.

## Run the scorer

The scorer lives in `scripts/` next to this file. Use this skill's base directory for `<skill-dir>`.

Pick the input:

| Situation | Command |
|---|---|
| Current branch (committed, uncommitted and untracked work) | `node <skill-dir>/scripts/cli.js` |
| Different base branch | `node <skill-dir>/scripts/cli.js --base origin/develop` |
| An open PR by number | `gh pr diff <n> \| node <skill-dir>/scripts/cli.js --diff-file -` |
| A diff the user pasted | Write it to a temp file, then `node <skill-dir>/scripts/cli.js --diff-file <file>` |

Add `--json` when you need the numbers for something else, or `--markdown` for a PR comment.
If the repo has `.github/pr-risk.json`, the scorer picks it up automatically.

If the command fails because no base branch exists, ask which branch the PR targets. Do not guess.

## Report back

1. First line: the level, the score, and the review time, exactly as the scorer printed them.
2. Then each signal, in the scorer's order, with the files it lists.
3. Then **one** line on what to check first, taken from the highest-scoring signal. Examples:
   - migrations → "Check the migration runs without locking a large table and can be rolled back."
   - secret → "Remove the secret from the diff and rotate it; it is already in git history if committed."
   - tests removed → "Confirm the deleted tests are replaced or no longer needed."

Rules:
- Never change the level or score. If you think the rules got it wrong, say so on a separate line
  and suggest the `.github/pr-risk.json` change that would fix it (see `reference/config.md`).
- Do not label or comment on a GitHub PR unless the user asks. If they do, prefer the GitHub
  Action; for a one-off use `gh pr edit <n> --add-label "risk: <level>"`.
- If the i-have-adhd skill is on in this session, put the "check first" line at the top.
