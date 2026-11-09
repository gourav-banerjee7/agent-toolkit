---
type: regex
target: {source: file, path: monitors/bookings.tf}
match: count:2
---
percentile\(last_\d+m\):p9[59]:
