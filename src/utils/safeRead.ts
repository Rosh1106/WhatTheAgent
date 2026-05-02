import fs from "node:fs/promises";

export const MAX_SCAN_FILE_BYTES = 1_000_000;

export interface SafeReadSkipped {
  reason: "file_too_large";
  sizeBytes: number;
  maxBytes: number;
}

export interface SafeReadResult {
  content?: string;
  skipped?: SafeReadSkipped;
}

export async function readTextFileForScan(filePath: string, maxBytes = MAX_SCAN_FILE_BYTES): Promise<SafeReadResult> {
  const stat = await fs.stat(filePath);
  if (stat.size > maxBytes) {
    return {
      skipped: {
        reason: "file_too_large",
        sizeBytes: stat.size,
        maxBytes
      }
    };
  }

  return {
    content: await fs.readFile(filePath, "utf8")
  };
}

export function skippedMetadata(skipped: SafeReadSkipped): Record<string, unknown> {
  return {
    skipped: true,
    skipReason: skipped.reason,
    sizeBytes: skipped.sizeBytes,
    maxBytes: skipped.maxBytes
  };
}
