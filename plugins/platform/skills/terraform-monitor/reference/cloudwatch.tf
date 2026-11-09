# Template: CloudWatch alarms on an Application Load Balancer, alerting Slack through SNS + AWS Chatbot.
# Adapt to API Gateway by switching the namespace to AWS/ApiGateway and the dimensions to ApiName/Stage.

variable "service" {
  type = string
}

variable "env" {
  type = string
}

variable "alb_arn_suffix" {
  description = "The load balancer's arn_suffix, e.g. app/my-alb/0123456789abcdef."
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Optional target group arn_suffix to scope alarms to one service behind a shared ALB."
  type        = string
  default     = null
}

variable "alerts_topic_arn" {
  description = "SNS topic subscribed by an AWS Chatbot Slack channel configuration."
  type        = string
}

variable "p95_seconds" {
  type    = number
  default = 0.8
}

variable "p99_seconds" {
  type    = number
  default = 2
}

variable "error_rate_pct" {
  type    = number
  default = 5
}

variable "min_requests" {
  type    = number
  default = 50
}

locals {
  dimensions = merge(
    { LoadBalancer = var.alb_arn_suffix },
    var.target_group_arn_suffix == null ? {} : { TargetGroup = var.target_group_arn_suffix },
  )
  tags = { service = var.service, env = var.env, "managed-by" = "terraform" }
}

resource "aws_cloudwatch_metric_alarm" "p95_latency" {
  alarm_name          = "${var.service}-${var.env}-p95-latency"
  alarm_description   = "P95 latency for ${var.service} (${var.env}) above ${var.p95_seconds}s for 10 minutes."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  dimensions          = local.dimensions
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = var.p95_seconds
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "p99_latency" {
  alarm_name          = "${var.service}-${var.env}-p99-latency"
  alarm_description   = "P99 latency for ${var.service} (${var.env}) above ${var.p99_seconds}s for 10 minutes."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p99"
  dimensions          = local.dimensions
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = var.p99_seconds
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]
  tags                = local.tags
}

# Error rate = 5xx / requests, suppressed when traffic is below min_requests.
resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "${var.service}-${var.env}-5xx-rate"
  alarm_description   = "${var.service} (${var.env}) 5xx rate above ${var.error_rate_pct}% for 5 minutes."
  evaluation_periods  = 1
  threshold           = var.error_rate_pct
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]
  tags                = local.tags

  metric_query {
    id          = "rate"
    expression  = "IF(requests > ${var.min_requests}, 100 * errors / requests, 0)"
    label       = "5xx error rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      dimensions  = local.dimensions
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      dimensions  = local.dimensions
      period      = 300
      stat        = "Sum"
    }
  }
}
