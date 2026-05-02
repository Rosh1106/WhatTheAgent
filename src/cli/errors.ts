import type { GlobalOptions } from "./options.js";

export async function handleErrors(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`WhatTheAgent error: ${message}\n`);
    process.exitCode = 1;
  }
}

export function printMcpExecReserved(options: GlobalOptions): void {
  if (options.quiet) return;
  process.stderr.write("MCP execution mode is reserved for a future version.\n");
}
