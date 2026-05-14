// Region chunkers for the multi-pass scanner.
//
// The regex-only scanner couldn't tell whether a match was inside a comment,
// a string literal, a markdown code block, or genuine prose / genuine code.
// That generated most of the false-positive noise we saw in the home-directory
// dogfood: math-olympiad text mentioning "the order you...", security skills
// describing what `/checkout/apply-voucher` does, Python docstrings describing
// `subprocess.run`, etc.
//
// These chunkers split a file into typed regions before pattern matching, so
// callers can run "prose" patterns only on prose, "code" patterns only on
// code, and skip comments / docstrings entirely. They are deliberately not
// full parsers — every chunker here is a state machine, ~80 lines, no deps.

export type RegionKind =
  | "prose"          // markdown paragraph / heading text — run skill-instruction patterns here
  | "code"           // executable source — run script patterns here
  | "comment"        // skipped: comments, docstrings, HTML comments
  | "string"         // skipped: string literals (handled conservatively)
  | "inline_code";   // skipped: backtick spans, single-line code mentions in prose

export interface Region {
  kind: RegionKind;
  text: string;
  startLine: number;
}

export type ScriptLanguage = "python" | "javascript" | "typescript" | "bash" | "unknown";

export function detectScriptLanguage(filePath: string): ScriptLanguage {
  const ext = filePath.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "py": return "python";
    case "js": case "mjs": case "cjs": return "javascript";
    case "ts": case "tsx": case "mts": case "cts": return "typescript";
    case "sh": case "bash": case "zsh": return "bash";
    default: return "unknown";
  }
}

// ------------------------------------------------------------------
// Markdown chunker — used on SKILL.md bodies and any markdown files.
// ------------------------------------------------------------------
//
// Recognises:
//   - fenced code blocks (``` or ~~~)
//   - HTML comments (<!-- -->)
//   - inline code spans (backticks) within prose lines
// Indented code blocks are intentionally NOT treated as code: most agent
// skill files indent prose by accident. We only trust fenced blocks.

export function chunkMarkdown(content: string): Region[] {
  const lines = content.split(/\r?\n/);
  const regions: Region[] = [];
  let inFence: string | null = null;
  let fenceBuf: string[] = [];
  let fenceStart = 1;
  let inHtmlComment = false;
  let htmlBuf: string[] = [];
  let htmlStart = 1;
  let proseBuf: string[] = [];
  let proseStart = 1;

  const flushProse = (atLine: number): void => {
    if (proseBuf.length === 0) return;
    const text = proseBuf.join("\n");
    if (text.trim()) regions.push({ kind: "prose", text: stripInlineCode(text), startLine: proseStart });
    proseBuf = [];
    proseStart = atLine + 1;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNumber = i + 1;

    if (inFence !== null) {
      if (line.trimStart().startsWith(inFence)) {
        regions.push({ kind: "code", text: fenceBuf.join("\n"), startLine: fenceStart });
        fenceBuf = [];
        inFence = null;
        proseStart = lineNumber + 1;
      } else {
        fenceBuf.push(line);
      }
      continue;
    }

    if (inHtmlComment) {
      htmlBuf.push(line);
      if (line.includes("-->")) {
        regions.push({ kind: "comment", text: htmlBuf.join("\n"), startLine: htmlStart });
        htmlBuf = [];
        inHtmlComment = false;
        proseStart = lineNumber + 1;
      }
      continue;
    }

    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      flushProse(lineNumber - 1);
      inFence = fenceMatch[1] ?? "```";
      fenceStart = lineNumber + 1;
      continue;
    }

    if (line.includes("<!--") && !line.includes("-->")) {
      flushProse(lineNumber - 1);
      inHtmlComment = true;
      htmlBuf = [line];
      htmlStart = lineNumber;
      continue;
    }
    if (line.includes("<!--") && line.includes("-->")) {
      flushProse(lineNumber - 1);
      regions.push({ kind: "comment", text: line, startLine: lineNumber });
      proseStart = lineNumber + 1;
      continue;
    }

    proseBuf.push(line);
  }

  if (inFence !== null && fenceBuf.length > 0) {
    regions.push({ kind: "code", text: fenceBuf.join("\n"), startLine: fenceStart });
  }
  flushProse(lines.length);

  return regions;
}

