import type { Capability, Component, Evidence, Finding, RiskChain } from "../core/types.js";
import { stableId } from "../utils/normalize.js";

interface CapabilityGroup {
  component: Component;
  findings: Finding[];
}

export function detectRiskChains(components: Component[], findings: Finding[]): RiskChain[] {
  const groups = buildCapabilityGroups(components, findings);
  const chains: RiskChain[] = [];

  for (const group of groups) {
    const capabilities = new Set(group.findings.map((finding) => finding.capability));
    if (hasAll(capabilities, ["credential_access", "external_send"])) {
      chains.push(chain("Data Exfiltration", group.component.id, ["credential_access", "external_send"], "critical", "Component can access credentials and send data externally.", group.findings));
    }
    if (hasAll(capabilities, ["execute_code", "network_access"])) {
      chains.push(chain("Remote Execution", group.component.id, ["execute_code", "network_access"], "critical", "Component can execute code and access network resources.", group.findings));
    }
    if (hasAll(capabilities, ["approval_bypass", "external_send"])) {
      chains.push(chain("Silent External Action", group.component.id, ["approval_bypass", "external_send"], "high", "Component can send data externally while instructions discourage approval.", group.findings));
    }
    if (capabilities.has("payment") || capabilities.has("order_placement")) {
      const relevant = capabilities.has("payment") && capabilities.has("order_placement")
        ? ["payment", "order_placement"]
        : capabilities.has("payment")
          ? ["payment"]
          : ["order_placement"];
      chains.push(chain("Financial Action", group.component.id, relevant as Capability[], "critical", "Component appears capable of financial or commerce actions.", group.findings));
    }
  }

  return chains.sort((a, b) => a.id.localeCompare(b.id));
}

function buildCapabilityGroups(components: Component[], findings: Finding[]): CapabilityGroup[] {
  const childrenByParent = new Map<string, Component[]>();
  for (const component of components) {
    if (!component.parentId) continue;
    childrenByParent.set(component.parentId, [...(childrenByParent.get(component.parentId) ?? []), component]);
  }

  return components
    .filter((component) => component.type !== "script" || !component.parentId)
    .map((component) => {
      const childIds = childrenByParent.get(component.id)?.map((child) => child.id) ?? [];
      const componentIds = new Set([component.id, ...childIds]);
      return {
        component,
        findings: findings.filter((finding) => componentIds.has(finding.componentId))
      };
    })
    .filter((group) => group.findings.length > 0);
}

function hasAll(capabilities: Set<Capability>, required: Capability[]): boolean {
  return required.every((capability) => capabilities.has(capability));
}

function chain(
  name: string,
  componentId: string,
  capabilities: Capability[],
  risk: "high" | "critical",
  message: string,
  findings: Finding[]
): RiskChain {
  const capabilitySet = new Set(capabilities);
  const evidence = findings
    .filter((finding) => capabilitySet.has(finding.capability))
    .map((finding) => finding.evidence)
    .sort(compareEvidence);

  return {
    id: stableId("chain", `${componentId}-${name}`),
    name,
    componentId,
    capabilities: [...capabilities].sort(),
    risk,
    message,
    evidence
  };
}

function compareEvidence(left: Evidence, right: Evidence): number {
  return `${left.file}:${left.line ?? 0}:${left.pattern}`.localeCompare(`${right.file}:${right.line ?? 0}:${right.pattern}`);
}
