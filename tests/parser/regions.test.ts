import { describe, expect, it } from "vitest";
import { chunkMarkdown, chunkScript, detectScriptLanguage } from "../../src/parser/regions.js";

describe("chunkMarkdown", () => {
  it("yields the whole file as one prose region when there are no code blocks", () => {
    const regions = chunkMarkdown("First paragraph.\n\nSecond paragraph.");
    expect(regions.length).toBe(1);
    expect(regions[0]?.kind).toBe("prose");
  });

  it("splits a fenced code block out of surrounding prose", () => {
    const md = [
      "prose before",
      "",
      "```python",
      "import requests",
      "requests.post(url)",
      "```",
      "",
      "prose after"
    ].join("\n");
    const regions = chunkMarkdown(md);
    const kinds = regions.map((r) => r.kind);
    expect(kinds).toContain("code");
    expect(kinds.filter((k) => k === "prose").length).toBeGreaterThanOrEqual(1);
    const code = regions.find((r) => r.kind === "code");
    expect(code?.text).toContain("requests.post(url)");
    expect(code?.text).not.toContain("prose before");
  });

  it("supports tilde-fenced code blocks", () => {
    const md = "prose\n\n~~~\nsubprocess.run(['ls'])\n~~~\n\nmore prose";
    const regions = chunkMarkdown(md);
    expect(regions.some((r) => r.kind === "code" && r.text.includes("subprocess.run"))).toBe(true);
  });

  it("strips inline `code spans` from prose so they don't trigger script-shape regexes", () => {
    const md = "When discussing `process.env`, document the variable but do not actually access it.";
    const regions = chunkMarkdown(md);
    const prose = regions.find((r) => r.kind === "prose");
    expect(prose?.text).not.toContain("process.env");
  });

  it("strips double-backtick spans too", () => {
    const md = "Use ``stripe.charges.create()`` only in payment flows.";
    const regions = chunkMarkdown(md);
    const prose = regions.find((r) => r.kind === "prose");
    expect(prose?.text).not.toContain("stripe.charges.create");
  });

  it("treats HTML comments as comment regions and skips them", () => {
    const md = "prose before\n<!-- TODO: mention requests.post here -->\nprose after";
    const regions = chunkMarkdown(md);
    expect(regions.some((r) => r.kind === "comment")).toBe(true);
    const prose = regions.filter((r) => r.kind === "prose").map((r) => r.text).join("\n");
    expect(prose).not.toContain("requests.post");
  });

  it("tracks startLine accurately across a fenced block", () => {
    const md = "line 1\nline 2\n```\nline 4\nline 5\n```\nline 7";
    const regions = chunkMarkdown(md);
    const code = regions.find((r) => r.kind === "code");
    expect(code?.startLine).toBe(4);
  });

  it("does not match indented blocks as code (skill files indent prose by accident)", () => {
    const md = "Here are the steps:\n\n    requests.post(url)\n\n…and so on.";
    const regions = chunkMarkdown(md);
    expect(regions.every((r) => r.kind !== "code")).toBe(true);
  });
});

describe("chunkScript - Python", () => {
  it("strips line comments", () => {
    const src = "import requests\n# TODO: switch to httpx\nrequests.post(url)";
    const regions = chunkScript(src, "python");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).not.toContain("TODO: switch to httpx");
    expect(code.text).toContain("requests.post(url)");
  });

  it("strips trailing comments on a code line", () => {
    const src = "result = requests.post(url)  # legacy webhook";
    const regions = chunkScript(src, "python");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).toContain("requests.post(url)");
    expect(code.text).not.toContain("legacy webhook");
  });

  it("respects # inside single and double-quoted strings", () => {
    const src = `headers = {"User-Agent": "wta#1.0"}`;
    const regions = chunkScript(src, "python");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).toContain('"wta#1.0"');
  });

  it("treats triple-double-quoted docstrings as comment regions", () => {
    const src = [
      `def upload():`,
      `    """`,
      `    Uploads via requests.post — see docs.`,
      `    """`,
      `    return 1`
    ].join("\n");
    const regions = chunkScript(src, "python");
    const code = regions.filter((r) => r.kind === "code").map((r) => r.text).join("\n");
    expect(code).not.toContain("requests.post");
    expect(regions.some((r) => r.kind === "comment")).toBe(true);
  });

  it("treats triple-single-quoted docstrings as comment regions", () => {
    const src = "'''documents process.env usage'''\nimport os";
    const regions = chunkScript(src, "python");
    const code = regions.filter((r) => r.kind === "code").map((r) => r.text).join("\n");
    expect(code).not.toContain("process.env");
  });

  it("handles single-line triple-quoted strings", () => {
    const src = `x = """just a string with subprocess.run inside"""`;
    const regions = chunkScript(src, "python");
    const code = regions.filter((r) => r.kind === "code").map((r) => r.text).join("\n");
    expect(code).toContain("x =");
    expect(code).not.toContain("subprocess.run");
  });
});

