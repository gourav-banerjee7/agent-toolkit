---
name: seed-scenarios
description: Generate deterministic, idempotent seed data that puts users and records into every state of a complex workflow (bookings, orders, subscriptions, approvals) for QA and local testing. Use when the user wants seed data, test fixtures, fake users in specific states, or coverage of a state machine for testing.
---

# seed-scenarios

Most seed scripts create "a user with an order". QA needs a user whose booking was cancelled by the
worker after it started, in a different timezone, with a refund pending. This skill finds the states
in the code and seeds one named, reproducible scenario per state that matters.

## Safety first

Seeds write to a database. Before running anything:

1. Find how the target database is chosen (env vars, config files). Run seeds only against local,
   test or dev databases. If the connection string or environment looks like production or you can't
   tell, stop and ask.
2. Generate the script; run it only if the user asks, and show the exact command first.

## 1. Map the workflow

From models, enums, migrations, and the code that changes state:

- List the entities and how they relate (user → booking → shifts → payments).
- Find each status field and its allowed values, and the transitions between them (who triggers each,
  and what guards it).
- Note the fields that change behaviour: timezone or region, role, plan or tier, feature flags,
  dates relative to "now".

Write this as a short state table and show it to the user before generating data:

| Entity | State | Reached by | Notes |
|---|---|---|---|

## 2. Pick the scenarios

Cover, in this order, stopping when the set is useful rather than exhaustive:

1. Every terminal and long-lived state at least once.
2. Every transition a user or job can trigger: the record sitting just before it.
3. Edge cases the code handles specially: cancelled mid-way, partial payments, expired, re-opened,
   across a DST change or a region boundary, a user with many records, a user with none.
4. Combinations only where the code branches on both (e.g. role × state).

Give each scenario a stable kebab-case key, like `booking-cancelled-by-worker-after-start`.

## 3. Generate the seed

Use the project's own language, ORM and existing seed or factory tooling. Requirements:

- **Deterministic:** fixed random seed (e.g. `faker.seed(42)`), and dates computed from a fixed
  anchor or from "now" with explicit offsets, so states like "starts in 2 hours" stay true.
- **Idempotent:** stable IDs or natural keys derived from the scenario key, inserted with upsert,
  so running it twice gives the same data.
- **Identifiable:** mark every row (an email domain like `@seed.test`, a `seed_scenario` column if one
  exists, or a key prefix) and include a cleanup function that deletes only marked rows.
- **Valid:** create records through the same model layer or factories the app uses, so validations
  and defaults apply. Reach a state by its real transitions when that is cheap; set it directly only
  when the path is slow or external, and comment why.
- **Logged in:** if the app has login, give each persona a known test password from the project's
  seed config, never a real one, and print the email per scenario.

## 4. Report

Print a table of scenario key → login email → what QA should see, and the commands to seed and
clean up. Mention any state you could not reach and why.
