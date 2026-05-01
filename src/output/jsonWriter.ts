import fs from "node:fs/promises";
import path from "node:path";
import type { CapabilityGraph, ScanResult } from "../core/types.js";
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

function stripJsonExtension(filePath: string): string {
  return filePath.endsWith(".json") ? filePath.slice(0, -".json".length) : filePath;
}
