#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { wellKnownClients } from "./clients/wellKnownClients.js";
import { planWorkspace } from "./core/planWorkspace.js";
import { createPersonalAgentBaseline, diffPersonalAgentBaseline, starterPolicy, writePersonalBaselineOutputs, writePersonalDiffOutputs, writeStarterPolicy } from "./core/personalAgentBaseline.js";
import { buildProbePlan } from "./core/probePlan.js";
import { buildRuntimePlan } from "./core/runtimePlan.js";
import { scanWorkspace } from "./core/scanWorkspace.js";
import type { AgentPlanTarget, AgentProfile, RuntimeMode, ScanResult } from "./core/types.js";
import { understandWorkspace } from "./core/understandWorkspace.js";
import { diffScanFiles } from "./diff/diffEngine.js";
import { formatAgentPlanSummary, formatCompatibilitySummary, formatDiffSummary, formatProbePlanSummary, formatRuntimePlanSummary, formatScanSummary, formatUnderstandSummary } from "./output/consoleFormatter.js";
import { renderFixPlan } from "./output/fixPlan.js";
import { renderHtmlReport } from "./output/htmlReport.js";
import { stableJson, writeJsonFile, writeScanOutputs, writeUnderstandOutputs } from "./output/jsonWriter.js";
import { renderMarkdownReport } from "./output/markdownReport.js";
import { formatPersonalBaselineDiffSummary, formatPersonalBaselineSummary } from "./output/personalAgentFormatter.js";

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
  profile?: AgentProfile;
  baseline?: string;
  force?: boolean;
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
  .option("--profile <profile>", "workspace profile: workspace, personal-agent, openclaw, or hermes", "workspace")
  .option("--allow-mcp-exec", "reserved for future MCP execution mode")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const result = await understandWorkspace(workspace, { allowMcpExec: options.allowMcpExec, profile: profileOption(options.profile) });
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
  .command("baseline")
  .argument("<workspace>", "personal-agent workspace to baseline")
  .option("--profile <profile>", "personal-agent profile: personal-agent, openclaw, or hermes", "personal-agent")
  .option("--json", "print deterministic baseline JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <dir>", "write baseline and policy proposal files", ".wta")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const profile = personalProfileOption(options.profile);
      const baseline = await createPersonalAgentBaseline(workspace, profile);
      const outputDir = options.output ? path.resolve(options.output) : path.resolve(workspace, ".wta");
      const filesWritten = await writePersonalBaselineOutputs(outputDir, baseline);
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson(baseline) : formatPersonalBaselineSummary(baseline, { filesWritten }));
    });
  });

program
  .command("diff-baseline")
  .argument("<workspace>", "personal-agent workspace to compare with baseline")
  .option("--baseline <file>", "baseline JSON file", ".wta/baseline.json")
  .option("--profile <profile>", "override personal-agent profile")
  .option("--json", "print deterministic baseline diff JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <dir>", "write baseline diff and policy proposal files", ".wta")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const baselineFile = path.resolve(workspace, options.baseline ?? ".wta/baseline.json");
      const profile = options.profile ? personalProfileOption(options.profile) : undefined;
      const diff = await diffPersonalAgentBaseline(workspace, baselineFile, profile);
      const outputDir = options.output ? path.resolve(options.output) : path.resolve(workspace, ".wta");
      const filesWritten = await writePersonalDiffOutputs(outputDir, diff);
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson(diff) : formatPersonalBaselineDiffSummary(diff, { filesWritten }));
    });
  });

program
  .command("init-policy")
  .argument("[workspace]", "workspace to initialize policy in", ".")
  .option("--profile <profile>", "policy profile: personal-agent, openclaw, or hermes", "personal-agent")
  .option("--json", "print policy payload as JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write policy to this file")
  .option("--force", "overwrite an existing policy file")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const profile = personalProfileOption(options.profile);
      const outputFile = path.resolve(workspace, options.output ?? "wta.policy.yaml");
      if (options.json) {
        const payload = { schemaVersion: "0.1", profile, file: outputFile, yaml: starterPolicy(profile) };
        if (options.output) await writeJsonFile(`${outputFile}.json`, payload);
        if (!options.quiet) process.stdout.write(stableJson(payload));
        return;
      }
      await writeStarterPolicy(outputFile, profile, Boolean(options.force));
      if (options.quiet) return;
      process.stdout.write(`WhatTheAgent policy starter written\n\n- ${outputFile}\n`);
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
  .command("compatibility")
  .description("list well-known agent clients and local files WhatTheAgent checks")
  .option("--json", "print deterministic known-client JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write compatibility JSON to a file")
  .action(async (options: GlobalOptions) => {
    await handleErrors(async () => {
      const result = {
        schemaVersion: "0.1",
        knownClients: wellKnownClients
      };
      if (options.output) await writeJsonFile(options.output, result);
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson(result) : formatCompatibilitySummary(result));
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
  .option("--profile <profile>", "workspace profile: workspace, personal-agent, openclaw, or hermes", "workspace")
  .option("--allow-mcp-exec", "reserved for future MCP execution mode")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const scan = await scanWorkspace(workspace, { allowMcpExec: options.allowMcpExec, profile: profileOption(options.profile) });
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
  .option("--profile <profile>", "workspace profile: workspace, personal-agent, openclaw, or hermes", "workspace")
  .option("--allow-mcp-exec", "reserved for future MCP execution mode")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const scan = await scanWorkspace(workspace, { allowMcpExec: options.allowMcpExec, profile: profileOption(options.profile) });
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

function profileOption(value: AgentProfile | undefined): AgentProfile {
  if (value === undefined) return "workspace";
  if (value === "workspace" || value === "personal-agent" || value === "openclaw" || value === "hermes") return value;
  throw new Error(`Invalid profile: ${value}. Expected workspace, personal-agent, openclaw, or hermes.`);
}

function personalProfileOption(value: AgentProfile | undefined): AgentProfile {
  const profile = profileOption(value ?? "personal-agent");
  if (profile === "workspace") {
    throw new Error("Personal-agent commands require personal-agent, openclaw, or hermes profile.");
  }
  return profile;
}
