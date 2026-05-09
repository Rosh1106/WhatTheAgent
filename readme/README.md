# WhatTheAgent docs hub

<p align="center">
  <img src="mascot.svg" alt="Wat, the WhatTheAgent mascot — a small teal robot inspecting an AI agent's capabilities through a magnifying glass." width="120"/>
</p>

WhatTheAgent has two audiences:

1. **Personal-agent users** running OpenClaw, Hermes, local skills, scripts, memory files, and MCP servers on their own machine.
2. **Workspace-station users** running Codex, Claude Code, Cursor, Kiro, Windsurf, VS Code, or another coding agent inside a repo or team workspace.

Both ask the same question:

> What can my agent do, what changed, and what should I approve or guardrail?

The mental model differs. Personal-agent users care about identity, skills, memory, scripts, secrets, and automations on their machine. Workspace-station users care about repo-local agent configs, MCP servers, scripts, CI workflows, policy files, and pull-request changes.

## Install

```bash
npm install -g whattheagent
wta understand . --output .wta --open      # write report.html and open it
wta understand . --chat                    # phone-readable summary instead
```

## Pick your path

| I am using... | Start here | What you get |
|---|---|---|
| OpenClaw, Hermes, local personal agents, custom skill folders | [Personal Agents](./personal-agents.md) | A capability map and chat-driven approval flow for your personal-agent setup |
| Codex, Claude Code, Cursor, Kiro, Windsurf, VS Code, team repos | [Workspace Stations](./workspace-stations.md) | A repo capability report plus fix plans for coding agents |
| I want to paste a safety routine into my agent | [Agent Instructions](./agent-instructions.md) | Copy-paste instructions and a ready-made Hermes / OpenClaw skill |
| I want to know what clients and files are checked | [Compatibility](./compatibility.md) | Known agent clients, MCP config paths, skills paths |
| I want CI reports for agent capability changes | [GitHub Actions](../docs/github-action.md) | A workflow that uploads `.wta` reports and an agent fix plan |

## Core product loop

```text
User understands and approves.
Agent implements.
WhatTheAgent verifies.
```

Run:

```bash
wta understand . --output .wta
```

Outputs in `.wta/`:

```text
.wta/
  understand.json         # full structured scan
  capability-graph.json   # nodes/edges of agent surfaces and capabilities
  fix-plan.md             # markdown for a coding agent to act on
  report.html             # tier-organized, dark/light, self-contained
  visual-chains.svg       # the at-a-glance risk-chains image
  agent-context.json      # compact context for an agent
  chat-message.md         # only when --chat is passed
  chat-actions.json       # only when --chat is passed
```

Use the output this way:

- Humans open `report.html` (or pass `--open` and skip the click).
- Coding agents read `agent-context.json` or `wta plan . --for-codex`.
- Personal agents on chat (Hermes / OpenClaw / Telegram) use `wta understand . --chat --json` and the [skills/whattheagent-safety-check.skill.md](../skills/whattheagent-safety-check.skill.md) skill.
- CI uploads the entire `.wta/` directory as an artifact.

## Approval workflow

WhatTheAgent doesn't expect every detected capability to be a problem. Once you've decided something is intentional, acknowledge it once and future scans only re-flag changes:

```bash
# Targeted: ack a single component (or one capability of one).
wta ack mcp.burp execute_code --reason "Burp Suite, security testing tool"
wta ack mcp.github --reason "Read-only GitHub MCP, approved"

# Reason from stdin (avoids shell-escape bugs in agent-driven flows).
echo "internal finance pipeline" | wta ack skill.invoice-review --reason-from-stdin

# Bulk: scan once and seed wta.policy.yaml with every detected capability.
wta init-policy . --from-scan --profile personal-agent

# Many at once (the "approve all" intent from the chat skill).
cat <<'JSON' | wta ack-batch --reason "approved during onboarding"
[
  { "componentId": "mcp.burp" },
  { "componentId": "skill.invoice-review", "capability": "external_send" }
]
JSON
```

`expected:` policy entries don't hide inventory — they move acknowledged capabilities out of *Needs attention* so future scans only show real changes.

## Local-first promise

WhatTheAgent does not:

- require login
- upload workspace data
- call an LLM
- execute scripts
- start MCP servers
- make network requests during scanning

It produces evidence, reports, policy proposals, and coding-agent fix plans entirely from local files. Preview commands like `wta probe` and `wta runtime` remain plan-only unless explicitly documented otherwise.
