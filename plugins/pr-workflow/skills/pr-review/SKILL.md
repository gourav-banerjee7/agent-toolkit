---
name: pr-review
description: Review a pull request or the current branch for real bugs, security holes, risky data changes and missing tests, ranked blocking / should-fix / nit, with every finding checked against the code. Use when the user asks to review a PR, check their changes before pushing, or look for bugs in a diff.
---

# pr-review

Find the problems that would hurt in production, prove each one from the code, and rank them.
A short review with three real findings beats a long one with twenty guesses.

## 1. Get the change and its risk

| Reviewing | Diff | Risk |
|---|---|---|
| An open PR | `gh pr diff <n>` and `gh pr view <n> --json title,body,baseRefName` | `gh pr diff <n> \| node <skill-dir>/../pr-risk/scripts/cli.js --diff-file -` |
| The current branch | `git diff <base>...HEAD` plus `git diff` for uncommitted work | `node <skill-dir>/../pr-risk/scripts/cli.js --base <base>` |
| A pasted diff | the user's message | write it to a temp file, then `node <skill-dir>/../pr-risk/scripts/cli.js --diff-file <file>` |

Read the PR description if there is one: review against what the author says the change should do.

## 2. Review in risk order

Start with the files pr-risk flagged, then the rest. For each changed file, read enough of the
surrounding code (callers, the function's full body, related tests) to judge behaviour, not just the hunk.

For PRs over ~800 changed lines, split the files into 2–4 groups by area and give each group to the
`pr-reviewer` agent in parallel, then merge and de-duplicate their findings yourself.

Check, in this order:

1. **Correctness** — wrong conditions, off-by-one, null/undefined paths, unhandled errors, wrong defaults, broken edge cases (empty, zero, max, timezone, unicode).
2. **Security** — injection (SQL, shell, template), missing authz checks on new endpoints, secrets in code or logs, unsafe deserialisation, SSRF, overly broad CORS or IAM.
3. **Data** — migrations that lock big tables, drop or rename columns still in use, aren't reversible, or backfill unbatched; changes that break existing rows.
4. **Concurrency and money** — races, missing idempotency on retries and webhooks, double-charge or double-send paths, transactions that span network calls.
5. **Contracts** — breaking API, event or schema changes without versioning; config or env vars added without defaults.
6. **Tests** — new behaviour without tests, deleted or skipped tests, tests that can't fail.
7. **Operability** — new failure paths with no log, metric or alert; noisy logging of PII.

Skip style points a formatter or linter would catch.

## 3. Verify before you report

For every candidate finding, confirm it from the code: find the caller, the guard that's missing,
the input that reaches the line. If you can't show how it fails, drop it or mark it as a question.

## 4. Write the review

```markdown
**Verdict:** <Approve | Approve with nits | Changes requested> — <n> blocking, <n> should-fix, <n> nits · risk: <level> (score N)

### 🔴 Blocking
1. **<short title>** — `path/to/file.ts:42`
   <what goes wrong, with the concrete input or sequence that triggers it>
   **Fix:** <specific change>

### 🟡 Should fix
...

### ⚪ Nits
...

### ✅ Looks good
<one or two lines on what is solid, only if true>
```

- 🔴 Blocking: will cause a bug, outage, data loss or security hole. 🟡 Should fix: real problem, lower impact.
  ⚪ Nit: optional.
- Leave out empty sections. Number findings so the author can reply "fixed 1, 3".
- If i-have-adhd is on in this session: keep the Verdict line first, then put **"Fix first:"** with the
  single most important change and its file:line, then the sections.

## 5. Deliver

Show the review to the user. Post to GitHub only when they ask:
- Summary comment: `gh pr review <n> --comment --body-file <file>`
- Request changes: `gh pr review <n> --request-changes --body-file <file>`

Never approve a PR on GitHub unless the user explicitly says to.
