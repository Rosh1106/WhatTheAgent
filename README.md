# WhatTheAgent

WhatTheAgent shows what your AI agent is really doing.

Run one command and see the capabilities your agent has, what changed, and which chains look risky. This is a local-first capability discovery, knowledge graph, and governance CLI. It is not a vulnerability scanner.

## Install

```bash
npm install
npm run build
```

During local development:

```bash
npm run dev -- scan examples/risky-agent
```

After publishing or linking, both binaries work:

```bash
whattheagent scan .
wta scan .
```

## Commands

```bash
whattheagent scan .
whattheagent scan . --output whattheagent.json
whattheagent graph .
whattheagent diff old.json new.json
whattheagent report whattheagent.json
```

Agent-friendly flags are supported by every command:

```bash
whattheagent scan . --json --no-color --output whattheagent.json
wta diff old.json new.json --json --quiet
```

## Static and Local First

WhatTheAgent does not require login, upload scan data, call an API, use an LLM, execute scripts, or start MCP servers. MCP configs are parsed statically by default.

The reserved flag below is accepted for future compatibility:

```bash
whattheagent scan . --allow-mcp-exec
```

For now it prints:

```text
MCP execution mode is reserved for a future version.
```

## Example

```bash
npm run dev -- scan examples/risky-agent --output whattheagent.json
npm run dev -- graph examples/risky-agent --json
npm run dev -- report whattheagent.json
```

The example workspace intentionally triggers:

- `external_send`
- `credential_access`
- `execute_code`
- `network_access`
- data exfiltration and remote execution risk chains

## JSON Shape

Scan output is deterministic and stable:

```json
{
  "schemaVersion": "0.1",
  "workspace": {
    "root": "."
  },
  "components": [],
  "findings": [],
  "riskChains": [],
  "graph": {
    "nodes": [],
    "edges": []
  },
  "summary": {}
}
```

Core scan logic lives in reusable functions under `src/core`, `src/scanner`, `src/parser`, `src/graph`, `src/diff`, and `src/risk` so a future local MCP server can expose:

- `scan_workspace`
- `generate_graph`
- `diff_scans`
- `explain_capability`
- `find_risky_chains`
- `export_report`
