import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findFiles, normalizeUserPattern } from "../../src/utils/fileWalker.js";

let workdir: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-walk-"));
});

afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

async function touch(relative: string): Promise<void> {
  const file = path.join(workdir, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, "");
}

describe("findFiles", () => {
  it("respects user-supplied exclude patterns", async () => {
    await touch("kept/SKILL.md");
    await touch("vendor/SKILL.md");
    const before = await findFiles(workdir, "**/SKILL.md");
    expect(before.length).toBe(2);
    const after = await findFiles(workdir, "**/SKILL.md", ["**/vendor/**"]);
    expect(after.length).toBe(1);
    expect(after[0]?.endsWith("kept/SKILL.md")).toBe(true);
  });

  it("normalizes a bare directory name into a glob pattern", async () => {
    await touch("kept/SKILL.md");
    await touch("ignored/SKILL.md");
    const after = await findFiles(workdir, "**/SKILL.md", ["ignored"]);
    expect(after.length).toBe(1);
    expect(after[0]?.endsWith("kept/SKILL.md")).toBe(true);
  });

  it("still applies the built-in default ignores", async () => {
    await touch("kept/SKILL.md");
    await touch("node_modules/foo/SKILL.md");
    const result = await findFiles(workdir, "**/SKILL.md");
    expect(result.length).toBe(1);
  });

  it("does not follow symlinks that point outside the scan root", async () => {
    // Regression test for the symlink-escape disclosure: a malicious workspace
    // must NOT be able to make the scanner read files outside the scan root by
    // shipping a symlink (e.g. SKILL.md -> ~/.ssh/id_rsa). Confirmed against
    // the empirical PoC that motivated this fix.
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-walk-outside-"));
    try {
      const outsideFile = path.join(outsideDir, "leaked.md");
      await fs.writeFile(outsideFile, "secret-data-that-must-not-be-scanned");

      const insideDir = path.join(workdir, "skill-pack");
      await fs.mkdir(insideDir, { recursive: true });
      await fs.symlink(outsideFile, path.join(insideDir, "SKILL.md"));

      const matches = await findFiles(workdir, "**/SKILL.md");
      expect(matches).toEqual([]);
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("does not follow symlinked directories that escape the scan root", async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-walk-outside-dir-"));
    try {
      await fs.mkdir(path.join(outsideDir, "sneaky"), { recursive: true });
      await fs.writeFile(path.join(outsideDir, "sneaky", "SKILL.md"), "");
      await fs.symlink(outsideDir, path.join(workdir, "linked-vendor"));

      const matches = await findFiles(workdir, "**/SKILL.md");
      expect(matches).toEqual([]);
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("still scans regular files inside the scan root after the symlink protection", async () => {
    // Sanity: locking down symlinks must not break ordinary intra-workspace scanning.
    await touch("a/SKILL.md");
    await touch("b/c/SKILL.md");
    const matches = await findFiles(workdir, "**/SKILL.md");
    expect(matches.length).toBe(2);
  });
});

describe("normalizeUserPattern", () => {
  it("wraps a bare directory name in **/dir/**", () => {
    expect(normalizeUserPattern("vendor")).toBe("**/vendor/**");
  });

  it("strips leading ./", () => {
    expect(normalizeUserPattern("./vendor")).toBe("**/vendor/**");
  });

  it("strips trailing slash", () => {
    expect(normalizeUserPattern("vendor/")).toBe("**/vendor/**");
  });

  it("preserves explicit globs unchanged", () => {
    expect(normalizeUserPattern("**/scratch/**")).toBe("**/scratch/**");
    expect(normalizeUserPattern("**/*.tmp")).toBe("**/*.tmp");
    expect(normalizeUserPattern("foo/*.bak")).toBe("foo/*.bak");
  });
});
