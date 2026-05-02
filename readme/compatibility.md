# Compatibility

WhatTheAgent compatibility is a simple known-client path table.

For each agent client, WhatTheAgent tracks:

- paths that show the client exists
- MCP config paths
- skills directory paths

When a path exists inside the scanned root, WhatTheAgent reports it. When an MCP config exists, it parses the MCP servers statically and maps them into capabilities.

## Current Known Clients

| Client | MCP configs | Skills |
|---|---|---|
| Amazon Q | `~/.aws/amazonq/agents/default.json`, `~/.aws/amazonq/agents/mcp.json`, `~/.aws/amazonq/mcp.json` | none |
| Amp | none | `~/.config/agents/skills`, `.amp/skills` |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | none |
| Claude Code | `~/.claude.json` | `~/.claude/skills` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json`, `~/AppData/Roaming/Claude/claude_desktop_config.json`, `claude_desktop_config.json` | none |
| Codex | none | `~/.codex/skills` |
| Cursor | `~/.cursor/mcp.json`, `.cursor/mcp.json` | `~/.cursor/skills`, `.cursor/skills` |
| Gemini CLI | `~/.gemini/settings.json` | `~/.gemini/skills` |
| Hermes | none | personal profile scans markdown skills and scripts |
| Kiro | `~/.kiro/settings/mcp.json` | none |
| OpenClaw | none | `~/.clawdbot/skills`, `~/.openclaw/skills`, `~/.openclaw/workspace/skills`, `.openclaw/skills` |
| OpenCode | none | none |
| VS Code | `~/Library/Application Support/Code/User/settings.json`, `~/.vscode/mcp.json`, `~/Library/Application Support/Code/User/mcp.json`, `~/.config/Code/User/settings.json`, `~/.config/Code/User/mcp.json`, `.vscode/mcp.json` | `~/.copilot/skills` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/skills` |
| Workspace MCP | `.mcp.json`, `mcp.json` | none |

## Commands

```bash
wta compatibility
wta compatibility --json
```

## Important Behavior

Project scans stay inside the project. Home-directory paths like `~/.cursor/mcp.json` are checked when you scan your home directory.

This keeps the scanner predictable for coding agents and CI: it reports local evidence, not guessed support.

## Contribution Path

To add another client, add one registry entry with:

- client name
- client-exists paths
- MCP config paths
- skills directory paths
- a fixture if the config should be parsed
