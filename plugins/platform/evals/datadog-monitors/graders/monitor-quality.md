---
type: llm
focus: {source: file, path: monitors/bookings.tf}
---
- There are alerts for P95 latency, P99 latency and 5xx error rate on `bookings-api` in `prod`.
- Latency monitors use percentile queries (p95 / p99) on a request trace metric, scoped by service and env.
- The 5xx alert is based on errors relative to requests (a rate), not a raw error count, and has some guard against very low traffic. A composite monitor combining an error-rate monitor with a traffic-floor monitor counts.
- The latency and error-rate alerts each have a critical threshold and a message that notifies Slack and handles recovery.
- Monitors are tagged with at least service and env.
- Thresholds are variables or clearly named values, not unexplained magic numbers.
