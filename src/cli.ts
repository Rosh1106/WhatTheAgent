#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { wellKnownClients } from "./clients/wellKnownClients.js";
import { planWorkspace } from "./core/planWorkspace.js";
import { ackBatchInPolicy, ackInPolicy, parseAckBatchInput, readJsonFromStdin, readReasonFromStdin } from "./core/ackPolicy.js";
import { createPersonalAgentBaseline, diffPersonalAgentBaseline, seededPolicyFromScan, starterPolicy, writePersonalBaselineOutputs, writePersonalDiffOutputs, writePolicyContent } from "./core/personalAgentBaseline.js";
import { scanWorkspace } from "./core/scanWorkspace.js";
import type { AgentPlanTarget, AgentProfile, ScanResult } from "./core/types.js";
import { understandWorkspace } from "./core/understandWorkspace.js";
import { diffScanFiles } from "./diff/diffEngine.js";
import { formatAgentPlanSummary, formatCompatibilitySummary, formatDiffSummary, formatScanSummary, formatUnderstandSummary } from "./output/consoleFormatter.js";
import { renderAgentInstructions, type AgentInstructionTarget } from "./output/agentInstructions.js";
import { renderFixPlan } from "./output/fixPlan.js";
import { renderHtmlReport } from "./output/htmlReport.js";
import { buildChatSummaryForDiff, buildChatSummaryForUnderstand, buildSarifReportForUnderstand, stableJson, writeChatSummary, writeJsonFile, writeScanOutputs, writeUnderstandOutputs } from "./output/jsonWriter.js";
import { evaluateFailOn, parseFailOnThreshold } from "./core/failOn.js";
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
  forOpenclaw?: boolean;
  forHermes?: boolean;
  ui?: boolean;
  profile?: AgentProfile;
  baseline?: string;
  force?: boolean;
  exclude?: string[];
  open?: boolean;
  fromScan?: boolean;
  reason?: string;
  reasonFromStdin?: boolean;
  policy?: string;
  workspace?: string;
  chat?: boolean;
  sarif?: boolean;
  failOn?: string;
}

function collectExclude(value: string, previous: string[] = []): string[] {
  return [...previous, ...value.split(",").map((entry) => entry.trim()).filter(Boolean)];
}

const program = new Command();

program
  .name("whattheagent")
  .alias("wta")
  .description("Show what your AI agent can actually do by discovering local capabilities and risky chains.")
  .version("0.3.0");

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
  .option("--exclude <pattern>", "extra glob pattern to ignore (repeatable, comma-separated)", collectExclude, [])
  .option("--open", "open the rendered HTML report in the default browser")
  .option("--chat", "emit a phone-readable chat summary plus an actions JSON for personal-agent integrations")
  .option("--sarif", "emit SARIF 2.1.0 to stdout (for GitHub Code Scanning and other SARIF consumers)")
  .option("--fail-on <level>", "exit non-zero if findings >= level (none|low|medium|high|critical). Default: none.", "none")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const failOnThreshold = parseFailOnThreshold(options.failOn);
      const result = await understandWorkspace(workspace, { allowMcpExec: options.allowMcpExec, profile: profileOption(options.profile), excludePatterns: options.exclude });
      const outputDir = options.output ? path.resolve(options.output) : path.resolve(workspace, ".wta");
      const filesWritten = await writeUnderstandOutputs(outputDir, result);
      const chatSummary = options.chat ? buildChatSummaryForUnderstand(result) : undefined;
      if (chatSummary) {
        const chatFiles = await writeChatSummary(outputDir, chatSummary);
        filesWritten.push(...chatFiles);
      }
      if (options.open) await openInBrowser(path.join(outputDir, "report.html"));
      const failOn = evaluateFailOn(result, failOnThreshold);
      const writeStdout = (text: string): void => { if (!options.quiet) process.stdout.write(text); };

      if (options.sarif) {
        writeStdout(stableJson(buildSarifReportForUnderstand(result)));
        applyFailOn(failOn);
        return;
      }
      if (options.quiet) {
        applyFailOn(failOn);
        return;
      }
      if (options.ui) {
        writeStdout(`WhatTheAgent UI bundle written\n\n- ${path.join(outputDir, "report.html")}\n`);
        applyFailOn(failOn);
        return;
      }
      if (chatSummary && !options.json && !options.html && !options.forAgent) {
        writeStdout(`${chatSummary.message}\n`);
        applyFailOn(failOn);
        return;
      }
      if (options.json) {
        writeStdout(stableJson(chatSummary ?? result));
        applyFailOn(failOn);
        return;
      }
      if (options.html) {
        writeStdout(renderHtmlReport(result));
        applyFailOn(failOn);
        return;
      }
      if (options.forAgent) {
        writeStdout(renderFixPlan(result));
        applyFailOn(failOn);
        return;
      }
      writeStdout(formatUnderstandSummary(result, { filesWritten }));
      applyFailOn(failOn);
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
  .option("--chat", "emit a phone-readable chat summary plus an actions JSON for personal-agent integrations")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const baselineFile = path.resolve(workspace, options.baseline ?? ".wta/baseline.json");
      const profile = options.profile ? personalProfileOption(options.profile) : undefined;
      const diff = await diffPersonalAgentBaseline(workspace, baselineFile, profile);
      const outputDir = options.output ? path.resolve(options.output) : path.resolve(workspace, ".wta");
      const filesWritten = await writePersonalDiffOutputs(outputDir, diff);
      const chatSummary = options.chat ? buildChatSummaryForDiff(diff) : undefined;
      if (chatSummary) {
        const chatFiles = await writeChatSummary(outputDir, chatSummary);
        filesWritten.push(...chatFiles);
      }
      if (options.quiet) return;
      if (chatSummary && !options.json) {
        process.stdout.write(`${chatSummary.message}\n`);
        return;
      }
      process.stdout.write(options.json ? stableJson(chatSummary ?? diff) : formatPersonalBaselineDiffSummary(diff, { filesWritten }));
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
  .option("--from-scan", "scan the workspace and pre-populate expected[] entries for every detected capability")
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      const profile = personalProfileOption(options.profile);
      const outputFile = path.resolve(workspace, options.output ?? "wta.policy.yaml");
      const seeded = options.fromScan ? await seededPolicyFromScan(workspace, profile) : undefined;
      const yaml = seeded?.yaml ?? starterPolicy(profile);
      if (options.json) {
        const payload = { schemaVersion: "0.1", profile, file: outputFile, yaml, expectedCount: seeded?.expectedCount ?? 0 };
        if (options.output) await writeJsonFile(`${outputFile}.json`, payload);
        if (!options.quiet) process.stdout.write(stableJson(payload));
        return;
      }
      await writePolicyContent(outputFile, yaml, Boolean(options.force));
      if (options.quiet) return;
      const seedNote = seeded ? ` (${seeded.expectedCount} expected entries seeded from scan)` : "";
      process.stdout.write(`WhatTheAgent policy written${seedNote}\n\n- ${outputFile}\n`);
    });
  });

