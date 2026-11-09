---
type: llm
---
- The plan includes at least one scenario for each status: requested, accepted, in_progress, completed, cancelled.
- It separates cancellations by `client` and by `worker`, and covers both a late cancellation (under 24h, fee charged) and an early one (no fee).
- It includes a re-opened booking (cancelled back to requested).
- It includes at least one timezone edge case (client and worker in different timezones, or a DST change).
- Scenarios have stable kebab-case keys.
- It says the seed will be deterministic (fixed faker seed or fixed dates) and idempotent (upsert or stable IDs), and that seeded rows are marked so they can be cleaned up.
- It does not write any files.