// Strip backtick-wrapped inline code spans from a prose chunk so that
// quoting `process.env` to *talk about it* doesn't trip credential_access.
function stripInlineCode(text: string): string {
  // Triple-backtick spans handled by chunkMarkdown already; here we strip
  // single and double-backtick spans on the same line.
  return text
    .replace(/``[^`]*``/g, "")
    .replace(/`[^`\n]*`/g, "");
}

// ------------------------------------------------------------------
// Script chunker — strips comments and (best-effort) string literals so
// pattern matches only fire on actual code.
// ------------------------------------------------------------------
//
// We do NOT try to be a full lexer. We strip the lowest-hanging FP sources:
// line comments, block comments, and triple-quoted Python docstrings. String
// literals are partially handled per-language; we err on the side of keeping
// content so we don't drop genuine findings.

export function chunkScript(content: string, language: ScriptLanguage): Region[] {
  switch (language) {
    case "python": return chunkPython(content);
    case "javascript": case "typescript": return chunkCFamily(content);
    case "bash": return chunkBash(content);
    default: return chunkUnknown(content);
  }
}

function chunkPython(content: string): Region[] {
  const lines = content.split(/\r?\n/);
  const regions: Region[] = [];
  let codeBuf: string[] = [];
  let codeStart = 1;
  let inDocstring: '"""' | "'''" | null = null;
  let docBuf: string[] = [];
  let docStart = 1;

  const flushCode = (): void => {
    if (codeBuf.length === 0) return;
    regions.push({ kind: "code", text: codeBuf.join("\n"), startLine: codeStart });
    codeBuf = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNumber = i + 1;

    if (inDocstring !== null) {
      docBuf.push(line);
      if (line.includes(inDocstring)) {
        regions.push({ kind: "comment", text: docBuf.join("\n"), startLine: docStart });
        docBuf = [];
        inDocstring = null;
        codeStart = lineNumber + 1;
      }
      continue;
    }

    const tripleDouble = line.indexOf('"""');
    const tripleSingle = line.indexOf("'''");
    const tripleIdx = tripleDouble !== -1 && (tripleSingle === -1 || tripleDouble < tripleSingle) ? tripleDouble : tripleSingle;
    const triple = tripleDouble !== -1 && (tripleSingle === -1 || tripleDouble < tripleSingle) ? '"""' : "'''";

    if (tripleIdx !== -1) {
      const closeIdx = line.indexOf(triple, tripleIdx + 3);
      if (closeIdx !== -1) {
        const beforeDoc = line.slice(0, tripleIdx);
        if (beforeDoc.trim()) codeBuf.push(beforeDoc);
        regions.push({ kind: "comment", text: line.slice(tripleIdx, closeIdx + 3), startLine: lineNumber });
        const afterDoc = line.slice(closeIdx + 3);
        if (afterDoc.trim()) codeBuf.push(afterDoc);
        continue;
      }
      flushCode();
      inDocstring = triple;
      docBuf = [line.slice(tripleIdx)];
      docStart = lineNumber;
      const beforeDoc = line.slice(0, tripleIdx);
      if (beforeDoc.trim()) {
        regions.push({ kind: "code", text: beforeDoc, startLine: lineNumber });
        codeStart = lineNumber + 1;
      }
      continue;
    }

    const stripped = stripPythonLineComment(line);
    if (codeBuf.length === 0) codeStart = lineNumber;
    codeBuf.push(stripped);
  }

  flushCode();
  return regions;
}

function stripPythonLineComment(line: string): string {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    if (ch === "\\") { i += 1; continue; }
    if (!inDouble && ch === "'" && prev !== "\\") inSingle = !inSingle;
    if (!inSingle && ch === '"' && prev !== "\\") inDouble = !inDouble;
    if (!inSingle && !inDouble && ch === "#") return line.slice(0, i);
  }
  return line;
}

function chunkCFamily(content: string): Region[] {
  // Strip /* ... */ blocks first, then // line comments. Preserve line count
  // by replacing comment spans with spaces.
  const blockStripped = content.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
  const lines = blockStripped.split(/\r?\n/);
  const regions: Region[] = [];
  let codeBuf: string[] = [];
  let codeStart = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (codeBuf.length === 0) codeStart = i + 1;
    codeBuf.push(stripJsLineComment(line));
  }

  if (codeBuf.length > 0) regions.push({ kind: "code", text: codeBuf.join("\n"), startLine: codeStart });
  return regions;
}

function stripJsLineComment(line: string): string {
  let inSingle = false, inDouble = false, inTemplate = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    if (ch === "\\") { i += 1; continue; }
    if (!inDouble && !inTemplate && ch === "'" && prev !== "\\") inSingle = !inSingle;
    if (!inSingle && !inTemplate && ch === '"' && prev !== "\\") inDouble = !inDouble;
    if (!inSingle && !inDouble && ch === "`" && prev !== "\\") inTemplate = !inTemplate;
    if (!inSingle && !inDouble && !inTemplate && ch === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

function chunkBash(content: string): Region[] {
  const lines = content.split(/\r?\n/);
  const regions: Region[] = [];
  let codeBuf: string[] = [];
  let codeStart = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (i === 0 && raw.startsWith("#!")) {
      // shebang — keep as code so command detection still fires
      if (codeBuf.length === 0) codeStart = 1;
      codeBuf.push(raw);
      continue;
    }
    if (codeBuf.length === 0) codeStart = i + 1;
    codeBuf.push(stripBashLineComment(raw));
  }

  if (codeBuf.length > 0) regions.push({ kind: "code", text: codeBuf.join("\n"), startLine: codeStart });
  return regions;
}

function stripBashLineComment(line: string): string {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    if (ch === "\\") { i += 1; continue; }
    if (!inDouble && ch === "'" && prev !== "\\") inSingle = !inSingle;
    if (!inSingle && ch === '"' && prev !== "\\") inDouble = !inDouble;
    if (!inSingle && !inDouble && ch === "#") {
      // bash # starts a comment only at word boundary; require preceding whitespace or start-of-line
      if (i === 0 || /\s/.test(prev)) return line.slice(0, i);
    }
  }
  return line;
}

function chunkUnknown(content: string): Region[] {
  // For file types we don't have a stripper for, return the whole file as
  // code so patterns still run. Better than dropping the file entirely.
  return [{ kind: "code", text: content, startLine: 1 }];
}
