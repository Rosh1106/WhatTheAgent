# WhatTheAgent Readme Hub

WhatTheAgent has two audiences:

1. Personal-agent users who run OpenClaw, Hermes, local skills, scripts, memory files, MCP servers, and custom tools on their own machine.
2. Workspace-station users who run Codex, Claude Code, Cursor, Kiro, Windsurf, VS Code, or similar coding agents inside a repo or team workspace.

Both audiences need the same answer:

> What can my agent do, what changed, and what should I approve or guardrail?

The difference is the mental model.

Personal-agent users care about identity, skills, memory, tools, scripts, secrets, and automations.

Workspace-station users care about repo-local agent configs, MCP servers, scripts, CI workflows, policy files, and pull request changes.

## Pick Your Path

| I am using... | Start here | What you get |
|---|---|---|
| OpenClaw, Hermes, local personal agents, custom skill folders | [Personal Agents](./personal-agents.md) | A capability map and safety checklist for your personal agent setup |
| Codex, Claude Code, Cursor, Kiro, Windsurf, VS Code, team repos | [Workspace Stations](./workspace-stations.md) | A repo/workspace capability report plus fix plans for coding agents |
| I want to know what tools are supported | [Compatibility](./compatibility.md) | Honest current, partial, and planned compatibility status |

## Core Product Loop

```text
User understands and approves.
Agent implements.
WhatTheAgent verifies.
```

Run:

```bash
wta understand . --output .wta
```

Then inspect:

```text
.wta/
  understand.json
  capability-graph.json
  fix-plan.md
  report.html
  agent-context.json
```

Use the output this way:

- Humans read `report.html` and the terminal summary.
- Coding agents read `agent-context.json`, `fix-plan.md`, or `wta plan . --for-codex`.
- CI and future MCP clients read deterministic JSON.

## Local-First Promise

WhatTheAgent does not:

- require login
- upload workspace data
- call an LLM
- execute scripts
- start MCP servers
- make network requests

It produces evidence, reports, policy proposals, and coding-agent fix plans from local files.
