---
name: WhatTheAgent Safety Check
description: Understand this OpenClaw personal-agent setup, review capabilities, suggest guardrails, and validate fixes.
---

Use WhatTheAgent to review this OpenClaw personal-agent workspace.

Run:

```bash
wta understand . --profile openclaw --output .wta
```

If no baseline exists, ask the user whether to create one:

```bash
wta baseline . --profile openclaw --output .wta
```

If a baseline exists, compare against it:

```bash
wta diff-baseline . --profile openclaw --output .wta
```

Summarize:
- skills detected
- MCP/tool servers detected
- identity/persona/memory files detected
- scripts detected
- capabilities detected
- expected capabilities
- needs-attention chains
- suggested guardrails

Do not execute tools, scripts, MCP servers, payments, or network sends during review.

Before making changes, show the user a plan.

Allowed safe changes:
- create or update `wta.policy.yaml`
- add approval requirements
- add domain allowlists
- add command allowlists
- add secret redaction rules
- add dry-run mode to scripts
- add daily check command

Forbidden unless the user explicitly approves:
- deleting skills
- removing MCP servers
- changing SOUL.md
- changing IDENTITY.md
- changing PERSONA.md
- changing MEMORY.md
- disabling workflows

After changes, run:

```bash
wta understand . --profile openclaw --output .wta
```

Explain what changed, what was resolved, what remains, and whether the baseline should be updated.
