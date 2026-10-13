---
name: Workflow port timeouts
description: How to respond when the application workflow times out waiting for its web port.
---

When a web workflow times out waiting for port 5000, check the live process, listening address, and an HTTP request before changing code or retrying. A startup log saying “serving on port 5000” is not enough once the workflow has timed out; the process may already have been stopped.

**Why:** Repeated restarts here reported a port timeout even though the startup logs showed the server listening and handling requests; after timeout, no process or listener remained.

**How to apply:** Read the workflow-port troubleshooting skill, verify `ss` and `curl` while the process is alive, then stop after two failed restarts rather than repeating the same attempt.
