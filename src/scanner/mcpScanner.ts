import type { Finding, McpServerComponent } from "../core/types.js";
import { parseMcpConfig } from "../parser/mcpParser.js";
import { findExistingFiles } from "../utils/fileWalker.js";
import { mcpConfigFiles } from "../utils/patterns.js";

export interface McpScanResult {
  servers: McpServerComponent[];
  findings: Finding[];
  executionMessage?: string;
}

export async function scanMcpConfigs(root: string, allowMcpExec = false): Promise<McpScanResult> {
  const configFiles = await findExistingFiles(root, mcpConfigFiles);
  const servers: McpServerComponent[] = [];
  const findings: Finding[] = [];

  for (const configFile of configFiles) {
    const parsed = await parseMcpConfig(root, configFile, allowMcpExec);
    servers.push(...parsed.servers);
    findings.push(...parsed.findings);
  }

  return {
    servers,
    findings,
    executionMessage: allowMcpExec ? "MCP execution mode is reserved for a future version." : undefined
  };
}
