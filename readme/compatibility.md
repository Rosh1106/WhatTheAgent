# Compatibility

WhatTheAgent should only claim what it can detect from local files.

Compatibility means:

1. We know where the agent stores config.
2. We can detect the config.
3. We can parse enough of it to normalize surfaces and capabilities.
4. We can show it in `wta understand`.
5. We have fixture or test coverage for the claim.

## Status Meanings

| Status | Meaning |
|---|---|
| Supported | Parser plus capability inference plus fixture/test coverage |
| Partial | Detects common config but may not understand every feature |
| Experimental | Best-effort detection; output may be incomplete |
| Planned | Not implemented yet |

## Current And Planned Compatibility

| Agent / Tool | Status | WhatTheAgent detects or should detect |
|---|---:|---|
| Generic MCP config | Partial | MCP servers, commands, args, env vars, remote URLs |
| Cursor | Partial | `.cursor/mcp.json` MCP servers |
| Claude Desktop | Partial | `claude_desktop_config.json` MCP servers |
| VS Code | Partial | `.vscode/mcp.json` MCP servers |
| Claude Code | Planned | commands, hooks, local config, tool permissions |
| Codex CLI | Planned | skills, configs, tool access, local permissions when documented |
| Kiro | Planned | agent config and tool permissions |
| Windsurf | Planned | rules, workflows, MCP configs |
| Cline | Planned | MCP configs and agent rules |
| Roo Code | Planned | mode/config/tool settings |
| Continue | Planned | model/tool configs |
| Aider | Planned | repo-level config and command execution context |
| Goose | Planned | toolkits, extensions, MCP configs |
| OpenCode | Planned | agent/tool config |
| OpenClaw | Experimental | `SOUL.md`, `AGENTS.md`, markdown skills, scripts, MCP configs, baseline/diff policy review |
| Hermes | Experimental | `IDENTITY.md`, `PERSONA.md`, `MEMORY.md`, markdown skills, scripts, MCP configs, baseline/diff policy review |

## Current Practical Support

Today, WhatTheAgent statically scans known MCP config paths:

```text
.mcp.json
mcp.json
claude_desktop_config.json
.cursor/mcp.json
.vscode/mcp.json
```

MCP servers are represented in the graph as:

```text
MCP server
```

This is useful, but it is not the same as full agent support. For example, full Cursor or Claude Code support would require parsing their broader rules, commands, permissions, hooks, and config models.

## Adapter Model

WhatTheAgent uses adapters to connect platform-specific config files to the common capability model:

```text
Agent config
  -> adapter
  -> setup surface
  -> normalized capabilities
  -> controls
  -> gaps
  -> graph
  -> report and fix plan
```

Implemented command:

```bash
wta compatibility
wta compatibility --json
```

Implemented personal-agent commands:

```bash
wta understand . --profile hermes
wta baseline . --profile hermes
wta diff-baseline . --profile hermes
wta init-policy . --profile openclaw
```

Planned adapter metadata:

```ts
export interface AdapterMetadata {
  id: string;
  name: string;
  supportLevel: "supported" | "partial" | "experimental" | "planned";
  configFiles: string[];
  description: string;
}
```

## Contribution Path

To add a new agent adapter, contributors should provide:

- adapter metadata
- config file paths
- parser or static detector
- normalized components and findings
- fixture workspace
- documentation
- support level that does not overclaim

Personal-agent adapters should also document identity, persona, memory, skill, tool, and script surfaces.
