---
max_turns: 12
allowed_tools: [Skill, Bash, Write, Read]
---

Write the PR title and description for this change. My branch is `feat/BOOK-218-cancellation-fee`. Don't open the PR, just give me the text.

```diff
diff --git a/src/bookings/cancel.ts b/src/bookings/cancel.ts
--- a/src/bookings/cancel.ts
+++ b/src/bookings/cancel.ts
@@ -1,12 +1,24 @@
 import { Booking } from "./model";
+import { hoursUntil } from "../time";
+
+export const LATE_CANCEL_HOURS = 24;
+export const LATE_CANCEL_FEE_CENTS = 2500;

-export function cancelBooking(booking: Booking) {
+export function cancelBooking(booking: Booking, now = new Date()) {
   if (booking.status === "completed") {
     throw new Error("Cannot cancel a completed booking");
   }
-  return { ...booking, status: "cancelled" };
+  const late = hoursUntil(booking.startsAt, now) < LATE_CANCEL_HOURS;
+  return {
+    ...booking,
+    status: "cancelled",
+    cancellationFeeCents: late ? LATE_CANCEL_FEE_CENTS : 0,
+  };
 }
diff --git a/src/bookings/cancel.test.ts b/src/bookings/cancel.test.ts
--- a/src/bookings/cancel.test.ts
+++ b/src/bookings/cancel.test.ts
@@ -8,3 +8,15 @@ it("cancels a requested booking", () => {
   expect(cancelBooking(requested()).status).toBe("cancelled");
 });
+
+it("charges a fee when cancelled less than 24h before start", () => {
+  const b = requested({ startsAt: new Date("2026-01-02T10:00:00Z") });
+  const r = cancelBooking(b, new Date("2026-01-01T12:00:00Z"));
+  expect(r.cancellationFeeCents).toBe(2500);
+});
+
+it("does not charge when cancelled 24h or more before start", () => {
+  const b = requested({ startsAt: new Date("2026-01-03T10:00:00Z") });
+  const r = cancelBooking(b, new Date("2026-01-01T12:00:00Z"));
+  expect(r.cancellationFeeCents).toBe(0);
+});
```
