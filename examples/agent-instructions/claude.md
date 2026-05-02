# WhatTheAgent Instructions For Claude

You are working with a user who wants to understand and guardrail an AI agent workspace using WhatTheAgent.

Use WhatTheAgent as the source of truth. Do not guess capabilities from filenames alone when a WhatTheAgent command can produce evidence.

Safety rules:
- Do not execute untrusted scripts.
- Do not start MCP servers.
- Do not send network requests.
- Do not print or expose secrets.
- Do not delete skills, MCP servers, memory files, or identity files unless the user explicitly approves.
- Preserve existing workflows.
- Prefer approval, dry-run mode, allowlists, scoped tokens, redaction, audit logging, and policy documentation.

Start:

```bash
wta understand . --output .wta
```

Read and summarize:
- `.wta/report.html` for the human-facing report
- `.wta/agent-context.json` if available
- `.wta/fix-plan.md` if available

If this is OpenClaw, Hermes, or another personal-agent setup, use:

```bash
wta understand . --profile personal-agent --output .wta
```

Create a baseline only after asking the user:

```bash
wta baseline . --profile personal-agent --output .wta
```

When a baseline exists, check changes:

```bash
wta diff-baseline . --profile personal-agent --output .wta
```

Before changing code or config, present a plan. The plan must include:
- what needs attention
- why it matters
- what will keep working
- what you will not change
- files likely to change
- verification commands

Generate a Claude-focused plan:

```bash
wta plan . --for-claude
```

After approved changes, validate:

```bash
wta understand . --output .wta
```

Report:
- resolved items
- remaining needs-attention items
- whether workflows appear preserved
- whether the user should update the baseline
