# Product Positioning

WhatTheAgent should be simple to explain:

> WhatTheAgent shows what your AI agent is really doing.

But it should speak differently to two groups.

## Personal Agents

Audience:

- OpenClaw users
- Hermes users
- local personal-agent builders
- people with custom skills, memory files, scripts, and MCP servers

Promise:

> Map your personal agent's skills, tools, memory, scripts, and MCP servers, then generate safe fix plans for Claude or Codex.

Job to be done:

> I want to understand what my personal agent can do, what changed, and what I should review before I trust it more.

Best first command:

```bash
wta understand . --output .wta
```

Best next command:

```bash
wta plan . --for-claude
```

## Workspace Stations

Audience:

- Codex users
- Claude Code users
- Cursor users
- Kiro users
- Windsurf users
- VS Code agent users
- security and platform teams supporting coding agents

Promise:

> See what your coding-agent workspace can do, what changed in the repo, and what should be reviewed in CI.

Job to be done:

> I want to know whether this workspace or pull request changed my agent's capabilities, controls, or risky chains.

Best first command:

```bash
wta understand . --output .wta
```

Best next command:

```bash
wta plan . --for-codex
```

## Product Principle

```text
User understands and approves.
Agent implements.
WhatTheAgent verifies.
```

WhatTheAgent should not silently change risky logic. It should produce:

- evidence
- graph context
- quick fixes
- implementation tasks
- reviewable commands for coding agents
