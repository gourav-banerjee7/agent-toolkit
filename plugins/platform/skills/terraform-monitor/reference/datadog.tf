# Template: Datadog APM monitors for one service. Adapt names, metric framework and thresholds.
# Assumes the Datadog provider is configured elsewhere in the module.

variable "service" {
  type = string
}

variable "env" {
  type = string
}

variable "slack_channel" {
  description = "Slack channel name without #, connected through the Datadog Slack integration."
  type        = string
}

variable "team" {
  type    = string
  default = "platform"
}

variable "p95_ms" {
  type    = object({ warning = number, critical = number })
  default = { warning = 500, critical = 800 }
}

variable "p99_ms" {
  type    = object({ warning = number, critical = number })
  default = { warning = 1000, critical = 2000 }
}

variable "error_rate_pct" {
  type    = object({ warning = number, critical = number })
  default = { warning = 1, critical = 5 }
}

variable "min_requests" {
  description = "Ignore the error rate when the window has fewer requests than this."
  type        = number
  default     = 50
}

locals {
  scope  = "service:${var.service},env:${var.env}"
  notify = "@slack-${var.slack_channel}"
  tags   = ["service:${var.service}", "env:${var.env}", "team:${var.team}", "managed-by:terraform"]
  # Change "express" to the framework your tracer reports (e.g. flask, rack, spring, aspnet_core).
  metric = "trace.express.request"
}

resource "datadog_monitor" "p95_latency" {
  name    = "[${var.service}][${var.env}] P95 latency high"
  type    = "query alert"
  query   = "percentile(last_10m):p95:${local.metric}{${local.scope}} > ${var.p95_ms.critical / 1000}"
  message = <<-EOT
    {{#is_alert}}P95 latency for ${var.service} (${var.env}) is {{value}}s, above ${var.p95_ms.critical}ms.{{/is_alert}}
    {{#is_warning}}P95 latency for ${var.service} (${var.env}) is {{value}}s, above ${var.p95_ms.warning}ms.{{/is_warning}}
    {{#is_recovery}}P95 latency for ${var.service} (${var.env}) is back to normal.{{/is_recovery}}
    ${local.notify}
  EOT

  monitor_thresholds {
    warning  = var.p95_ms.warning / 1000
    critical = var.p95_ms.critical / 1000
  }

  notify_no_data      = false
  require_full_window = false
  tags                = local.tags
}

resource "datadog_monitor" "p99_latency" {
  name    = "[${var.service}][${var.env}] P99 latency high"
  type    = "query alert"
  query   = "percentile(last_10m):p99:${local.metric}{${local.scope}} > ${var.p99_ms.critical / 1000}"
  message = <<-EOT
    {{#is_alert}}P99 latency for ${var.service} (${var.env}) is {{value}}s, above ${var.p99_ms.critical}ms.{{/is_alert}}
    {{#is_warning}}P99 latency for ${var.service} (${var.env}) is {{value}}s, above ${var.p99_ms.warning}ms.{{/is_warning}}
    {{#is_recovery}}P99 latency for ${var.service} (${var.env}) is back to normal.{{/is_recovery}}
    ${local.notify}
  EOT

  monitor_thresholds {
    warning  = var.p99_ms.warning / 1000
    critical = var.p99_ms.critical / 1000
  }

  notify_no_data      = false
  require_full_window = false
  tags                = local.tags
}

resource "datadog_monitor" "error_rate" {
  name = "[${var.service}][${var.env}] 5xx error rate high"
  type = "query alert"
  # Error percentage, but only when there is enough traffic for it to mean something.
  query   = <<-EOT
    sum(last_5m):(sum:${local.metric}.errors{${local.scope}}.as_count() / sum:${local.metric}.hits{${local.scope}}.as_count() * 100) * (sum:${local.metric}.hits{${local.scope}}.as_count() > ${var.min_requests}) > ${var.error_rate_pct.critical}
  EOT
  message = <<-EOT
    {{#is_alert}}${var.service} (${var.env}) is failing {{value}}% of requests (critical at ${var.error_rate_pct.critical}%).{{/is_alert}}
    {{#is_warning}}${var.service} (${var.env}) is failing {{value}}% of requests (warning at ${var.error_rate_pct.warning}%).{{/is_warning}}
    {{#is_recovery}}${var.service} (${var.env}) error rate has recovered.{{/is_recovery}}
    ${local.notify}
  EOT

  monitor_thresholds {
    warning  = var.error_rate_pct.warning
    critical = var.error_rate_pct.critical
  }

  notify_no_data = false
  tags           = local.tags
}
