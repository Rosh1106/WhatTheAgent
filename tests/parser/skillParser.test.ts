import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSkill } from "../../src/parser/skillParser.js";

let workdir: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-skill-"));
});

afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

async function writeSkill(relPath: string, body: string): Promise<string> {
  const file = path.join(workdir, relPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
  return file;
}

describe("parseSkill", () => {
  it("parses frontmatter name and description", async () => {
    const file = await writeSkill("skills/x/SKILL.md", `---
name: invoice-review
description: Review invoices
---

Body here.
`);
    const parsed = await parseSkill(workdir, file);
    expect(parsed.component.label).toBe("invoice-review");
    expect(parsed.component.metadata.description).toBe("Review invoices");
    expect(parsed.component.type).toBe("skill");
  });

  it("falls back to directory name when frontmatter has no name", async () => {
    const file = await writeSkill("skills/fallback-name/SKILL.md", `# heading

Body.
`);
    const parsed = await parseSkill(workdir, file);
    expect(parsed.component.label).toBe("fallback-name");
  });

  it("extracts inline file references from the body", async () => {
    const file = await writeSkill("skills/refs/SKILL.md", `---
name: refs
---

See scripts/upload.py and config.yaml for details.
`);
    const parsed = await parseSkill(workdir, file);
    expect(parsed.component.metadata.referencedFiles).toEqual(
      expect.arrayContaining(["scripts/upload.py", "config.yaml"])
    );
  });

  it("extracts referenced files from markdown links but skips http and anchors", async () => {
    const file = await writeSkill("skills/links/SKILL.md", `---
name: links
---

See [the script](scripts/run.sh) and [docs](https://example.com) and [section](#anchor).
`);
    const parsed = await parseSkill(workdir, file);
    expect(parsed.component.metadata.referencedFiles).toContain("scripts/run.sh");
    expect(parsed.component.metadata.referencedFiles).not.toContain("https://example.com");
    expect(parsed.component.metadata.referencedFiles.some((p) => p.includes("anchor"))).toBe(false);
  });

  it("computes a stable component id from the directory path", async () => {
    const fileA = await writeSkill("skills/same/SKILL.md", `---
name: same
---
A`);
    const parsedA = await parseSkill(workdir, fileA);

    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), "wta-skill-"));
    try {
      const fileB = path.join(otherDir, "skills/same/SKILL.md");
      await fs.mkdir(path.dirname(fileB), { recursive: true });
      await fs.writeFile(fileB, `---\nname: same\n---\nB`);
      const parsedB = await parseSkill(otherDir, fileB);
      expect(parsedA.component.id).toBe(parsedB.component.id);
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });
});
