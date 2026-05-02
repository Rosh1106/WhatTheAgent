import type { CompatibilityInfo, Finding, McpServerComponent } from "../core/types.js";
import { scanAgentAdapters } from "../adapters/index.js";

export interface McpScanResult {
  servers: McpServerComponent[];
  findings: Finding[];
  compatibility: CompatibilityInfo;
  executionMessage?: string;
}

export async function scanMcpConfigs(root: string, allowMcpExec = false): Promise<McpScanResult> {
  const servers: McpServerComponent[] = [];
  const findings: Finding[] = [];
  const adapterScan = await scanAgentAdapters(root);

  for (const scan of adapterScan.scans) {
    servers.push(...scan.components.filter((component): component is McpServerComponent => component.type === "mcp_server"));
    findings.push(...scan.findings);
  }

  return {
    servers,
    findings,
    compatibility: adapterScan.compatibility,
    executionMessage: allowMcpExec ? "MCP execution mode is reserved for a future version." : undefined
  };
}
