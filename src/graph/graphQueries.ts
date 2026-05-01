import type { Capability, Finding, RiskChain } from "../core/types.js";

export function findingsForComponent(findings: Finding[], componentId: string): Finding[] {
  return findings.filter((finding) => finding.componentId === componentId);
}

export function capabilitiesForComponent(findings: Finding[], componentId: string): Capability[] {
  return [...new Set(findingsForComponent(findings, componentId).map((finding) => finding.capability))].sort();
}

export function findRiskyChains(riskChains: RiskChain[], componentId?: string): RiskChain[] {
  return riskChains
    .filter((chain) => !componentId || chain.componentId === componentId)
    .sort((a, b) => a.id.localeCompare(b.id));
}
