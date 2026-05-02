import type { AdapterMetadata, AdapterScanResult, CompatibilityInfo, DetectedAdapter } from "../core/types.js";
import type { AgentAdapter } from "./types.js";
import { claudeDesktopAdapter } from "./claudeDesktopAdapter.js";
import { cursorAdapter } from "./cursorAdapter.js";
import { genericMcpAdapter } from "./genericMcpAdapter.js";
import { vscodeAdapter } from "./vscodeAdapter.js";

export const implementedAdapters: AgentAdapter[] = [
  genericMcpAdapter,
  cursorAdapter,
  claudeDesktopAdapter,
  vscodeAdapter
];

export const plannedAdapters: AdapterMetadata[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Claude Code commands, hooks, local config, and tool permissions."
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Codex skills, configs, tool access, and local permissions when documented."
  },
  {
    id: "kiro",
    name: "Kiro",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Kiro agent config and tool permissions."
  },
  {
    id: "windsurf",
    name: "Windsurf",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Windsurf rules, workflows, and MCP configs."
  },
  {
    id: "cline",
    name: "Cline",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Cline MCP configs and agent rules."
  },
  {
    id: "roo-code",
    name: "Roo Code",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Roo Code mode, config, and tool settings."
  },
  {
    id: "continue",
    name: "Continue",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Continue model and tool configs."
  },
  {
    id: "aider",
    name: "Aider",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Aider repo-level config and command execution context."
  },
  {
    id: "goose",
    name: "Goose",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for Goose toolkits, extensions, and MCP configs."
  },
  {
    id: "opencode",
    name: "OpenCode",
    supportLevel: "planned",
    configFiles: [],
    description: "Planned adapter for OpenCode agent and tool config."
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    supportLevel: "experimental",
    configFiles: ["SOUL.md", "AGENTS.md", "skills/**/*.md", "*.skill.md", ".mcp.json", "mcp.json"],
    description: "Experimental personal-agent profile for OpenClaw identity, rules, skills, scripts, and MCP configs."
  },
  {
    id: "hermes",
    name: "Hermes",
    supportLevel: "experimental",
    configFiles: ["IDENTITY.md", "PERSONA.md", "MEMORY.md", "skills/**/*.md", "*.skill.md", ".mcp.json", "mcp.json"],
    description: "Experimental personal-agent profile for Hermes identity, persona, memory, skills, scripts, and MCP configs."
  }
];

export function availableAdapters(): AdapterMetadata[] {
  return [...implementedAdapters.map((adapter) => adapter.metadata), ...plannedAdapters]
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function scanAgentAdapters(root: string): Promise<{ scans: AdapterScanResult[]; compatibility: CompatibilityInfo }> {
  const scans = [];
  for (const adapter of implementedAdapters) {
    scans.push(await adapter.scan(root));
  }

  return {
    scans,
    compatibility: {
      detectedAdapters: detectedAdapters(scans),
      availableAdapters: availableAdapters()
    }
  };
}

function detectedAdapters(scans: AdapterScanResult[]): DetectedAdapter[] {
  return scans
    .filter((scan) => scan.detectedFiles.length > 0)
    .map((scan) => ({
      id: scan.adapter.id,
      name: scan.adapter.name,
      supportLevel: scan.adapter.supportLevel,
      detectedFiles: scan.detectedFiles
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
