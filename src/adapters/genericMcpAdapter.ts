import type { AgentAdapter } from "./types.js";
import { scanMcpConfigFiles } from "./mcpAdapterUtils.js";

export const genericMcpAdapter: AgentAdapter = {
  metadata: {
    id: "generic-mcp",
    name: "Generic MCP config",
    supportLevel: "partial",
    configFiles: [".mcp.json", "mcp.json"],
    description: "Detects generic MCP server configuration, commands, args, env vars, and remote URLs."
  },
  scan(root) {
    return scanMcpConfigFiles(root, this.metadata.configFiles, this.metadata);
  }
};
