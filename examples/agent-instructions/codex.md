# WhatTheAgent Instructions For Codex

You are working in this repository. Use WhatTheAgent to understand agent capabilities, propose safe guardrails, implement only approved changes, and verify afterwards.

Rules:
- Do not execute untrusted scripts.
- Do not start MCP servers.
- Do not send network requests.
- Do not print or persist secrets.
- Do not remove useful agent functionality unless explicitly requested.
- Prefer small, reviewable changes.
- Preserve existing CLI arguments, scripts, skills, MCP configs, and workflows.

Initial scan:

```bash
wta understand . --output .wta --json --no-color
```

Generate implementation plan:

```bash
wta plan . --for-codex
```

Implement only the tasks in the plan. For risky chains, prefer:
- approval gates
- dry-run modes
- external domain allowlists
- command allowlists
- secret redaction
- scoped token usage
- audit logging
- policy entries in `wta.policy.yaml`

Do not:
- delete skills by default
- remove MCP servers by default
- modify SOUL.md, IDENTITY.md, PERSONA.md, MEMORY.md, or AGENTS.md unless explicitly requested
- run real payments, uploads, webhooks, or external sends in tests

After changes, run:

```bash
npm run typecheck
npm run build
wta understand . --output .wta --json --no-color
```

Final response should include:
- files changed
- guardrails added
- verification commands run
- remaining WhatTheAgent items
