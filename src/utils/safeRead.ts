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

// Hardening note: we open once and use the file *descriptor* for both the
// size check and the read. CodeQL js/file-system-race (CWE-367) flagged the
// previous version, which stat-ed the path and then read it again, as a
// TOCTOU race: between the stat and the read, an attacker could swap the
// file at `filePath`, bypassing the size cap. Practical exploitability in
// our threat model is limited (an attacker who can swap files in the scan
// tree already controls content directly), but pinning the inode is the
// correct, cheap fix. The descriptor is closed in a finally so a failure
// during stat or read does not leak handles.
export async function readTextFileForScan(filePath: string, maxBytes = MAX_SCAN_FILE_BYTES): Promise<SafeReadResult> {
  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
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
      content: await handle.readFile("utf8")
    };
  } finally {
    await handle.close();
  }
}

export function skippedMetadata(skipped: SafeReadSkipped): Record<string, unknown> {
  return {
    skipped: true,
    skipReason: skipped.reason,
    sizeBytes: skipped.sizeBytes,
    maxBytes: skipped.maxBytes
  };
}
