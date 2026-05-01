#!/usr/bin/env node
import fs from "node:fs/promises";
import { Command } from "commander";
import { scanWorkspace } from "./core/scanWorkspace.js";
import type { ScanResult } from "./core/types.js";
import { diffScanFiles } from "./diff/diffEngine.js";
import { formatDiffSummary, formatScanSummary } from "./output/consoleFormatter.js";
import { stableJson, writeJsonFile, writeScanOutputs } from "./output/jsonWriter.js";
import { renderMarkdownReport } from "./output/markdownReport.js";

interface GlobalOptions {
  json?: boolean;
  noColor?: boolean;
  quiet?: boolean;
  output?: string;
  allowMcpExec?: boolean;
}

const program = new Command();

program
  .name("whattheagent")
  .alias("wta")
  .description("Show what your AI agent can actually do by discovering local capabilities and risky chains.")
  .version("0.1.0");

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
