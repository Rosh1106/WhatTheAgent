import type { Capability, CapabilityGraph, Component, Evidence, Finding, GraphEdge, GraphNode, RiskChain } from "../core/types.js";
import { sortGraphEdges, sortGraphNodes, stableId } from "../utils/normalize.js";

export function buildGraph(rootLabel: string, components: Component[], findings: Finding[], riskChains: RiskChain[]): CapabilityGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  nodes.set("workspace.root", {
    id: "workspace.root",
    type: "Workspace",
    label: rootLabel
  });

  for (const component of components) {
    nodes.set(component.id, componentNode(component));
    edges.push({
      from: component.parentId ?? "workspace.root",
      to: component.id,
      type: "CONTAINS"
    });
    addMetadataNodes(component, nodes, edges);
  }

  for (const finding of findings) {
    const capabilityId = capabilityNodeId(finding.capability);
    nodes.set(capabilityId, {
      id: capabilityId,
      type: "Capability",
      label: finding.capability
    });
    edges.push({
      from: finding.componentId,
      to: capabilityId,
      type: "HAS_CAPABILITY",
      evidence: finding.evidence
    });
  }

  for (const riskChain of riskChains) {
    nodes.set(riskChain.id, {
      id: riskChain.id,
      type: "RiskChain",
      label: riskChain.name,
      metadata: {
        risk: riskChain.risk,
        message: riskChain.message,
        capabilities: riskChain.capabilities
      }
    });
    edges.push({
      from: riskChain.componentId,
      to: riskChain.id,
      type: "HAS_RISK_CHAIN"
    });
  }

  return {
    nodes: sortGraphNodes([...nodes.values()]),
    edges: sortGraphEdges(dedupeEdges(edges))
  };
}

function componentNode(component: Component): GraphNode {
  const metadata = component.type === "mcp_server"
    ? { ...component.metadata, subtype: "mcp_server" }
    : component.metadata;

  return {
    id: component.id,
    type: componentTypeToNodeType(component.type),
    label: component.label,
    path: component.path,
    metadata
  };
}

function componentTypeToNodeType(type: Component["type"]): GraphNode["type"] {
  switch (type) {
    case "skill":
      return "Skill";
    case "mcp_server":
      return "ToolServer";
    case "script":
      return "Script";
    case "prompt":
      return "Prompt";
    case "rule":
      return "Rule";
    case "memory":
      return "Config";
    case "config":
      return "Config";
    case "env_var":
      return "EnvVar";
    case "api_endpoint":
      return "APIEndpoint";
    case "capability":
      return "Capability";
  }
}

function addMetadataNodes(component: Component, nodes: Map<string, GraphNode>, edges: GraphEdge[]): void {
  if (component.type !== "mcp_server") return;
  const metadata = component.metadata as {
    env?: Record<string, string>;
    url?: string;
    args?: string[];
  };

  for (const envName of Object.keys(metadata.env ?? {}).sort()) {
    const nodeId = stableId("env", `${component.id}-${envName}`);
    nodes.set(nodeId, {
      id: nodeId,
      type: "EnvVar",
      label: envName
    });
    edges.push({ from: component.id, to: nodeId, type: "USES" });
  }

  const endpoints = new Set<string>();
  if (metadata.url) endpoints.add(metadata.url);
  for (const arg of metadata.args ?? []) {
    if (/^https?:\/\//i.test(arg)) endpoints.add(arg);
  }
  for (const endpoint of [...endpoints].sort()) {
    const nodeId = stableId("endpoint", `${component.id}-${endpoint}`);
    nodes.set(nodeId, {
      id: nodeId,
      type: "APIEndpoint",
      label: endpoint
    });
    edges.push({ from: component.id, to: nodeId, type: "CALLS" });
  }
}

function capabilityNodeId(capability: Capability): string {
  return `cap.${capability}`;
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const result: GraphEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}:${edge.to}:${edge.type}:${edge.evidence?.file ?? ""}:${edge.evidence?.line ?? ""}:${edge.evidence?.pattern ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(edge);
  }
  return result;
}
