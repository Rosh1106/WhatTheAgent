#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { planWorkspace } from "./core/planWorkspace.js";
import { buildProbePlan } from "./core/probePlan.js";
import { buildRuntimePlan } from "./core/runtimePlan.js";
import { scanWorkspace } from "./core/scanWorkspace.js";
import type { AgentPlanTarget, RuntimeMode, ScanResult } from "./core/types.js";
import { understandWorkspace } from "./core/understandWorkspace.js";
import { diffScanFiles } from "./diff/diffEngine.js";
import { formatAgentPlanSummary, formatDiffSummary, formatProbePlanSummary, formatRuntimePlanSummary, formatScanSummary, formatUnderstandSummary } from "./output/consoleFormatter.js";
import { renderFixPlan } from "./output/fixPlan.js";
import { renderHtmlReport } from "./output/htmlReport.js";
import { stableJson, writeJsonFile, writeScanOutputs, writeUnderstandOutputs } from "./output/jsonWriter.js";
import { renderMarkdownReport } from "./output/markdownReport.js";

interface GlobalOptions {
  json?: boolean;
  noColor?: boolean;
  quiet?: boolean;
  output?: string;
  allowMcpExec?: boolean;
  html?: boolean;
  forAgent?: boolean;
  forCodex?: boolean;
  forClaude?: boolean;
  ui?: boolean;
  mode?: RuntimeMode;
}

const program = new Command();

program
  .name("whattheagent")
  .alias("wta")
  .description("Show what your AI agent can actually do by discovering local capabilities and risky chains.")
  .version("0.1.0");

program
  .command("understand")
  .argument("<workspace>", "workspace to understand")
  .option("--json", "print deterministic understand JSON")
  .option("--html", "print self-contained HTML report")
  .option("--ui", "write the local HTML workbench bundle and print its path")
  .option("--for-agent", "print agent implementation fix plan")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <dir>", "write understand outputs to a directory", ".wta")
  .option("--allow-mcp-exec", "reserved for future MCP execution mode")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const result = await understandWorkspace(workspace, { allowMcpExec: options.allowMcpExec });
      const outputDir = options.output ? path.resolve(options.output) : path.resolve(workspace, ".wta");
      const filesWritten = await writeUnderstandOutputs(outputDir, result);
      if (options.quiet) return;
      if (options.ui) {
        process.stdout.write(`WhatTheAgent UI bundle written\n\n- ${path.join(outputDir, "report.html")}\n`);
        return;
      }
      if (options.json) {
        process.stdout.write(stableJson(result));
        return;
      }
      if (options.html) {
        process.stdout.write(renderHtmlReport(result));
        return;
      }
      if (options.forAgent) {
        process.stdout.write(renderFixPlan(result));
        return;
      }
      process.stdout.write(formatUnderstandSummary(result, { filesWritten }));
    });
  });

program
  .command("plan")
  .argument("<workspace>", "workspace to generate an implementation plan for")
  .option("--for-codex", "target the plan to Codex")
  .option("--for-claude", "target the plan to Claude Code")
  .option("--json", "print deterministic plan JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write plan JSON to a file")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const target = planTarget(options);
      const plan = await planWorkspace(workspace, target);
      if (options.output) await writeJsonFile(options.output, plan);
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson(plan) : formatAgentPlanSummary(plan));
    });
  });

program
  .command("probe")
  .argument("<workspace>", "workspace to generate a sandbox probe plan for")
  .option("--json", "print deterministic probe plan JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write probe plan JSON to a file")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const probePlan = await buildProbePlan(workspace);
      if (options.output) await writeJsonFile(options.output, probePlan);
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson(probePlan) : formatProbePlanSummary(probePlan));
    });
  });

program
  .command("runtime")
  .argument("<workspace>", "workspace to generate a runtime protection preview for")
  .option("--mode <mode>", "runtime mode: observe, warn, approval, enforce", "observe")
  .option("--json", "print deterministic runtime plan JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write runtime plan JSON to a file")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const mode = runtimeMode(options.mode);
      const runtimePlan = await buildRuntimePlan(workspace, mode);
      if (options.output) await writeJsonFile(options.output, runtimePlan);
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson(runtimePlan) : formatRuntimePlanSummary(runtimePlan));
    });
  });

program
  .command("scan")
  .argument("<workspace>", "workspace to scan")
  .option("--json", "print deterministic JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write scan JSON plus graph and Markdown report")
  .option("--allow-mcp-exec", "reserved for future MCP execution mode")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const scan = await scanWorkspace(workspace, { allowMcpExec: options.allowMcpExec });
      const filesWritten = options.output ? await writeScanOutputs(options.output, scan) : [];
      if (options.quiet) return;
      if (options.json) {
        process.stdout.write(stableJson(scan));
        return;
      }
      process.stdout.write(formatScanSummary(scan, { filesWritten }));
    });
  });

program
  .command("graph")
  .argument("<workspace>", "workspace to scan")
  .option("--json", "print deterministic graph JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write graph JSON")
  .option("--allow-mcp-exec", "reserved for future MCP execution mode")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const scan = await scanWorkspace(workspace, { allowMcpExec: options.allowMcpExec });
      if (options.output) await writeJsonFile(options.output, scan.graph);
      if (options.quiet) return;
      if (options.json || !options.output) {
        process.stdout.write(stableJson(scan.graph));
        return;
      }
      process.stdout.write(`WhatTheAgent graph written\n\n- ${options.output}\n`);
    });
  });

program
  .command("diff")
  .argument("<oldScan>", "old scan JSON file")
  .argument("<newScan>", "new scan JSON file")
  .option("--json", "print deterministic diff JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write diff JSON")
  .action(async (oldScan: string, newScan: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const diff = await diffScanFiles(oldScan, newScan);
      if (options.output) await writeJsonFile(options.output, diff);
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson(diff) : formatDiffSummary(diff));
    });
  });

program
  .command("report")
  .argument("<scanFile>", "scan JSON file")
  .option("--json", "print report data as JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write Markdown report")
  .action(async (scanFile: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const scan = await readScan(scanFile);
      const markdown = renderMarkdownReport(scan);
      if (options.output) await fs.writeFile(options.output, markdown, "utf8");
      if (options.quiet) return;
      if (options.json) {
        process.stdout.write(stableJson({
          summary: scan.summary,
          riskChains: scan.riskChains,
          findings: scan.findings
        }));
        return;
      }
      process.stdout.write(markdown);
    });
  });

await program.parseAsync(process.argv);

async function readScan(filePath: string): Promise<ScanResult> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as ScanResult;
}

async function handleErrors(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`WhatTheAgent error: ${message}\n`);
    process.exitCode = 1;
  }
}

function printMcpExecReserved(options: GlobalOptions): void {
  if (options.quiet) return;
  process.stderr.write("MCP execution mode is reserved for a future version.\n");
}

function planTarget(options: GlobalOptions): AgentPlanTarget {
  if (options.forCodex) return "codex";
  if (options.forClaude) return "claude";
  return "generic";
}

function runtimeMode(value: RuntimeMode | undefined): RuntimeMode {
  if (value === "observe" || value === "warn" || value === "approval" || value === "enforce") return value;
  throw new Error(`Invalid runtime mode: ${value}. Expected observe, warn, approval, or enforce.`);
}
