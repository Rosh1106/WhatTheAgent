import type { AgentAdapter } from "./types.js";
import { scanMcpConfigFiles } from "./mcpAdapterUtils.js";

export const cursorAdapter: AgentAdapter = {
  metadata: {
    id: "cursor",
    name: "Cursor",
    supportLevel: "partial",
    configFiles: [".cursor/mcp.json"],
    description: "Detects Cursor MCP server configuration."
  },
  scan(root) {
    return scanMcpConfigFiles(root, this.metadata.configFiles, this.metadata);
  }
};
