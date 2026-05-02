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
    goal: "Help a coding agent make safe, reviewable changes that reduce meaningful agent capability/control gaps.",
    workspace: result.workspace,
    workspaceSummary: `${result.inventory.counts.skills} skills, ${result.inventory.counts.toolServers} MCP servers, ${result.inventory.counts.scripts} scripts, ${result.summary.controlGapCount} control gaps, ${result.riskChains.length} risk chains.`,
    needsAttention: [
      ...result.riskChains.map((chain) => ({
        id: chain.id,
        componentId: chain.componentId,
        title: chain.name,
        impact: chain.impact,
        message: chain.message,
        capabilities: chain.capabilities,
        evidence: chain.evidence.slice(0, 5)
      })),
      ...result.controlGaps.slice(0, 50).map((gap) => ({
        id: gap.id,
        componentId: gap.componentId,
        title: gap.control,
        impact: gap.impact,
        message: gap.message,
        evidence: gap.evidence
      }))
    ],
    expected: result.expected,
    fixableTasks: result.implementationTasks.slice(0, 50),
    doNotDo: [
      "Do not remove useful agent functionality unless the user explicitly approves.",
      "Do not execute real external sends, payments, MCP servers, or destructive commands while fixing.",
      "Do not print, persist, or upload secrets."
    ],
    verificationCommands: ["npm run typecheck", "npm run build", "npm run dev -- understand ."]
  });
  await fs.writeFile(fixPlanFile, renderFixPlan(result), "utf8");
  await fs.writeFile(htmlFile, renderHtmlReport(result), "utf8");

  return [understandFile, graphFile, fixPlanFile, htmlFile, agentContextFile];
}

function stripJsonExtension(filePath: string): string {
  return filePath.endsWith(".json") ? filePath.slice(0, -".json".length) : filePath;
}
