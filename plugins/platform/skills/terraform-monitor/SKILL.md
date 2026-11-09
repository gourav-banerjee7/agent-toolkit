---
name: terraform-monitor
description: Generate Terraform for API health monitors (P95/P99 latency, error rate, traffic drop) with Slack alerts, on Datadog or AWS CloudWatch. Use when the user wants monitors, alerts, alarms or SLO checks for an endpoint or service written as Terraform.
---

# terraform-monitor

Turn "watch this endpoint" into reviewed, valid Terraform that pages the right Slack channel.
You write and validate code. You never run `terraform apply`.

## 1. Find out what to monitor

Work out each of these from the repo first; ask the user only for what you can't find.

- **Provider:** Datadog (`datadog_monitor`) or CloudWatch (`aws_cloudwatch_metric_alarm`).
  Check existing `*.tf` files for `provider "datadog"` or `provider "aws"` and follow what's there.
- **Service and endpoints:** service name, environment, and the routes worth monitoring
  (from the router, OpenAPI spec, or what the user named). Prefer a handful of critical routes plus one
  service-wide monitor over one monitor per route.
- **Metric source:** for Datadog, APM `trace.<framework>.request` metrics, tagged `service`, `env`,
  `resource_name`. For CloudWatch, the ALB (`AWS/ApplicationELB`) or API Gateway (`AWS/ApiGateway`)
  namespace, and the load balancer / API name.
- **Slack:** the channel. Datadog uses `@slack-<channel>` in the message. CloudWatch sends to an SNS
  topic that AWS Chatbot forwards to Slack; reuse an existing topic if the repo has one.
- **Thresholds:** use the user's numbers. Otherwise use the defaults below and say they are defaults.

| Monitor | Warning | Critical | Window |
|---|---|---|---|
| P95 latency | 500 ms | 800 ms | 10 min |
| P99 latency | 1.0 s | 2.0 s | 10 min |
| 5xx error rate | 1% | 5% | 5 min |
| Traffic drop (optional) | — | 50% below last week | 15 min |

Error-rate monitors must divide errors by requests and ignore low traffic, so 1 error in 2
requests at 3am doesn't page anyone. See the templates for how.

## 2. Write the code

Follow the repo's layout and naming. If there is none, create `monitors/<service>.tf` with variables
for thresholds and the Slack target, so the monitors are reusable across environments.

Start from the matching template and adapt it:
- Datadog: `reference/datadog.tf`
- CloudWatch: `reference/cloudwatch.tf`

Every monitor must have:
- A name that says service, env, signal: `[api][prod] P99 latency high on POST /bookings`.
- A message that says what's wrong, the threshold, a link to the dashboard or runbook if the repo
  has one, and the Slack target. Use `{{#is_warning}}` / `{{#is_recovery}}` blocks on Datadog.
- Tags (`service`, `env`, `team`, `managed-by:terraform`).
- A recovery notification, and no-data handling chosen deliberately (latency: don't alert on no data;
  traffic drop: do).

## 3. Validate

If `terraform` is installed, run in the directory you changed:

```bash
terraform fmt
terraform init -backend=false -input=false
terraform validate
```

Fix anything `validate` reports. If `init` can't download providers (offline, private registry),
say validation was skipped and why. Never run `plan` against a real backend or `apply` — tell the
user the next step is their `terraform plan` in CI.

## 4. Report

List each monitor with its threshold and Slack target in a short table, say which thresholds are
defaults, and show the `terraform validate` result.
