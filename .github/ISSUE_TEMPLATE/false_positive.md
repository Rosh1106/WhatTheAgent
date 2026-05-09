---
name: False positive
about: WhatTheAgent flagged something that isn't actually a risk (or isn't actually that capability)
title: "[false-positive] "
labels: ["bug", "false-positive", "detection"]
---

## What got flagged

The exact card / chain / capability finding from the report. Component label, type, path, and what WhatTheAgent claimed:

```
finance-tools (MCP)
.mcp.json
payment
financial action
Component appears capable of financial or commerce actions.
```

## Why it isn't actually that

In one or two sentences. Examples:

- "It's a docs file describing payment flows, not actually invoking them."
- "The word 'order' is in an ESLint rule name (`import/order`)."
- "This is a Stripe documentation page, not a Stripe SDK call."

## Evidence — the exact line that triggered it

This is the most useful thing you can give us. Copy the literal line from the report's "Evidence" drawer or from `understand.json`:

```
file: skills/x/SKILL.md:42
snippet: ## Precedence Order (Highest to Lowest)
pattern: order
```

We pin every false-positive fix as a regression test in `tests/utils/patterns.test.ts`, so this exact line will become a test case that prevents regressions.

## Workspace context

- WhatTheAgent version: `wta --version`
- Was the workspace your own personal-agent setup, a team repo, or somewhere else?
- Did the file come from a marketplace / plugin cache (e.g. `.claude/plugins/marketplaces/...`) that should arguably be ignored by default?
