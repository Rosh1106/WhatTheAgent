import path from "node:path";
import type { Capability, Component, Finding, GraphEdge, GraphNode, RiskChain } from "../core/types.js";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function relativePath(root: string, filePath: string): string {
  return toPosixPath(path.relative(root, filePath));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stableId(prefix: string, value: string): string {
  const slug = slugify(value);
  return slug ? `${prefix}.${slug}` : `${prefix}.root`;
}

export function sortComponents(components: Component[]): Component[] {
  return [...components].sort((a, b) => a.id.localeCompare(b.id));
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const left = `${a.componentId}:${a.capability}:${a.evidence.file}:${a.evidence.line ?? 0}:${a.evidence.pattern}:${a.id}`;
    const right = `${b.componentId}:${b.capability}:${b.evidence.file}:${b.evidence.line ?? 0}:${b.evidence.pattern}:${b.id}`;
    return left.localeCompare(right);
  });
}

export function sortRiskChains(chains: RiskChain[]): RiskChain[] {
  return [...chains].sort((a, b) => a.id.localeCompare(b.id));
}

export function sortGraphNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

export function sortGraphEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((a, b) => {
    const left = `${a.from}:${a.type}:${a.to}:${a.evidence?.file ?? ""}:${a.evidence?.line ?? 0}:${a.evidence?.pattern ?? ""}`;
    const right = `${b.from}:${b.type}:${b.to}:${b.evidence?.file ?? ""}:${b.evidence?.line ?? 0}:${b.evidence?.pattern ?? ""}`;
    return left.localeCompare(right);
  });
}

export function uniqueCapabilities(findings: Finding[]): Capability[] {
  return [...new Set(findings.map((finding) => finding.capability))].sort();
}

export function compactSnippet(line: string): string {
  return line.trim().replace(/\s+/g, " ").slice(0, 160);
}
