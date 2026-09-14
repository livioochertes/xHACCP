---
name: MyFlyingBox address contract
description: The French checkout address shape required for a future MyFlyingBox integration.
---

For the French marketplace, keep one regional field named `state` internally and store the official French département code (`75`, `31`, `2A`, etc.), not a translated region name or Romanian `county`. Store the country as an ISO 3166-1 alpha-2 code such as `FR`.

**Why:** MyFlyingBox v2 expects `country`, `postal_code`, and `city` for quote data, then `name`, optional/conditional `company`, `street`, official-code `state`, international `phone`, and `email` for the order. It does not use a separate Romanian county field.

**How to apply:** Keep Romanian `county` behavior unchanged for Sameday. On `.fr`, map first/last name to `name`, address to `street`, zipCode to `postal_code`, and use the single department-code `state` field when the MyFlyingBox adapter is enabled.