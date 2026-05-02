import path from "node:path";
import type { Component, Finding } from "../core/types.js";
import { classifyCapability } from "../risk/classifier.js";
import { compactSnippet, relativePath, stableId } from "../utils/normalize.js";
import { scriptPatterns } from "../utils/patterns.js";
import { readTextFileForScan, skippedMetadata } from "../utils/safeRead.js";

export interface ScriptScanResult {
  component: Component;
  findings: Finding[];
}

export async function scanScript(root: string, scriptPath: string, parentId?: string): Promise<ScriptScanResult> {
  const relPath = relativePath(root, scriptPath);
  const label = path.basename(scriptPath);
  const componentId = stableId("script", relPath);
  const safeRead = await readTextFileForScan(scriptPath);
  const component: Component = {
    id: componentId,
    type: "script",
    label,
    path: relPath,
    parentId,
    metadata: {
      extension: path.extname(scriptPath),
      parentId,
      ...(safeRead.skipped ? skippedMetadata(safeRead.skipped) : {})
    }
  };

  if (safeRead.skipped) {
    return {
      component,
      findings: [{
        id: stableId("finding", `${componentId}-skipped-large-file`),
        componentId,
        capability: "read_file",
        risk: "low",
        evidence: {
          file: relPath,
          pattern: "skipped:large-file",
          snippet: `Skipped script larger than ${safeRead.skipped.maxBytes} bytes`
        }
      }]
    };
  }

  const content = safeRead.content ?? "";
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const candidate of scriptPatterns) {
      if (!candidate.regex.test(line)) continue;
      findings.push({
        id: stableId("finding", `${componentId}-${candidate.capability}-${index + 1}-${candidate.pattern}`),
        componentId,
        capability: candidate.capability,
        risk: classifyCapability(candidate.capability),
        evidence: {
          file: relPath,
          line: index + 1,
          snippet: compactSnippet(line),
          pattern: candidate.pattern
        }
      });
    }
  });

  return {
    component,
    findings
  };
}
