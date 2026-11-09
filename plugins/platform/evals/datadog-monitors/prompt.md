---
max_turns: 20
allowed_tools: [Skill, Read, Write, Edit, Glob, Grep, Bash]
---

We use Datadog APM (Express). Write Terraform monitors for the `bookings-api` service in `prod`: P95 and P99 latency plus 5xx error rate, alerting Slack channel `oncall-bookings`. Put them in `monitors/bookings.tf`. Use sensible defaults for thresholds.
