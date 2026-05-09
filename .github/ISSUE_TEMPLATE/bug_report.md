---
name: Bug report
about: Something WhatTheAgent did that you didn't expect (a crash, a broken output, etc.)
title: "[bug] "
labels: bug
---

## What you ran

The exact command(s):

```bash
wta ...
```

## What you expected

One or two sentences.

## What happened instead

Error message, stack trace, or output snippet. Trim to the relevant lines — don't paste a 10 MB report. If the issue is in `report.html`, a screenshot of the affected card is more useful than the raw HTML.

## Workspace context

- WhatTheAgent version: `wta --version`
- Node version: `node --version`
- OS: macOS / Linux / Windows
- Workspace shape:
  - skills: yes/no, count if known
  - MCP configs: which (Cursor / Claude Desktop / VS Code / `.mcp.json`)
  - scripts: yes/no
  - personal-agent profile (Hermes / OpenClaw / `personal-agent`)?

## Minimal reproduction

If you can produce a small synthetic workspace or fixture that triggers it, attach it. The fixtures under `examples/` show the shape we use for our own tests.

## Anything else

Logs, screenshots, or a hunch about which file/module is involved.