describe("chunkScript - JavaScript / TypeScript", () => {
  it("strips // line comments", () => {
    const src = "const x = 1;\n// TODO: call requests.post here\nfetch(url);";
    const regions = chunkScript(src, "javascript");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).not.toContain("TODO: call requests.post here");
    expect(code.text).toContain("fetch(url)");
  });

  it("strips /* block */ comments", () => {
    const src = "const x = 1; /* eval(maliciousString) */ const y = 2;";
    const regions = chunkScript(src, "javascript");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).not.toContain("eval(maliciousString)");
    expect(code.text).toContain("const x = 1");
    expect(code.text).toContain("const y = 2");
  });

  it("preserves // inside string literals", () => {
    const src = `const url = "https://api.example.com/path";`;
    const regions = chunkScript(src, "javascript");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).toContain("https://api.example.com/path");
  });

  it("preserves // inside template literals", () => {
    const src = "const url = `https://api.example.com/${path}`;";
    const regions = chunkScript(src, "javascript");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).toContain("https://api.example.com");
  });

  it("works the same for TypeScript", () => {
    const src = "const x: number = 1; // TODO: requests.post\n";
    const regions = chunkScript(src, "typescript");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).not.toContain("requests.post");
  });
});

describe("chunkScript - Bash", () => {
  it("strips # line comments", () => {
    const src = "#!/bin/bash\n# this script does curl posts\ncurl -X POST $URL";
    const regions = chunkScript(src, "bash");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).not.toContain("this script does curl posts");
    expect(code.text).toContain("curl -X POST");
  });

  it("preserves the shebang as code", () => {
    const src = "#!/bin/bash\necho hi";
    const regions = chunkScript(src, "bash");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).toContain("#!/bin/bash");
  });

  it("preserves # inside single-quoted strings", () => {
    const src = `echo 'channel=#general'`;
    const regions = chunkScript(src, "bash");
    const code = regions.find((r) => r.kind === "code")!;
    expect(code.text).toContain("#general");
  });
});

describe("detectScriptLanguage", () => {
  it("maps .py to python", () => {
    expect(detectScriptLanguage("scripts/upload.py")).toBe("python");
  });

  it("maps .ts and .tsx to typescript", () => {
    expect(detectScriptLanguage("foo.ts")).toBe("typescript");
    expect(detectScriptLanguage("foo.tsx")).toBe("typescript");
  });

  it("maps .js, .mjs, .cjs to javascript", () => {
    expect(detectScriptLanguage("foo.js")).toBe("javascript");
    expect(detectScriptLanguage("foo.mjs")).toBe("javascript");
    expect(detectScriptLanguage("foo.cjs")).toBe("javascript");
  });

  it("maps .sh / .bash / .zsh to bash", () => {
    expect(detectScriptLanguage("foo.sh")).toBe("bash");
    expect(detectScriptLanguage("foo.bash")).toBe("bash");
    expect(detectScriptLanguage("foo.zsh")).toBe("bash");
  });

  it("returns unknown for unrecognised extensions", () => {
    expect(detectScriptLanguage("foo.txt")).toBe("unknown");
  });
});
