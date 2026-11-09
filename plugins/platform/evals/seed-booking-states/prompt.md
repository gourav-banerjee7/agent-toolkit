---
max_turns: 12
allowed_tools: [Skill, Read, Glob, Grep]
---

I need QA seed data for our bookings. Don't write files yet, just give me the scenario plan.

Our model: a `Booking` has `status` in `requested`, `accepted`, `in_progress`, `completed`, `cancelled`. Cancellation records `cancelled_by` (`client` or `worker`) and `cancelled_at`. Clients and workers each have a `timezone`. Bookings cancelled less than 24h before `starts_at` get a cancellation fee. A booking can be re-opened from `cancelled` back to `requested` by support. We use Prisma and `@faker-js/faker`.
