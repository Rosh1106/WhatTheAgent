import type { AgentAdapter } from "./types.js";
import { scanMcpConfigFiles } from "./mcpAdapterUtils.js";

export const claudeDesktopAdapter: AgentAdapter = {
  metadata: {
    id: "claude-desktop",
    name: "Claude Desktop",
    supportLevel: "partial",
    configFiles: ["claude_desktop_config.json"],
    description: "Detects Claude Desktop MCP server configuration."
  },
  scan(root) {
    return scanMcpConfigFiles(root, this.metadata.configFiles, this.metadata);
  }
};
