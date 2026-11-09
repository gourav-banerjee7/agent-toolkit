# pr-risk config

Put a JSON file at `.github/pr-risk.json`. The Action reads it from the **base** branch, so a PR
can't lower its own risk score.

```json
{
  "thresholds": { "critical": 60, "significant": 25 },
  "categories": [
    { "id": "booking", "label": "Booking engine", "points": 35, "patterns": ["src/booking/**"] },
    { "id": "dependencies", "points": 0 },
    { "id": "infrastructure", "exclude": ["infra/sandbox/**"] }
  ],
  "untestedLines": 200,
  "size": { "largeLines": 500 }
}
```

- A category with a built-in `id` updates that category; a new `id` adds one.
- `"points": 0` turns a category off.
- Patterns are globs: `**`, `*`, `?`, `{a,b}`. A pattern with no `/` matches the file name anywhere.

## Built-in rules

| Signal | Points | Triggered by |
|---|---:|---|
| Possible secret added | 50, forces critical | AWS, GitHub, Slack, Stripe live, Google, Anthropic, OpenAI keys or private key blocks in added lines |
| Secrets or credentials files | 40 | `.env*`, `*.pem`, `*.key`, `credentials*` (not `.env.example`) |
| Database migrations or schema | 35 | `migrations/`, `*.sql`, `schema.prisma`, `alembic/` |
| Authentication, admin or permissions | 30 | `auth/`, `admin/`, `rbac/`, `iam/`, `session.*`, `admin.*`, `*-auth.*` |
| Payments, billing or ledger | 30 | `payments/`, `billing/`, `ledger/`, `wallet/`, `*invoice*` |
| Infrastructure as code | 30 | `*.tf`, `terraform/`, `cdk/`, `helm/`, `k8s/`, `Dockerfile`, compose files |
| Very large / large diff | 25 / 15 | 1000+ / 400+ changed lines |
| Test files deleted | 20 | a test file removed |
| CI/CD pipeline | 20 | `.github/workflows/`, Buildkite, CircleCI, GitLab, Jenkins |
| Public API contract | 20 | OpenAPI, Swagger, `.proto`, GraphQL |
| Tests skipped or disabled | 15 | `it.skip`, `xit`, `@pytest.mark.skip`, `@Disabled`, `t.Skip` added |
| Dependencies | 10 | manifests and lockfiles |
| Net test lines removed | 10 | 20+ more test lines removed than added |
| Many files | 10 | 40+ files |
| No test changes | 10 | 150+ code lines changed, no test files touched |

Docs-only PRs score 0 unless they add a secret.
Levels: **critical** at 60+ (or any secret), **significant** at 25+, otherwise **routine**.
