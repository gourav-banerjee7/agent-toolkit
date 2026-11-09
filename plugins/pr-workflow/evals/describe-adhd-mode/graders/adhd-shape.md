---
type: llm
---
- The first line of the PR body tells the reviewer where to start (a specific file) and gives a review time estimate in minutes.
- The body has a numbered review order, one step per area, each naming a file and the one thing to check in it.
- One review step asks the reviewer to check what happens when the database is down: `/healthz` returns 503, so the load balancer will mark every target unhealthy at once (a possible full outage during a DB blip).
- The body stays short: no long "Why" section, no paragraphs over three lines.
- It does not claim the PR was opened.
