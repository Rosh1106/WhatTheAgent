import fs from "node:fs/promises";
import type { Component, DiffResult, Finding, GraphEdge, RiskChain, RiskLevel, ScanResult } from "../core/types.js";

export async function diffScanFiles(oldFile: string, newFile: string): Promise<DiffResult> {
  const [oldScan, newScan] = await Promise.all([readScan(oldFile), readScan(newFile)]);
  return diffScans(oldScan, newScan);
}

export function diffScans(oldScan: ScanResult, newScan: ScanResult): DiffResult {
  const oldComponents = mapBy(oldScan.components, (component) => component.id);
  const newComponents = mapBy(newScan.components, (component) => component.id);
  const oldFindings = mapBy(oldScan.findings, findingKey);
  const newFindings = mapBy(newScan.findings, findingKey);
  const oldEdges = mapBy(oldScan.graph.edges, edgeKey);
  const newEdges = mapBy(newScan.graph.edges, edgeKey);
  const oldChains = mapBy(oldScan.riskChains, chainKey);
  const newChains = mapBy(newScan.riskChains, chainKey);

  return {
    addedComponents: added(oldComponents, newComponents),
    removedComponents: removed(oldComponents, newComponents),
    addedCapabilities: added(oldFindings, newFindings),
    removedCapabilities: removed(oldFindings, newFindings),
    addedGraphEdges: added(oldEdges, newEdges),
    removedGraphEdges: removed(oldEdges, newEdges),
    addedRiskChains: added(oldChains, newChains),
    removedRiskChains: removed(oldChains, newChains),
    riskLevelChanges: riskChanges(oldFindings, newFindings)
  };
}

async function readScan(filePath: string): Promise<ScanResult> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as ScanResult;
}

function mapBy<T>(values: T[], keyFn: (value: T) => string): Map<string, T> {
  return new Map(values.map((value) => [keyFn(value), value]));
}

function added<T>(oldItems: Map<string, T>, newItems: Map<string, T>): T[] {
  return [...newItems.entries()]
    .filter(([key]) => !oldItems.has(key))
    .map(([, value]) => value);
}

function removed<T>(oldItems: Map<string, T>, newItems: Map<string, T>): T[] {
  return [...oldItems.entries()]
    .filter(([key]) => !newItems.has(key))
    .map(([, value]) => value);
}

function findingKey(finding: Finding): string {
  return `${finding.componentId}:${finding.capability}:${finding.evidence.file}:${finding.evidence.line ?? ""}:${finding.evidence.pattern}`;
}

function edgeKey(edge: GraphEdge): string {
  return `${edge.from}:${edge.to}:${edge.type}:${edge.evidence?.file ?? ""}:${edge.evidence?.line ?? ""}:${edge.evidence?.pattern ?? ""}`;
}

function chainKey(chain: RiskChain): string {
  return `${chain.componentId}:${chain.name}:${chain.capabilities.join("+")}`;
}

function riskChanges(oldFindings: Map<string, Finding>, newFindings: Map<string, Finding>) {
  const changes: Array<{
    componentId: string;
    capability: Finding["capability"];
    from: RiskLevel;
    to: RiskLevel;
    evidence: Finding["evidence"];
  }> = [];

  for (const [key, oldFinding] of oldFindings) {
    const newFinding = newFindings.get(key);
    if (!newFinding || oldFinding.risk === newFinding.risk) continue;
    changes.push({
      componentId: newFinding.componentId,
      capability: newFinding.capability,
      from: oldFinding.risk,
      to: newFinding.risk,
      evidence: newFinding.evidence
    });
  }

  return changes;
}
