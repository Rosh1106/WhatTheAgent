import type { Capability, Finding, RiskLevel } from "../core/types.js";

const criticalCapabilities = new Set<Capability>(["payment", "order_placement"]);
const highCapabilities = new Set<Capability>(["external_send", "execute_code", "approval_bypass"]);
const mediumCapabilities = new Set<Capability>(["write_file", "credential_access"]);
const lowCapabilities = new Set<Capability>(["read_file", "network_access"]);

export function classifyCapability(capability: Capability): RiskLevel {
  if (criticalCapabilities.has(capability)) return "critical";
  if (highCapabilities.has(capability)) return "high";
  if (mediumCapabilities.has(capability)) return "medium";
  if (lowCapabilities.has(capability)) return "low";
  return "low";
}

export function highestRiskLevel(risks: RiskLevel[]): RiskLevel {
  const rank: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };
  return risks.sort((a, b) => rank[b] - rank[a])[0] ?? "low";
}

export function componentCapabilities(findings: Finding[], componentId: string): Set<Capability> {
  return new Set(
    findings
      .filter((finding) => finding.componentId === componentId)
      .map((finding) => finding.capability)
  );
}
