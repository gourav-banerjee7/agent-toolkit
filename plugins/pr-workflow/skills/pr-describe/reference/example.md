# One PR, two styles

The PR adds an `mfa_enrolled_at` column and blocks payouts for workers without MFA.

## Default

**Title:** PAY-412: Require MFA before payouts

```markdown
**TL;DR:** Workers must enrol in MFA before they can request a payout.

## Why
Account takeovers on payout details (PAY-412).

## What changed
- New nullable `mfa_enrolled_at` column on `workers`, backfilled from Auth0 enrolment events.
- `POST /payouts` returns 403 `mfa_required` when the column is null.
- Payout screen shows an "Enable MFA" prompt instead of the payout button.

## How to test
1. `npm test -- payouts`
2. Log in as `worker-no-mfa@seed.test`, open Payouts, confirm the MFA prompt.

## Risk
Critical (score 95) — migration, auth and payments code. Rollback: revert; the column is nullable so the migration is safe to leave.
```

## ADHD mode

```markdown
**Review:** ⏱ ~30 min · start at `db/migrations/0042_mfa_enrolled_at.sql`

**TL;DR:** Workers must enrol in MFA before they can request a payout.

## Review order
1. `db/migrations/0042_mfa_enrolled_at.sql` — column is nullable and the backfill is batched.
2. `src/payouts/guard.ts` — 403 only when `mfa_enrolled_at` is null, not when Auth0 is down.
3. `web/payouts/PayoutButton.vue` — prompt replaces the button; no payout call without MFA.

## How to test
1. `npm test -- payouts`
2. Log in as `worker-no-mfa@seed.test`, open Payouts, confirm the MFA prompt.

## Risk
Critical (score 95) — migration, auth and payments. Rollback: revert; column can stay.
```
