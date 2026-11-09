# pr-risk

Labels every pull request **critical**, **significant** or **routine** and posts one comment
saying why. It uses transparent rules, not an LLM, so it is free, needs no API key, gives the same
answer every time, and you can read exactly why a PR scored what it did.

The same scorer runs in three places, so they always agree:

- this GitHub Action
- the `pr-risk` Claude Code skill, which reads its output and explains it
- the `pr-describe` and `pr-review` skills, which use it to write the risk line and decide what to review first

## Use it

```yaml
# .github/workflows/pr-risk.yml
name: PR risk
on:
  pull_request_target:
    types: [opened, synchronize, reopened, ready_for_review]
permissions:
  contents: read
  pull-requests: write
  issues: write
jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: gourav-banerjee7/agent-toolkit/pr-risk@main
        # with:
        #   fail-on: critical    # make critical PRs fail the check
        #   comment: "false"     # labels only
```

`pull_request_target` lets fork PRs get labelled. It is safe here because the action reads the PR
through the API and never checks out or runs the PR's code. Config is read from the **base** branch,
so a PR can't lower its own score.

| Input | Default | |
|---|---|---|
| `github-token` | `github.token` | needs `pull-requests: write` and `issues: write` |
| `config-path` | `.github/pr-risk.json` | your own paths and weights |
| `comment` | `true` | post one comment and keep it updated on each push |
| `label` | `true` | apply `risk: critical` / `risk: significant` / `risk: routine` (created if missing) |
| `fail-on` | `none` | `significant` or `critical` fails the check at that level or above |

Outputs: `level`, `score`.

## Run it locally

```bash
node plugins/pr-workflow/skills/pr-risk/scripts/cli.js                 # this branch vs the default branch
node plugins/pr-workflow/skills/pr-risk/scripts/cli.js --base develop
gh pr diff 42 | node plugins/pr-workflow/skills/pr-risk/scripts/cli.js --diff-file - --markdown
```

## What it scores

The rules and the config format are in
[`plugins/pr-workflow/skills/pr-risk/reference/config.md`](../plugins/pr-workflow/skills/pr-risk/reference/config.md).
In short: sensitive areas (secrets, migrations, auth and admin, payments, infra, CI, public API,
dependencies) add points once each; size, deleted or skipped tests and missing tests add more;
a secret in the added lines forces critical. Docs-only PRs score 0.

## Layout

```
pr-risk/
  action.yml     composite action; runs the built scorer with node
  src/           TypeScript source (zero runtime dependencies)
  test/          vitest: glob matching, diff parsing, scoring, and the action against a fake GitHub API
plugins/pr-workflow/skills/pr-risk/scripts/   built output, committed so the plugin and action need no build step
```

CI rebuilds the scorer and fails if the committed output doesn't match the source.
