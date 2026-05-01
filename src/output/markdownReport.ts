import type { ScanResult } from "../core/types.js";

export function renderMarkdownReport(scan: ScanResult): string {
  const lines: string[] = [
    "# WhatTheAgent Risk Report",
    "",
    "## Summary",
    "",
    `- Skills: ${scan.summary.componentsByType.skill}`,
    `- MCP servers: ${scan.summary.componentsByType.mcp_server}`,
    `- Scripts: ${scan.summary.componentsByType.script}`,
    `- Findings: ${scan.findings.length}`,
    `- High-risk chains: ${scan.riskChains.length}`,
    "",
    "## Capabilities",
    ""
  ];

  for (const [capability, count] of Object.entries(scan.summary.capabilities).filter(([, count]) => count > 0)) {
    lines.push(`- ${capability}: ${count}`);
  }

  lines.push("", "## Risk Chains", "");
  if (scan.riskChains.length === 0) {
    lines.push("No high-risk chains detected.");
  } else {
    for (const chain of scan.riskChains) {
      lines.push(`### ${chain.name}`);
      lines.push("");
      lines.push(`- Component: ${chain.componentId}`);
      lines.push(`- Risk: ${chain.risk}`);
      lines.push(`- Message: ${chain.message}`);
      lines.push(`- Capabilities: ${chain.capabilities.join(" + ")}`);
      lines.push("- Evidence:");
      for (const evidence of chain.evidence) {
        const location = evidence.line ? `${evidence.file}:${evidence.line}` : evidence.file;
        lines.push(`  - ${evidence.pattern} in ${location}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}