program
  .command("ack")
  .argument("<component>", "component id to acknowledge (e.g. mcp.burp or skill.invoice-review)")
  .argument("[capability]", "optional capability (e.g. execute_code). If omitted, all detected capabilities are acknowledged.")
  .option("--reason <text>", "required justification recorded in the policy entry")
  .option("--reason-from-stdin", "read the reason from stdin (use to avoid shell-escape issues)")
  .option("--policy <file>", "policy file to update", "wta.policy.yaml")
  .option("--workspace <dir>", "workspace to scan when resolving capabilities", ".")
  .option("--json", "print result as JSON")
  .option("--quiet", "suppress stdout")
  .action(async (component: string, capability: string | undefined, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.reasonFromStdin && options.reason) {
        throw new Error("Pass either --reason or --reason-from-stdin, not both.");
      }
      const reason = options.reasonFromStdin ? await readReasonFromStdin() : options.reason;
      if (!reason || !reason.trim()) {
        throw new Error("A reason is required (use --reason or --reason-from-stdin) to record why this capability is acknowledged.");
      }
      const workspaceRoot = path.resolve(options.workspace ?? ".");
      const policyFile = path.resolve(workspaceRoot, options.policy ?? "wta.policy.yaml");
      const result = await ackInPolicy({
        workspaceRoot,
        policyFile,
        componentId: component,
        capability: capability as never,
        reason
      });
      if (options.quiet) return;
      if (options.json) {
        process.stdout.write(stableJson(result));
        return;
      }
      const lines = [
        result.added.length > 0
          ? `Added ${result.added.length} expected ${result.added.length === 1 ? "entry" : "entries"} to ${policyFile}`
          : `No new entries added to ${policyFile} (already up to date)`,
        ""
      ];
      for (const entry of result.added) lines.push(`+ ${entry.componentId} · ${entry.capability}`);
      for (const entry of result.alreadyPresent) lines.push(`= ${entry.componentId} · ${entry.capability} (already in policy)`);
      if (!result.componentExists && result.added.length > 0) {
        lines.push("", `Note: component "${component}" was not found in the current scan; the entry was added anyway.`);
      }
      process.stdout.write(`${lines.join("\n")}\n`);
    });
  });

