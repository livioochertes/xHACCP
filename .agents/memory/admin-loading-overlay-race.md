---
name: Admin loading overlay timing
description: Prevent a completed React mount from remaining covered by the initial admin loading overlay.
---

The initial admin overlay must be hidden when the app root already has rendered content before the mutation observer starts. A fast bundle can mount React before `DOMContentLoaded`, so an observer created afterward misses the insertion.

**Why:** The admin login rendered underneath the loading overlay during a fresh page load.

**How to apply:** When initializing the overlay observer, check for existing root children and hide the overlay before subscribing for future mutations.