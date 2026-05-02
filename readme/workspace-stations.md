# Workspace Stations

Use this path if you run coding agents in a repo or team workspace: Codex, Claude Code, Cursor, Kiro, Windsurf, VS Code, or similar tools.

## Positioning

> WhatTheAgent shows what your coding-agent workspace can do, what changed, and what should be reviewed before it becomes team risk.

For teams:

> Did this PR change what our agents can do, and what should we review or fix?

## What Workspace Users Want To Know

- Which agent/tool surfaces did WhatTheAgent detect?
- Did this repo add a new MCP server?
- Did this repo add new agent capabilities?
- Did this repo add secret or environment access?
- Did this repo add external send or network behavior?
- Did this repo add scripts that can execute commands?
- Did this repo miss expected controls?
- What should Codex, Claude Code, or another coding agent fix?

## How To Use It Today

From a repo root:

```bash
wta understand . --output .wta
```

Open:

```text
.wta/report.html
```

Generate a coding-agent implementation prompt:

```bash
wta plan . --for-codex
wta plan . --for-claude
```

Use machine-readable output:

```bash
wta understand . --json --no-color --output .wta
```

Compare two scans:

```bash
wta scan . --json --output old.json
wta scan . --json --output new.json
wta diff old.json new.json
```

## Platform Detection

WhatTheAgent automatically detects platforms when local config files identify them.

Current automatic detection:

| Surface | Detected from |
|---|---|
| Generic MCP | `.mcp.json`, `mcp.json` |
| Cursor MCP | `.cursor/mcp.json` |
| VS Code MCP | `.vscode/mcp.json` |
| Claude Desktop MCP | `claude_desktop_config.json` |
| Skills | `SKILL.md` |
| Scripts | `scripts/**/*.py`, `scripts/**/*.js`, `scripts/**/*.ts`, `scripts/**/*.sh` |
| Policy | `wta.policy.yaml`, `.wta/policy.*` |
| CI | GitHub workflows that run `wta` or `whattheagent` |

For platforms like Codex, Claude Code, Kiro, Windsurf, OpenClaw, and Hermes, WhatTheAgent starts with a known-client path table. It checks the files it can see, parses MCP server configs when present, and avoids claiming hidden capabilities from files it cannot prove locally.

## How To Read The Report

### Detected Setup

This is the workspace inventory:

- skills
- scripts
- MCP servers
- policy files
- CI workflows
- controls

### What Your Agent Can Do

This is the normalized capability map:

- read files
- write files
- execute code
- access network resources
- send data externally
- access credentials
- use payment/order flows
- delegate to other agents

### Needs Attention

Prioritize this section. It contains:

- unsuppressed high or critical risk chains
- sensitive missing controls
- capabilities that should have approval, scoped secrets, audit logging, or allowlists

### Expected / Acknowledged

Use this for known-good tools and intentional capabilities.

Example:

```yaml
expected:
  - component: "*github-readonly"
    capability: "network_access"
    reason: "GitHub read-only MCP server needs network access to api.github.com."
```

Expected capabilities stay visible, but they do not drown the user in false positives.

## Suggested Workspace Workflow

1. Run `wta understand . --output .wta` locally.
2. Review `.wta/report.html`.
3. Add `wta.policy.yaml` for expected tools and controls.
4. Run `wta plan . --for-codex`.
5. Let the coding agent implement controls.
6. Re-run `wta understand .`.
7. Add CI once the baseline is low-noise.

## GitHub Actions Direction

Teams can run WhatTheAgent in pull requests and upload the `.wta` report as an artifact.

Recommended first workflow:

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
      - run: npm ci
      - run: npm run build
      - run: node dist/cli.js understand . --output .wta --json
      - uses: actions/upload-artifact@v4
        with:
          name: whattheagent-report
          path: .wta/
```

Recommended CI behavior:

- Do not fail on inventory.
- Do not fail on normal observations.
- Start by uploading `.wta/report.html`.
- Later fail only on unsuppressed high or critical risk chains/control gaps.

Future focused command:

```bash
wta ci . --fail-on high --output .wta
```

## Best Results With Coding Agents

Give the agent a narrow implementation prompt:

```bash
wta plan . --for-codex
```

Tell the coding agent:

- preserve useful functionality
- add controls before deleting tools
- do not execute untrusted scripts or MCP servers
- do not print or persist secrets
- re-run WhatTheAgent after changes