program
  .command("ack-batch")
  .description("acknowledge many components at once. Reads a JSON array of {componentId, capability?, reason?} from stdin.")
  .option("--reason <text>", "default reason applied to items that omit their own")
  .option("--policy <file>", "policy file to update", "wta.policy.yaml")
  .option("--workspace <dir>", "workspace to scan when resolving capabilities", ".")
  .option("--json", "print result as JSON")
  .option("--quiet", "suppress stdout")
  .action(async (options: GlobalOptions) => {
    await handleErrors(async () => {
      const raw = await readJsonFromStdin();
      const items = parseAckBatchInput(raw);
      const workspaceRoot = path.resolve(options.workspace ?? ".");
      const policyFile = path.resolve(workspaceRoot, options.policy ?? "wta.policy.yaml");
      const result = await ackBatchInPolicy({
        workspaceRoot,
        policyFile,
        items,
        defaultReason: options.reason
      });
      if (options.quiet) return;
      if (options.json) {
        process.stdout.write(stableJson(result));
        return;
      }
      const lines = [
        result.added.length > 0
          ? `Added ${result.added.length} expected ${result.added.length === 1 ? "entry" : "entries"} to ${policyFile}`
          : `No new entries added to ${policyFile}`,
        `(${result.itemCount} item${result.itemCount === 1 ? "" : "s"} submitted, ${result.alreadyPresent.length} already in policy, ${result.skipped.length} skipped)`,
        ""
      ];
      for (const entry of result.added) lines.push(`+ ${entry.componentId} · ${entry.capability}`);
      for (const entry of result.alreadyPresent) lines.push(`= ${entry.componentId} · ${entry.capability} (already in policy)`);
      for (const entry of result.skipped) lines.push(`! ${entry.componentId}${entry.capability ? ` · ${entry.capability}` : ""} skipped: ${entry.reason}`);
      process.stdout.write(`${lines.join("\n")}\n`);
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
  .command("instructions")
  .description("print copy-paste instructions for agents to run WhatTheAgent safely")
  .option("--for-claude", "print Claude-focused instructions")
  .option("--for-codex", "print Codex-focused instructions")
  .option("--for-openclaw", "print OpenClaw skill-style instructions")
  .option("--for-hermes", "print Hermes skill-style instructions")
  .option("--json", "print deterministic instruction JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write instructions to a file")
  .action(async (options: GlobalOptions) => {
    await handleErrors(async () => {
      const target = instructionTarget(options);
      const instructions = renderAgentInstructions(target);
      if (options.output) await fs.writeFile(options.output, instructions, "utf8");
      if (options.quiet) return;
      process.stdout.write(options.json ? stableJson({ schemaVersion: "0.1", target, instructions }) : instructions);
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
  .command("scan")
  .argument("<workspace>", "workspace to scan")
  .option("--json", "print deterministic JSON")
  .option("--no-color", "disable color output")
  .option("--quiet", "suppress stdout")
  .option("--output <file>", "write scan JSON plus graph and Markdown report")
  .option("--profile <profile>", "workspace profile: workspace, personal-agent, openclaw, or hermes", "workspace")
  .option("--allow-mcp-exec", "reserved for future MCP execution mode")
  .option("--exclude <pattern>", "extra glob pattern to ignore (repeatable, comma-separated)", collectExclude, [])
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const scan = await scanWorkspace(workspace, { allowMcpExec: options.allowMcpExec, profile: profileOption(options.profile), excludePatterns: options.exclude });
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
  .option("--exclude <pattern>", "extra glob pattern to ignore (repeatable, comma-separated)", collectExclude, [])
  .action(async (workspace: string, options: GlobalOptions) => {
    await handleErrors(async () => {
      if (options.allowMcpExec) printMcpExecReserved(options);
      const scan = await scanWorkspace(workspace, { allowMcpExec: options.allowMcpExec, profile: profileOption(options.profile), excludePatterns: options.exclude });
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

async function openInBrowser(filePath: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "explorer.exe" : "xdg-open";
  try {
    const child = spawn(command, [filePath], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    process.stderr.write(`Could not open ${filePath} automatically.\n`);
  }
}

function applyFailOn(decision: { shouldFail: boolean; message: string }): void {
  // Always write the verdict to stderr so it doesn't pollute --json / --sarif
  // stdout pipelines, but is still visible in CI logs.
  process.stderr.write(`${decision.message}\n`);
  if (decision.shouldFail) {
    process.exitCode = 1;
  }
}

function planTarget(options: GlobalOptions): AgentPlanTarget {
  if (options.forCodex) return "codex";
  if (options.forClaude) return "claude";
  return "generic";
}

function instructionTarget(options: GlobalOptions): AgentInstructionTarget {
  if (options.forCodex) return "codex";
  if (options.forClaude) return "claude";
  if (options.forOpenclaw) return "openclaw";
  if (options.forHermes) return "hermes";
  return "generic";
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
