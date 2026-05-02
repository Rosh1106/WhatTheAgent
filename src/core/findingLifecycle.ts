import type { Component, Finding, FindingCategory, UserImpact } from "./types.js";
import { sensitivityForFinding } from "../risk/sensitivity.js";

export type FindingStatus =
  | "detected"
  | "inventory"
  | "expected"
  | "suppressed"
  | "needs_attention"
  | "control_gap"
  | "risk_chain"
  | "fix_recommended";

export interface FindingLifecycle {
  status: FindingStatus;
  category: FindingCategory;
  impact: UserImpact;
  reason: string;
}

export type FindingWithLifecycle = Finding & {
  lifecycle: FindingLifecycle;
  category: FindingCategory;
  impact: UserImpact;
};

export function applyFindingLifecycle(findings: Finding[], components: Component[]): FindingWithLifecycle[] {
  const componentById = new Map(components.map((component) => [component.id, component]));
  return findings.map((finding) => withFindingLifecycle(finding, componentById.get(finding.componentId)));
}

export function withFindingLifecycle(finding: Finding, component?: Component): FindingWithLifecycle {
  const lifecycle = classifyFindingLifecycle(finding, component);
  return {
    ...finding,
    category: lifecycle.category,
    impact: lifecycle.impact,
    lifecycle
  };
}

export function classifyFindingLifecycle(finding: Finding, component?: Component): FindingLifecycle {
  const sensitivity = sensitivityForFinding(finding, component);

  if (finding.capability === "payment" || finding.capability === "order_placement") {
    return {
      status: "needs_attention",
      category: "needs_attention",
      impact: "fix_required",
      reason: "Financial or commerce capability requires explicit approval and guardrails."
    };
  }

  if (sensitivity === "sensitive" || sensitivity === "critical") {
    return {
      status: "needs_attention",
      category: "needs_attention",
      impact: sensitivity === "critical" ? "fix_required" : "review_recommended",
      reason: "Sensitive capability should be reviewed before it is treated as expected behavior."
    };
  }

  if (finding.capability === "read_file" || finding.capability === "network_access") {
    return {
      status: "inventory",
      category: "inventory",
      impact: "informational",
      reason: "Capability is useful inventory unless combined with sensitive data or external action."
    };
  }

  return {
    status: "detected",
    category: "observation",
    impact: "informational",
    reason: "Capability was detected by static local analysis."
  };
}

export function expectedLifecycle(reason: string): FindingLifecycle {
  return {
    status: "expected",
    category: "inventory",
    impact: "informational",
    reason
  };
}

export function suppressedLifecycle(reason: string): FindingLifecycle {
  return {
    status: "suppressed",
    category: "inventory",
    impact: "informational",
    reason
  };
}
