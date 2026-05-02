import fs from "node:fs/promises";
import path from "node:path";
import type { CapabilityGraph, ScanResult, UnderstandResult } from "../core/types.js";
import { renderFixPlan } from "./fixPlan.js";
import { renderHtmlReport } from "./htmlReport.js";
import { renderMarkdownReport } from "./markdownReport.js";

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await fs.writeFile(filePath, stableJson(value), "utf8");
}

export async function writeScanOutputs(outputFile: string, scan: ScanResult): Promise<string[]> {
  const base = stripJsonExtension(outputFile);
  const scanFile = outputFile;
  const graphFile = `${base}.graph.json`;
  const reportFile = `${base}.risk-report.md`;

  await writeJsonFile(scanFile, scan);
  await writeJsonFile(graphFile, scan.graph satisfies CapabilityGraph);
  await fs.writeFile(reportFile, renderMarkdownReport(scan), "utf8");

  return [scanFile, graphFile, reportFile];
}

export async function writeUnderstandOutputs(outputDir: string, result: UnderstandResult): Promise<string[]> {
  const resolvedDir = path.resolve(outputDir);
  const understandFile = path.join(resolvedDir, "understand.json");
  const graphFile = path.join(resolvedDir, "capability-graph.json");
  const fixPlanFile = path.join(resolvedDir, "fix-plan.md");
  const htmlFile = path.join(resolvedDir, "report.html");
  const agentContextFile = path.join(resolvedDir, "agent-context.json");

  await fs.mkdir(resolvedDir, { recursive: true });
  await writeJsonFile(understandFile, result);
  await writeJsonFile(graphFile, result.graph satisfies CapabilityGraph);
  await writeJsonFile(agentContextFile, {
    schemaVersion: result.schemaVersion,
    workspace: result.workspace,
    controlGaps: result.controlGaps,
    quickFixes: result.quickFixes,
    implementationTasks: result.implementationTasks,
    riskChains: result.riskChains
  });
  await fs.writeFile(fixPlanFile, renderFixPlan(result), "utf8");
  await fs.writeFile(htmlFile, renderHtmlReport(result), "utf8");

  return [understandFile, graphFile, fixPlanFile, htmlFile, agentContextFile];
}

function stripJsonExtension(filePath: string): string {
  return filePath.endsWith(".json") ? filePath.slice(0, -".json".length) : filePath;
}
