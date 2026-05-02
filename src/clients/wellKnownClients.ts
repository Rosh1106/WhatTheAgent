import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ClientScanResult, CompatibilityInfo, WellKnownClient } from "../core/types.js";
import { parseMcpConfig } from "../parser/mcpParser.js";
import { relativePath } from "../utils/normalize.js";

export const wellKnownClients: WellKnownClient[] = [
  {
    id: "generic-mcp",
    name: "Workspace MCP",
    clientExistsPaths: [],
    mcpConfigPaths: [".mcp.json", "mcp.json"],
    skillsDirPaths: []
  },
  {
    id: "windsurf",
    name: "Windsurf",
    clientExistsPaths: ["~/.codeium"],
    mcpConfigPaths: ["~/.codeium/windsurf/mcp_config.json"],
    skillsDirPaths: ["~/.codeium/windsurf/skills"]
  },
  {
    id: "cursor",
    name: "Cursor",
    clientExistsPaths: ["~/.cursor", ".cursor"],
    mcpConfigPaths: ["~/.cursor/mcp.json", ".cursor/mcp.json"],
    skillsDirPaths: ["~/.cursor/skills", ".cursor/skills"]
  },
  {
    id: "vscode",
    name: "VS Code",
    clientExistsPaths: ["~/.vscode", "~/.config/Code"],
    mcpConfigPaths: [
      "~/Library/Application Support/Code/User/settings.json",
      "~/.vscode/mcp.json",
      "~/Library/Application Support/Code/User/mcp.json",
      "~/.config/Code/User/settings.json",
      "~/.config/Code/User/mcp.json",
      ".vscode/mcp.json"
    ],
    skillsDirPaths: ["~/.copilot/skills"]
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    clientExistsPaths: ["~/Library/Application Support/Claude", "~/AppData/Roaming/Claude"],
    mcpConfigPaths: [
      "~/Library/Application Support/Claude/claude_desktop_config.json",
      "~/AppData/Roaming/Claude/claude_desktop_config.json",
      "claude_desktop_config.json"
    ],
    skillsDirPaths: []
  },
  {
    id: "claude-code",
    name: "Claude Code",
    clientExistsPaths: ["~/.claude"],
    mcpConfigPaths: ["~/.claude.json"],
    skillsDirPaths: ["~/.claude/skills"]
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    clientExistsPaths: ["~/.gemini"],
    mcpConfigPaths: ["~/.gemini/settings.json"],
    skillsDirPaths: ["~/.gemini/skills"]
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    clientExistsPaths: ["~/.clawdbot", "~/.openclaw"],
    mcpConfigPaths: [],
    skillsDirPaths: ["~/.clawdbot/skills", "~/.openclaw/skills", "~/.openclaw/workspace/skills", ".openclaw/skills"]
  },
  {
    id: "hermes",
    name: "Hermes",
    clientExistsPaths: ["IDENTITY.md", "PERSONA.md", "MEMORY.md"],
    mcpConfigPaths: [],
    skillsDirPaths: []
  },
  {
    id: "amp",
    name: "Amp",
    clientExistsPaths: ["~/.config/agents", ".amp"],
    mcpConfigPaths: [],
    skillsDirPaths: ["~/.config/agents/skills", ".amp/skills"]
  },
  {
    id: "kiro",
    name: "Kiro",
    clientExistsPaths: ["~/.kiro"],
    mcpConfigPaths: ["~/.kiro/settings/mcp.json"],
    skillsDirPaths: []
  },
  {
    id: "opencode",
    name: "OpenCode",
    clientExistsPaths: ["~/.config/opencode"],
    mcpConfigPaths: [],
    skillsDirPaths: []
  },
  {
    id: "antigravity",
    name: "Antigravity",
    clientExistsPaths: ["~/.gemini/antigravity"],
    mcpConfigPaths: ["~/.gemini/antigravity/mcp_config.json"],
    skillsDirPaths: []
  },
  {
    id: "codex",
    name: "Codex",
    clientExistsPaths: ["~/.codex"],
    mcpConfigPaths: [],
    skillsDirPaths: ["~/.codex/skills"]
  },
  {
    id: "amazon-q",
    name: "Amazon Q",
    clientExistsPaths: ["~/.aws/amazonq"],
    mcpConfigPaths: ["~/.aws/amazonq/agents/default.json", "~/.aws/amazonq/agents/mcp.json", "~/.aws/amazonq/mcp.json"],
    skillsDirPaths: []
  }
].sort((a, b) => a.name.localeCompare(b.name));

export async function scanKnownClients(root: string, allowMcpExec = false): Promise<{ scans: ClientScanResult[]; compatibility: CompatibilityInfo }> {
  const scans: ClientScanResult[] = [];
  for (const client of wellKnownClients) {
    scans.push(await scanKnownClient(root, client, allowMcpExec));
  }

  return {
    scans,
    compatibility: {
      detectedClients: scans
        .filter((scan) => scan.detectedFiles.length > 0 || scan.mcpConfigFiles.length > 0 || scan.skillsDirs.length > 0)
        .map((scan) => ({
          id: scan.client.id,
          name: scan.client.name,
          detectedFiles: scan.detectedFiles,
          mcpConfigFiles: scan.mcpConfigFiles,
          skillsDirs: scan.skillsDirs
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      knownClients: wellKnownClients
    }
  };
}

async function scanKnownClient(root: string, client: WellKnownClient, allowMcpExec: boolean): Promise<ClientScanResult> {
  const detectedFiles = await existingPaths(root, client.clientExistsPaths);
  const mcpConfigFiles = await existingPaths(root, client.mcpConfigPaths);
  const skillsDirs = await existingPaths(root, client.skillsDirPaths);
  const components = [];
  const findings = [];

  for (const configFile of mcpConfigFiles) {
    const parsed = await parseMcpConfig(root, path.resolve(root, configFile), allowMcpExec, client);
    components.push(...parsed.servers);
    findings.push(...parsed.findings);
  }

  return {
    client,
    components,
    findings,
    detectedFiles,
    mcpConfigFiles,
    skillsDirs
  };
}

async function existingPaths(root: string, patterns: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const pattern of patterns) {
    const absolute = resolveScanPath(root, pattern);
    if (!absolute) continue;
    try {
      await fs.access(absolute);
      found.push(displayPath(root, absolute));
    } catch {
      // Missing client files are expected.
    }
  }
  return [...new Set(found)].sort();
}

function resolveScanPath(root: string, pattern: string): string | undefined {
  const resolvedRoot = path.resolve(root);
  if (pattern === ".") return resolvedRoot;
  if (pattern.startsWith("~/")) {
    const home = os.homedir();
    if (resolvedRoot !== home) return undefined;
    return path.join(home, pattern.slice(2));
  }
  return path.resolve(resolvedRoot, pattern);
}

function displayPath(root: string, absolute: string): string {
  return relativePath(root, absolute);
}
