// Editorial / Swiss-modern rewrite of the report, inspired by impeccable.style.
// Principles:
//   - warm white background, deep ink text, restrained accents
//   - single-column, max ~760px, generous whitespace
//   - humanist system sans (deliberately NOT Inter — impeccable.style flags
//     "Inter everywhere" as an anti-pattern)
//   - numbered sections, hairline dividers, no gradient/coloured pills
//   - mono only for code-like identifiers
//   - light-mode only; no dark-mode media query
//   - deterministic output (same input → identical bytes)

import type { Component, ComponentType, ControlGap, Observation, RiskChain, RiskLevel, UnderstandResult } from "../core/types.js";

interface ComponentRef {
  id: string;
  label: string;
  type: ComponentType;
  path?: string;
}

const FALLBACK_REF: ComponentRef = { id: "(unknown)", label: "(unknown component)", type: "skill" };

export function renderHtmlReport(result: UnderstandResult): string {
  const componentMap = new Map<string, Component>(result.scan.components.map((component) => [component.id, component]));
  const lookup = (id: string): ComponentRef => {
    const component = componentMap.get(id);
    if (!component) return { ...FALLBACK_REF, id };
    return { id: component.id, label: component.label, type: component.type, path: component.path };
  };
  const riskChains = result.riskChains.slice();
  const meaningfulGaps = result.controlGaps.filter((gap) => gap.impact === "fix_required" || gap.impact === "fix_recommended");
  const expected = result.expected.slice(0, 50);
  const informational = result.observations.filter((observation) => observation.impact === "informational").slice(0, 50);
  const topCapabilities = result.capabilities
    .slice()
    .sort((a, b) => riskRank(b.risk) - riskRank(a.risk) || b.count - a.count || a.capability.localeCompare(b.capability))
    .slice(0, 12);
  const toolServers = result.inventory.toolServers;
  const counts = {
    risk: riskChains.length,
    attention: meaningfulGaps.length,
    expected: expected.length,
    findings: result.inventory.counts.findings
  };

  const sections: SectionSpec[] = [];
  if (riskChains.length > 0) {
    sections.push({
      id: "risk",
      kicker: "Risk chains",
      lede: "Specific capability combinations whose blast radius is bigger than the parts.",
      body: riskChains.map((chain) => renderChainItem(chain, lookup(chain.componentId))).join("")
    });
  }
  sections.push({
    id: "attention",
    kicker: "Needs attention",
    lede: "Powerful capabilities that may be intentional. Approve in policy or scope them down.",
    body: meaningfulGaps.length === 0
      ? `<p class="empty">No actionable control gaps.</p>`
      : meaningfulGaps.slice(0, 25).map((gap) => renderGapItem(gap, lookup(gap.componentId))).join("")
  });
  if (expected.length > 0) {
    sections.push({
      id: "expected",
      kicker: "Expected",
      lede: "Capabilities you've already approved in policy. Only changes will reappear.",
      body: expected.map((observation) => renderObservationItem(observation, lookup(observation.componentId))).join("")
    });
  }
  sections.push({
    id: "inventory",
    kicker: "Inventory",
    lede: "Detected setup. Background information; no action needed.",
    body: renderInventoryBody(result, topCapabilities, toolServers, informational)
  });
  sections.push({
    id: "next",
    kicker: "Next",
    lede: "Hand the report to your coding agent.",
    body: `<pre class="code-block"><code>wta plan . --for-codex
wta plan . --for-claude</code></pre>
<p class="muted">The structured fix plan is also written to <code>fix-plan.md</code> alongside this report. SARIF for Code Scanning is at <code>results.sarif</code>.</p>`
  });

  const numberedSections = sections.map((spec, index) => renderSection(spec, index + 1)).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WhatTheAgent · ${escapeHtml(result.workspace.root)}</title>
<style>${styles()}</style>
</head>
<body>
<main>
  <header class="masthead">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">W/</span>
      <span class="brand-name">WhatTheAgent</span>
    </div>
    <p class="workspace"><code>${escapeHtml(result.workspace.root)}</code></p>
    <h1 class="headline">${headline(counts)}</h1>
    <p class="dek">${dek(counts)}</p>
    <dl class="summary">
      ${summaryItem("Risk chains", counts.risk)}
      ${summaryItem("Needs attention", counts.attention)}
      ${summaryItem("Acknowledged", counts.expected)}
      ${summaryItem("Inventory findings", counts.findings)}
    </dl>
  </header>

  ${numberedSections}

  <footer class="colophon">
    <p>Local static report · secrets redacted · schema ${escapeHtml(result.schemaVersion)}</p>
  </footer>
</main>
</body>
</html>
`;
}

interface SectionSpec {
  id: string;
  kicker: string;
  lede: string;
  body: string;
}

function renderSection(spec: SectionSpec, index: number): string {
  return `<section id="${spec.id}" class="section">
  <div class="section-head">
    <span class="section-number">${pad2(index)}</span>
    <h2 class="section-title">${escapeHtml(spec.kicker)}</h2>
  </div>
  <p class="section-lede">${escapeHtml(spec.lede)}</p>
  <div class="section-body">${spec.body}</div>
</section>`;
}

function renderChainItem(chain: RiskChain, ref: ComponentRef): string {
  const caps = chain.capabilities.slice();
  const left = caps[0] ?? "?";
  const right = caps.slice(1).join(" + ") || "—";
  const evidence = chain.evidence.slice(0, 3);
  return `<article class="entry">
  <header class="entry-head">
    <span class="entry-severity sev-${chain.risk}">${chain.risk}</span>
    <h3 class="entry-label">${escapeHtml(ref.label)}</h3>
    <span class="entry-type">${escapeHtml(componentTypeLabel(ref.type))}</span>
  </header>
  ${ref.path ? `<p class="entry-path"><code>${escapeHtml(ref.path)}</code></p>` : ""}
  <p class="entry-kicker">${escapeHtml(chain.name)}</p>
  <p class="entry-flow"><code>${escapeHtml(left)}</code> <span class="arrow" aria-hidden="true">→</span> <code>${escapeHtml(right)}</code></p>
  <p class="entry-body">${escapeHtml(chain.message)}</p>
  ${evidence.length > 0 ? `<details class="entry-evidence"><summary>Evidence (${chain.evidence.length})</summary>${evidence.map((ev) => `<p class="evidence-row"><code>${escapeHtml(ev.file)}${ev.line ? `:${ev.line}` : ""}</code>${ev.snippet ? `<span class="evidence-snippet">${escapeHtml(ev.snippet)}</span>` : ""}</p>`).join("")}</details>` : ""}
</article>`;
}

function renderGapItem(gap: ControlGap, ref: ComponentRef): string {
  return `<article class="entry">
  <header class="entry-head">
    <span class="entry-severity sev-${gap.risk}">${gap.risk}</span>
    <h3 class="entry-label">${escapeHtml(ref.label)}</h3>
    <span class="entry-type">${escapeHtml(componentTypeLabel(ref.type))}</span>
  </header>
  ${ref.path ? `<p class="entry-path"><code>${escapeHtml(ref.path)}</code></p>` : ""}
  <p class="entry-kicker">Missing · ${escapeHtml(humanize(gap.control))}</p>
  <p class="entry-body">${escapeHtml(gap.message)}</p>
</article>`;
}

function renderObservationItem(observation: Observation, ref: ComponentRef): string {
  return `<article class="entry">
  <header class="entry-head">
    <span class="entry-severity sev-expected">acknowledged</span>
    <h3 class="entry-label">${escapeHtml(ref.label)}</h3>
    <span class="entry-type">${escapeHtml(componentTypeLabel(ref.type))}</span>
  </header>
  ${ref.path ? `<p class="entry-path"><code>${escapeHtml(ref.path)}</code></p>` : ""}
  <p class="entry-kicker">${escapeHtml(observation.capability ?? "acknowledged")}</p>
  <p class="entry-body">${escapeHtml(observation.message)}</p>
</article>`;
}

function renderInventoryBody(
  result: UnderstandResult,
  topCapabilities: UnderstandResult["capabilities"],
  toolServers: UnderstandResult["inventory"]["toolServers"],
  informational: Observation[]
): string {
  const metrics = `<dl class="metric-row">
    ${summaryItem("Skills", result.inventory.counts.skills)}
    ${summaryItem("Scripts", result.inventory.counts.scripts)}
    ${summaryItem("MCP servers", result.inventory.counts.toolServers)}
    ${summaryItem("Findings", result.inventory.counts.findings)}
  </dl>`;

  const capRows = topCapabilities.length === 0
    ? `<tr><td colspan="3" class="muted">No capabilities detected.</td></tr>`
    : topCapabilities.map((cap) => `<tr><td><code>${escapeHtml(cap.capability)}</code></td><td class="num">${cap.count}</td><td class="severity sev-${cap.risk}">${cap.risk}</td></tr>`).join("");

  const capTable = `<table class="inv-table"><thead><tr><th>Capability</th><th class="num">Findings</th><th>Risk</th></tr></thead><tbody>${capRows}</tbody></table>`;

  const serverRows = toolServers.length === 0
    ? `<tr><td colspan="3" class="muted">No MCP servers detected.</td></tr>`
    : toolServers.map((server) => `<tr><td>${escapeHtml(server.label)}</td><td><code>${escapeHtml(server.path ?? "")}</code></td><td>${server.capabilities.map((cap) => `<code class="cap-tag">${escapeHtml(cap)}</code>`).join(" ")}</td></tr>`).join("");

  const serverTable = `<h3 class="sub-heading">MCP servers</h3><table class="inv-table"><thead><tr><th>Name</th><th>Source</th><th>Capabilities</th></tr></thead><tbody>${serverRows}</tbody></table>`;

  const obsList = informational.length > 0
    ? `<h3 class="sub-heading">Observations</h3><ul class="obs-list">${informational.map((obs) => `<li><code>${escapeHtml(obs.componentId)}</code> · ${escapeHtml(obs.message)}</li>`).join("")}</ul>`
    : "";

  return `${metrics}<h3 class="sub-heading">Capabilities</h3>${capTable}${serverTable}${obsList}`;
}

function summaryItem(label: string, value: number): string {
  return `<div class="summary-item"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function headline(counts: { risk: number; attention: number }): string {
  if (counts.risk === 0 && counts.attention === 0) return "No urgent capability risks.";
  if (counts.risk > 0 && counts.attention > 0) return `${counts.risk} risk chain${counts.risk === 1 ? "" : "s"} and ${counts.attention} item${counts.attention === 1 ? "" : "s"} need attention.`;
  if (counts.risk > 0) return `${counts.risk} risk chain${counts.risk === 1 ? "" : "s"} detected.`;
  return `${counts.attention} item${counts.attention === 1 ? "" : "s"} need attention.`;
}

function dek(counts: { risk: number; attention: number }): string {
  if (counts.risk === 0 && counts.attention === 0) return "Static local scan completed. Capabilities below are inventory only.";
  return "Address risk chains first; review the needs-attention items, then ack the rest in policy.";
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function componentTypeLabel(type: ComponentType): string {
  switch (type) {
    case "mcp_server": return "MCP";
    case "skill": return "Skill";
    case "script": return "Script";
    case "prompt": return "Prompt";
    case "rule": return "Rule";
    case "memory": return "Memory";
    case "config": return "Config";
    case "env_var": return "Env";
    case "api_endpoint": return "API";
    case "capability": return "Capability";
  }
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function riskRank(risk: RiskLevel): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1 } as const)[risk];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function styles(): string {
  return `
    :root {
      color-scheme: light;
      --bg: #FAFAF7;
      --surface: #F4F2EC;
      --ink: #18181B;
      --muted: #71717A;
      --hairline: #E4E4E0;
      --hairline-strong: #C9C8C2;
      --sev-critical: #B91C1C;
      --sev-high: #A16207;
      --sev-medium: #A16207;
      --sev-low: #4D7C0F;
      --sev-expected: #4D7C0F;
      --link: #4338CA;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.65;
      font-feature-settings: "ss01", "kern";
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 6rem 2rem 6rem;
    }
    .masthead { margin-bottom: 5rem; }
    .brand {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      font-size: 0.875rem;
      letter-spacing: 0.04em;
    }
    .brand-mark {
      font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
      font-weight: 600;
      color: var(--ink);
    }
    .brand-name {
      font-weight: 500;
      color: var(--muted);
    }
    .workspace {
      margin: 0.25rem 0 3rem;
      color: var(--muted);
      font-size: 0.875rem;
    }
    .workspace code { background: none; padding: 0; }
    .headline {
      margin: 0 0 0.75rem;
      font-size: clamp(2rem, 4.5vw, 3rem);
      line-height: 1.1;
      letter-spacing: -0.02em;
      font-weight: 500;
      color: var(--ink);
    }
    .dek {
      margin: 0 0 3rem;
      max-width: 52ch;
      color: var(--muted);
      font-size: 1.125rem;
      line-height: 1.5;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem 2.5rem;
      margin: 0;
      padding: 1.5rem 0;
      border-top: 1px solid var(--hairline-strong);
      border-bottom: 1px solid var(--hairline-strong);
    }
    .summary-item { margin: 0; }
    .summary-item dt {
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.25rem;
    }
    .summary-item dd {
      margin: 0;
      font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
      font-size: 1.75rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: var(--ink);
      font-variant-numeric: tabular-nums;
    }

    .section { margin-top: 5rem; }
    .section-head {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--hairline-strong);
      margin-bottom: 1.5rem;
    }
    .section-number {
      font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
      font-size: 0.75rem;
      letter-spacing: 0.16em;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .section-title {
      margin: 0;
      font-size: 0.875rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 500;
      color: var(--ink);
    }
    .section-lede {
      margin: 0 0 2.5rem;
      max-width: 52ch;
      color: var(--muted);
    }
    .section-body { display: flex; flex-direction: column; gap: 2.5rem; }

    .entry {
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--hairline);
    }
    .entry:last-child { border-bottom: 0; padding-bottom: 0; }
    .entry-head {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }
    .entry-severity {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      min-width: 4.5rem;
    }
    .entry-label {
      margin: 0;
      font-size: 1.375rem;
      line-height: 1.25;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: var(--ink);
      word-break: break-word;
    }
    .entry-type {
      font-size: 0.6875rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .entry-path {
      margin: 0 0 1rem 5.5rem;
      color: var(--muted);
      font-size: 0.8125rem;
    }
    .entry-path code {
      background: none;
      padding: 0;
      color: var(--muted);
      word-break: break-all;
    }
    .entry-kicker {
      margin: 0 0 0.5rem 5.5rem;
      font-size: 0.75rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink);
    }
    .entry-flow {
      margin: 0 0 1rem 5.5rem;
      font-size: 0.9375rem;
    }
    .entry-flow code {
      background: var(--surface);
      padding: 0.15rem 0.5rem;
      border-radius: 2px;
      font-size: 0.8125rem;
    }
    .entry-flow .arrow {
      display: inline-block;
      margin: 0 0.35rem;
      color: var(--muted);
    }
    .entry-body {
      margin: 0 0 0 5.5rem;
      max-width: 56ch;
      color: var(--ink);
    }
    .entry-evidence {
      margin: 1rem 0 0 5.5rem;
    }
    .entry-evidence summary {
      cursor: pointer;
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      list-style: none;
    }
    .entry-evidence summary::before { content: "▸ "; }
    .entry-evidence[open] summary::before { content: "▾ "; }
    .evidence-row {
      margin: 0.75rem 0 0;
      font-size: 0.8125rem;
    }
    .evidence-row code {
      background: none;
      padding: 0;
      color: var(--ink);
    }
    .evidence-snippet {
      display: block;
      margin-top: 0.25rem;
      padding: 0.5rem 0.75rem;
      background: var(--surface);
      color: var(--muted);
      font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
      font-size: 0.75rem;
      white-space: pre-wrap;
      word-break: break-word;
      border-left: 2px solid var(--hairline-strong);
    }

    @media (max-width: 600px) {
      .entry-path, .entry-kicker, .entry-flow, .entry-body, .entry-evidence { margin-left: 0; }
    }

    .sev-critical { color: var(--sev-critical); }
    .sev-high { color: var(--sev-high); }
    .sev-medium { color: var(--sev-medium); }
    .sev-low { color: var(--sev-low); }
    .sev-expected { color: var(--sev-expected); }

    .metric-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem 2.5rem;
      margin: 0 0 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--hairline);
    }

    .sub-heading {
      font-size: 0.75rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 500;
      margin: 2.5rem 0 1rem;
    }

    .inv-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .inv-table th, .inv-table td {
      text-align: left;
      padding: 0.65rem 0.5rem;
      border-bottom: 1px solid var(--hairline);
      vertical-align: top;
    }
    .inv-table th {
      font-weight: 500;
      font-size: 0.6875rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .inv-table .num {
      font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
      font-variant-numeric: tabular-nums;
    }
    .inv-table .severity {
      font-size: 0.6875rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .cap-tag {
      display: inline-block;
      margin: 0 0.15rem 0.25rem 0;
      padding: 0.1rem 0.4rem;
      background: var(--surface);
      border-radius: 2px;
      font-size: 0.75rem;
    }

    .obs-list {
      margin: 1rem 0 0;
      padding: 0;
      list-style: none;
      font-size: 0.875rem;
      color: var(--ink);
    }
    .obs-list li {
      padding: 0.45rem 0;
      border-bottom: 1px solid var(--hairline);
    }
    .obs-list li:last-child { border-bottom: 0; }

    .code-block {
      margin: 0 0 1rem;
      padding: 1rem 1.25rem;
      background: var(--surface);
      border-radius: 2px;
      font-size: 0.875rem;
      overflow-x: auto;
    }
    .code-block code { background: none; padding: 0; }
    .muted { color: var(--muted); font-size: 0.875rem; }
    .empty { color: var(--muted); font-style: italic; margin: 0; }

    code {
      font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
      font-size: 0.8125em;
      background: var(--surface);
      padding: 0.1em 0.35em;
      border-radius: 2px;
    }

    .colophon {
      margin-top: 6rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--hairline-strong);
      color: var(--muted);
      font-size: 0.75rem;
      letter-spacing: 0.06em;
    }
    .colophon p { margin: 0; }
  `;
}
