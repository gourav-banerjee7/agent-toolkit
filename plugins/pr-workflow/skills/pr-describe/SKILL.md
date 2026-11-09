---
name: pr-describe
description: Write a pull request title and description from the actual diff and commits, including a risk line and how to test. Use when the user asks to write, draft, fill in or improve a PR description, open a PR, or summarise a branch for reviewers.
---

# pr-describe

Write a PR description a reviewer can act on in under a minute. Every claim must come from the
diff, the commits, or the user. Never invent test results, tickets, metrics or screenshots.

## 1. Gather the facts

Run these from the repo root. Use the PR's base branch if a PR exists (`gh pr view --json baseRefName`),
otherwise the repo's default branch.

```bash
git log --no-merges --format='%h %s%n%b' <base>..HEAD
git diff --stat <base>...HEAD
git diff <base>...HEAD
```

Also run the pr-risk scorer (it sits in the sibling skill: `<skill-dir>/../pr-risk/scripts/cli.js`).
It only needs Node, not git, when you give it a diff file:

| Source of the change | Command |
|---|---|
| This branch | `node <skill-dir>/../pr-risk/scripts/cli.js --base <base>` |
| An open PR | `gh pr diff <n> \| node <skill-dir>/../pr-risk/scripts/cli.js --diff-file -` |
| A diff the user pasted | Write it to a temp file, then `node <skill-dir>/../pr-risk/scripts/cli.js --diff-file <file>` |

Use its level and score in the Risk section exactly as printed. If it truly can't run (no Node),
say so in the Risk line rather than inventing a level.

Find a ticket key (e.g. `ABC-123`) in the branch name or commit messages. If there is none, leave it out.

If the diff is large, read the most important files in full rather than only the hunks, so you
describe behaviour, not line edits. Start with whatever pr-risk flagged.

## 2. Write it

Title: imperative, under 70 characters, with the ticket key if there is one.
Follow the repo's convention if recent PR titles use one (check `gh pr list --state merged -L 10`).

Body, in this order. Leave out any section that has nothing true to say.

```markdown
**TL;DR:** <one sentence: what changes for users or the system>

## Why
<the problem or goal, 1–3 lines; link the ticket>

## What changed
- <behaviour-level change, grouped by area, not file by file>

## How to test
1. <steps a reviewer can actually run, or the tests that cover it>

## Risk
<level> (score N) — <the top signals in plain words>. Rollback: <how, if risky>.
```

Keep it short. A small PR gets a short description. Put commands, paths and identifiers in backticks.

## 3. ADHD mode

If the i-have-adhd skill is on in this session (the user ran `/i-have-adhd` and has not said
"stop adhd mode"), reshape the body for the reviewer:

- First line is the reviewer's next action and the time it takes, using pr-risk's estimate:
  `**Review:** ⏱ ~15 min · start at \`db/migrations/0042.sql\``
- Replace "What changed" with a numbered **Review order**: one step per area, each with the file
  to open and the one thing to check there.
- Keep TL;DR, How to test and Risk. Drop Why to one line.

See `reference/example.md` for the same PR in both styles.

## 4. Deliver

Show the title and body to the user. Do not create or edit the PR yourself unless they ask.
When they ask, write the body to a temp file and use:

- New PR: `gh pr create --title "<title>" --body-file <file>`
- Existing PR: `gh pr edit <n> --title "<title>" --body-file <file>`
