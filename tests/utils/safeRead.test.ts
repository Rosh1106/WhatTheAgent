import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readTextFileForScan } from "../../src/utils/safeRead.js";

let workdir: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-safe-read-"));
});

afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

describe("readTextFileForScan", () => {
  it("returns file content for a normal small file", async () => {
    const file = path.join(workdir, "ordinary.md");
    await fs.writeFile(file, "hello world");
    const result = await readTextFileForScan(file);
    expect(result.skipped).toBeUndefined();
    expect(result.content).toBe("hello world");
  });

  it("returns the skipped marker when the file exceeds the byte cap", async () => {
    const file = path.join(workdir, "big.md");
    await fs.writeFile(file, "x".repeat(200));
    const result = await readTextFileForScan(file, 100);
    expect(result.content).toBeUndefined();
    expect(result.skipped?.reason).toBe("file_too_large");
    expect(result.skipped?.sizeBytes).toBe(200);
    expect(result.skipped?.maxBytes).toBe(100);
  });

  it("propagates errors when the file does not exist", async () => {
    await expect(readTextFileForScan(path.join(workdir, "missing.md"))).rejects.toThrow();
  });

  it("reads through a symlink that points to a file inside the same dir", async () => {
    // Sanity: ordinary intra-workspace symlinks must still resolve. (Cross-
    // workspace escapes are blocked one layer up in fileWalker, not here.)
    const target = path.join(workdir, "target.md");
    await fs.writeFile(target, "intra-link content");
    const link = path.join(workdir, "link.md");
    await fs.symlink(target, link);
    const result = await readTextFileForScan(link);
    expect(result.content).toBe("intra-link content");
  });

  it("CWE-367 defence: a path swap between size check and read does not let us read different bytes", async () => {
    // Regression for the js/file-system-race finding CodeQL raised on
    // safeRead.ts:29. The previous implementation stat-ed the path, then
    // read the path again. An attacker who could swap the inode between
    // the stat and the read could bypass the size cap. The fixed
    // implementation opens once and uses the descriptor for both ops, so
    // even a successful swap leaves us reading from the original inode.
    const file = path.join(workdir, "swap.md");
    await fs.writeFile(file, "original content");

    // Race the read against an unlink + replace with a much larger file.
    // Without descriptor pinning, the read would either bypass the size
    // cap or return the wrong content; with the fix, it returns the
    // original file's bytes deterministically.
    const swap = (async (): Promise<void> => {
      for (let i = 0; i < 50; i += 1) {
        try {
          await fs.unlink(file);
          await fs.writeFile(file, "x".repeat(10_000_000));
          return;
        } catch {
          // path may briefly not exist while readTextFileForScan opens it;
          // keep trying.
        }
      }
    })();

    const result = await readTextFileForScan(file, 1_000_000);
    await swap;

    // Either the read happened before the swap (content === original) or
    // after the open but the descriptor still pointed at the old inode
    // (content === original). The unacceptable outcome would be
    // content === a 10 MB blob; the size cap was 1 MB.
    if (result.skipped) {
      expect(result.skipped.sizeBytes).toBe("original content".length);
    } else {
      expect(result.content).toBe("original content");
    }
  });
});
