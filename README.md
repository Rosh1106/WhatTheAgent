# WhatTheAgent

WhatTheAgent shows what your AI agent is really doing.

Run one command to see your agent's skills, tools, scripts, MCP servers, secrets, external services, risky chains, and suggested guardrails.

## Install

WhatTheAgent is published on npm:

```bash
npm install -g whattheagent
```

Verify the CLI:

```bash
wta --help
whattheagent --help
```

## Quick Start

Run WhatTheAgent from any agent workspace:

```bash
wta understand . --output .wta
```

Then open:

```text
.wta/report.html
```

Ask your coding agent for a safe implementation plan:

```bash
wta plan . --for-codex
wta plan . --for-claude
```

Generate copy-paste instructions for the agent you use:

```bash
wta instructions --for-claude
wta instructions --for-codex
wta instructions --for-openclaw
wta instructions --for-hermes
```

## Choose Your Path

WhatTheAgent has two modes:

| Mode | Use this for | Start here |
|---|---|---|
| Personal agents | OpenClaw, Hermes, local skills, memory, scripts, MCP servers | [Personal Agents](readme/personal-agents.md) |
| Workspace stations | Codex, Claude Code, Cursor, Kiro, Windsurf, VS Code, team repos | [Workspace Stations](readme/workspace-stations.md) |
| Agent instructions | Paste into Claude, Codex, OpenClaw, Hermes, or another agent | [Agent Instructions](readme/agent-instructions.md) |
| GitHub Actions | CI reports for PRs and agent workspaces | [GitHub Actions](docs/github-action.md) |

The full docs hub is in [readme/](readme/README.md).

Core loop:

```text
User understands and approves.
Agent implements.
WhatTheAgent verifies.
```

## Paste Into Your Agent

Generate copy-paste instructions for the agent you use:

```bash
wta instructions
wta instructions --for-claude
wta instructions --for-codex
wta instructions --for-openclaw
wta instructions --for-hermes
```

The instruction tells the agent to:

```text
baseline the workspace
show current capabilities
suggest guardrails
ask before changing anything
validate after fixes
check again when new skills or MCP servers are added
```

For personal agents, you can write a skill-style instruction file:

```bash
wta instructions --for-hermes --output skills/whattheagent-safety-check.skill.md
```

A ready-made example also lives at:

```text
skills/whattheagent-safety-check.skill.md
```

## GitHub Actions

Run WhatTheAgent in CI and upload the local `.wta` report:

```yaml
name: WhatTheAgent

on:
  pull_request:
  push:
    branches: [main]

jobs:
  whattheagent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g whattheagent
      - run: wta understand . --output .wta --json --no-color
      - run: wta instructions --for-codex --output .wta/codex-instructions.md
      - uses: actions/upload-artifact@v4
        with:
          name: whattheagent-report
          path: .wta/
```

A reusable example lives at:

```text
examples/github-action/whattheagent.yml
```

## Development From Source

```bash
git clone https://github.com/Rosh1106/WhatTheAgent.git
cd WhatTheAgent
npm install
npm run build
npm link
```

Local development without linking:

```bash
npm install
npm run build
npm run dev -- scan examples/risky-agent
npm run dev -- instructions --for-claude
```

Both binaries work after global install or linking:

```bash
whattheagent scan .
wta scan .
```

## Commands

Core commands:

```bash
wta understand . --output .wta
wta compatibility
wta instructions --for-claude
wta plan . --for-codex
wta graph . --json
wta diff old.json new.json
```

Personal-agent approval flow:

```bash
wta understand . --profile hermes --output .wta
wta baseline . --profile hermes --output .wta
wta diff-baseline . --profile hermes --output .wta
wta init-policy . --profile openclaw
```

Agent-friendly flags:

```bash
wta understand . --json --no-color --quiet --output .wta
```

`understand` writes:

```text
.wta/
  understand.json
  capability-graph.json
  fix-plan.md
  report.html
  agent-context.json
```

The report is split into:

- detected setup
- what your agent can do
- needs attention
- expected or acknowledged capabilities
- suggested fixes
- coding-agent fix plan

MCP servers are shown directly as MCP servers in reports and summaries.

For the current known-client path table, see [Compatibility](readme/compatibility.md).

## Workspace Detection

WhatTheAgent automatically detects workspace surfaces from files it can see:

- generic MCP: `.mcp.json`, `mcp.json`
- Cursor MCP: `.cursor/mcp.json`
- VS Code MCP: `.vscode/mcp.json`
- Claude Desktop MCP: `claude_desktop_config.json`
- skills: `SKILL.md`
- scripts: `scripts/**/*.py|js|ts|sh`
- policy: `wta.policy.yaml`, `.wta/policy.*`
- CI: GitHub workflows that run `wta` or `whattheagent`

The client list is intentionally simple: WhatTheAgent checks known config and skills paths, parses MCP server configs when present, and reports only the surfaces it can prove from local files.

List known client paths:

```bash
wta compatibility
wta compatibility --json
```

## Continuous Check Loop

For personal agents:

```bash
wta baseline . --profile personal-agent --output .wta
wta diff-baseline . --profile personal-agent --output .wta
```

Run the diff daily, or whenever a new skill or MCP server is added. The agent instruction should summarize new capabilities and ask whether to accept them or add guardrails.

## Policy

```yaml
expected:
  - component: "mcp.github-readonly"
    capability: "network_access"
    reason: "GitHub read-only MCP server needs network access to api.github.com."
```

Policy does not hide inventory. It moves approved capabilities out of "needs attention" so users can focus on real changes.

## Static and Local First

WhatTheAgent runs locally. It does not require login, upload scan data, call an API, use an LLM, execute scripts, or start MCP servers.

Advanced preview commands live in the roadmap:

```bash
wta probe .
wta runtime . --mode observe
```

## Example

```bash
npm run dev -- understand examples/risky-agent --output .wta
npm run dev -- plan examples/risky-agent --for-codex
npm run dev -- baseline examples/hermes-personal-agent --profile hermes --output .wta
npm run dev -- instructions --for-claude
```

The example workspace intentionally triggers:

- `external_send`
- `credential_access`
- `execute_code`
- `network_access`
- data exfiltration and remote execution risk chains

Additional fixtures cover common review cases:

```bash
npm run dev -- understand examples/benign-agent
npm run dev -- understand examples/cursor-agent
npm run dev -- understand examples/claude-desktop-agent
npm run dev -- understand examples/vscode-agent
npm run dev -- understand examples/expected-github-tool
npm run dev -- understand examples/risky-finance-agent
npm run dev -- understand examples/critical-payment-agent
```

- `benign-agent` shows low-noise inventory and ordinary observations
- `expected-github-tool` shows an expected MCP server declared by policy
- `risky-finance-agent` triggers credential plus external-send risk
- `critical-payment-agent` triggers payment and order-placement risk
