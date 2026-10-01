---
name: Admin dashboard date windows
description: Timezone convention for daily and monthly dashboard summaries.
---

Admin dashboard "today" and "current month" metrics use explicit UTC calendar boundaries rather than the server process's local timezone.

**Why:** Development and production hosts may run in different timezones; implicit local date boundaries would make dashboard totals change at different moments after deployment.

**How to apply:** Keep daily/monthly KPI queries aligned to UTC unless the product explicitly adopts a user- or marketplace-local reporting timezone. If that policy changes, update both the query boundaries and tests together.