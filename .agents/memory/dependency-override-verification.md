---
name: Dependency override verification
description: Why adding a security override is not sufficient evidence of remediation.
---

Verify the installed dependency tree and every maintained lockfile after adding a security override.

**Why:** npm can report installation success while preserving an older nested resolution from its existing lockfile. Even upgrading the direct parent can retain vulnerable transitive versions that still satisfy its range. The installed tree can still contain the vulnerable package and report it as invalid against a new override.

**How to apply:** Check actual resolved versions, not only manifest constraints or installation exit status. Try compatible parent upgrades first; if their published ranges still allow affected versions, enforce a patched transitive floor. Ensure npm and pnpm resolutions agree before considering the vulnerability fixed, and test the affected parent tool with the patched transitive dependency.