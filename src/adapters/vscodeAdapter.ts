import type { AgentAdapter } from "./types.js";
import { scanMcpConfigFiles } from "./mcpAdapterUtils.js";

export const vscodeAdapter: AgentAdapter = {
  metadata: {
    id: "vscode",
    name: "VS Code",
    supportLevel: "partial",
    configFiles: [".vscode/mcp.json"],
    description: "Detects VS Code MCP server configuration."
  },
  scan(root) {
    return scanMcpConfigFiles(root, this.metadata.configFiles, this.metadata);
  }
};
