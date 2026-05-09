import type { Component, ComponentType, ControlGap, Observation, RiskChain, RiskLevel, UnderstandResult } from "../core/types.js";
import { renderVisualChainsSvg } from "./visualChainsSvg.js";

interface ComponentRef {
  id: string;
  label: string;
  type: ComponentType;
  path?: string;
}

const FALLBACK_REF: ComponentRef = { id: "(unknown)", label: "(unknown component)", type: "skill" };

export function renderHtmlReport(result: UnderstandResult): string {
  const visualSvg = renderVisualChainsSvg(result).replace(/^<\?xml[^?]*\?>\s*/, "");
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
    informational: informational.length
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WhatTheAgent · ${escapeHtml(result.workspace.root)}</title>
<style>${styles()}</style>
</head>
<body>
<header class="hero">
  <div class="hero-row">
    <div class="brand">
      <span class="logo" aria-hidden="true">W</span>
      <div>
        <div class="brand-name">WhatTheAgent</div>
        <div class="brand-path">${escapeHtml(result.workspace.root)}</div>
      </div>
    </div>
    <nav class="nav">
      <a href="#risk">Risk chains</a>
      <a href="#attention">Needs attention</a>
      <a href="#expected">Expected</a>
      <a href="#inventory">Inventory</a>
    </nav>
  </div>
  <div class="status-strip" role="status">
    ${statusPill("crit", counts.risk, "risk chain", "risk chains")}
    ${statusPill("warn", counts.attention, "needs attention", "need attention")}
    ${statusPill("ok", counts.expected, "acknowledged", "acknowledged")}
    ${statusPill("info", result.inventory.counts.findings, "inventory finding", "inventory findings")}
  </div>
  <div class="hero-headline">
    ${counts.risk === 0 && counts.attention === 0
      ? `<h1>No urgent capability risks.</h1><p>Static local scan completed. Capabilities below are inventory only.</p>`
      : `<h1>${headlinePhrase(counts.risk, counts.attention)}</h1><p>Address risk chains first; review the needs-attention items, then ack the rest in policy.</p>`
    }
  </div>
</header>

<main>
  ${riskChains.length > 0 ? `
  <section id="risk" class="tier tier-crit">
    <div class="tier-head">
      <span class="tier-tag">Risk chain</span>
      <h2>Investigate now</h2>
      <p>Specific combinations whose blast radius is bigger than the parts.</p>
    </div>
    <div class="visual-wrap" aria-hidden="true">${visualSvg}</div>
    <div class="cards">
      ${riskChains.map((chain) => renderChainCard(chain, lookup(chain.componentId))).join("")}
    </div>
  </section>` : ""}

  <section id="attention" class="tier tier-warn">
    <div class="tier-head">
      <span class="tier-tag">Needs attention</span>
      <h2>Decide once, move on</h2>
      <p>Powerful capabilities that may be intentional. Approve in policy or scope them down.</p>
    </div>
    <div class="cards">
      ${meaningfulGaps.length === 0
        ? `<div class="empty">No actionable control gaps.</div>`
        : meaningfulGaps.slice(0, 25).map((gap) => renderGapCard(gap, lookup(gap.componentId))).join("")
      }
    </div>
  </section>

  ${expected.length > 0 ? `
  <section id="expected" class="tier tier-ok">
    <div class="tier-head">
      <span class="tier-tag">Expected</span>
      <h2>Acknowledged in policy</h2>
      <p>Capabilities you've already approved. Only changes will reappear.</p>
    </div>
    <div class="cards">
      ${expected.map((obs) => renderObservationCard(obs, lookup(obs.componentId))).join("")}
    </div>
  </section>` : ""}

  <section id="inventory" class="tier tier-info">
    <div class="tier-head">
      <span class="tier-tag">Inventory</span>
      <h2>Detected setup</h2>
      <p>What WhatTheAgent found in your workspace.</p>
    </div>
    <div class="metric-grid">
      ${metric("Skills", result.inventory.counts.skills)}
      ${metric("Scripts", result.inventory.counts.scripts)}
      ${metric("MCP Servers", result.inventory.counts.toolServers)}
      ${metric("Findings", result.inventory.counts.findings)}
    </div>

    <h3>Capabilities</h3>
    <table>
      <thead><tr><th>Capability</th><th>Risk</th><th>Findings</th><th>Confidence</th></tr></thead>
      <tbody>
      ${topCapabilities.length === 0
        ? `<tr><td colspan="4">No capabilities detected.</td></tr>`
        : topCapabilities.map((cap) => `<tr><td><code>${escapeHtml(cap.capability)}</code></td><td><span class="risk-pill risk-${cap.risk}">${cap.risk}</span></td><td>${cap.count}</td><td>${escapeHtml(cap.confidence ?? "medium")}</td></tr>`).join("")
      }
      </tbody>
    </table>

    <h3>MCP servers</h3>
    <table>
      <thead><tr><th>Name</th><th>Source</th><th>Capabilities</th></tr></thead>
      <tbody>
      ${toolServers.length === 0
        ? `<tr><td colspan="3">No MCP servers detected.</td></tr>`
        : toolServers.map((server) => `<tr><td><strong>${escapeHtml(server.label)}</strong></td><td><span class="path">${escapeHtml(server.path ?? "")}</span></td><td>${server.capabilities.map((cap) => `<span class="cap-pill">${escapeHtml(cap)}</span>`).join("")}</td></tr>`).join("")
      }
      </tbody>
    </table>

    ${informational.length > 0 ? `
    <h3>Normal observations</h3>
    <ul class="obs-list">
      ${informational.map((obs) => `<li><code>${escapeHtml(obs.componentId)}</code> · ${escapeHtml(obs.message)}</li>`).join("")}
    </ul>` : ""}
  </section>

  <section class="next-step">
    <h3>Hand this to your coding agent</h3>
    <pre><code>wta plan . --for-codex
wta plan . --for-claude</code></pre>
    <p class="muted">The fix plan is also written to <code>fix-plan.md</code> alongside this report.</p>
  </section>
</main>

<footer>
  <span>Local static report · secrets redacted · schema ${escapeHtml(result.schemaVersion)}</span>
</footer>
</body>
</html>
`;
}

function statusPill(kind: "crit" | "warn" | "ok" | "info", count: number, singular: string, plural: string): string {
  const label = count === 1 ? singular : plural;
  return `<div class="pill pill-${kind}"><span class="pill-num">${count}</span><span class="pill-label">${escapeHtml(label)}</span></div>`;
}

function headlinePhrase(risk: number, attention: number): string {
  if (risk > 0 && attention > 0) return `${risk} risk chain${risk === 1 ? "" : "s"} and ${attention} item${attention === 1 ? "" : "s"} need attention.`;
  if (risk > 0) return `${risk} risk chain${risk === 1 ? "" : "s"} detected.`;
  return `${attention} item${attention === 1 ? "" : "s"} need attention.`;
}

function renderChainCard(chain: RiskChain, ref: ComponentRef): string {
  const caps = chain.capabilities.slice();
  const left = caps[0] ?? "?";
  const right = caps.slice(1).join(" + ") || "—";
  const evidence = chain.evidence.slice(0, 2);
  return `<article class="card chain-card chain-${chain.risk}">
  ${componentHeader(ref, chain.risk, chain.name)}
  <div class="chain-flow" aria-label="capability chain">
    <span class="chain-cap">${escapeHtml(left)}</span>
    <span class="chain-arrow" aria-hidden="true">→</span>
    <span class="chain-cap">${escapeHtml(right)}</span>
  </div>
  <p class="chain-msg">${escapeHtml(chain.message)}</p>
  ${evidence.length > 0 ? `<details class="chain-evidence"><summary>Evidence (${chain.evidence.length})</summary>${evidence.map((ev) => `<div class="ev-row"><code>${escapeHtml(ev.file)}${ev.line ? `:${ev.line}` : ""}</code>${ev.snippet ? `<div class="ev-snippet">${escapeHtml(ev.snippet)}</div>` : ""}</div>`).join("")}</details>` : ""}
</article>`;
}

function renderGapCard(gap: ControlGap, ref: ComponentRef): string {
  return `<article class="card gap-card">
  ${componentHeader(ref, gap.risk, `Missing: ${humanize(gap.control)}`)}
  <p class="chain-msg">${escapeHtml(gap.message)}</p>
</article>`;
}

function renderObservationCard(observation: Observation, ref: ComponentRef): string {
  return `<article class="card obs-card">
  ${componentHeader(ref, "low", `Expected · ${observation.capability ?? "acknowledged"}`)}
  <p class="chain-msg">${escapeHtml(observation.message)}</p>
</article>`;
}

function componentHeader(ref: ComponentRef, risk: RiskLevel, subtitle: string): string {
  return `<header class="comp-header">
    <div class="comp-id">
      <span class="risk-pill risk-${risk}">${risk}</span>
      <h3 class="comp-label">${escapeHtml(ref.label)}</h3>
      <span class="comp-type">${escapeHtml(componentTypeLabel(ref.type))}</span>
    </div>
    ${ref.path ? `<div class="comp-path"><code>${escapeHtml(ref.path)}</code></div>` : ""}
    <div class="comp-subtitle">${escapeHtml(subtitle)}</div>
  </header>`;
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

function metric(label: string, value: number): string {
  return `<div class="metric"><div class="metric-num">${value}</div><div class="metric-label">${escapeHtml(label)}</div></div>`;
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
      color-scheme: light dark;
      --bg: #ffffff;
      --surface: #f8fafc;
      --surface-2: #f1f5f9;
      --ink: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --line-strong: #cbd5e1;
      --crit-bg: #fef2f2;
      --crit-fg: #b91c1c;
      --crit-line: #fecaca;
      --warn-bg: #fffbeb;
      --warn-fg: #b45309;
      --warn-line: #fde68a;
      --ok-bg: #f0fdf4;
      --ok-fg: #15803d;
      --ok-line: #bbf7d0;
      --info-bg: #ecfeff;
      --info-fg: #0e7490;
      --info-line: #a5f3fc;
      --code-bg: #f1f5f9;
      --shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b1220;
        --surface: #0f172a;
        --surface-2: #111c2f;
        --ink: #f1f5f9;
        --muted: #94a3b8;
        --line: #1e293b;
        --line-strong: #334155;
        --crit-bg: #2a0e10;
        --crit-fg: #fca5a5;
        --crit-line: #7f1d1d;
        --warn-bg: #2a1d05;
        --warn-fg: #fbbf24;
        --warn-line: #92400e;
        --ok-bg: #052e1a;
        --ok-fg: #86efac;
        --ok-line: #14532d;
        --info-bg: #082f3a;
        --info-fg: #67e8f9;
        --info-line: #155e75;
        --code-bg: #111c2f;
        --shadow: 0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .hero {
      padding: 32px 40px 0;
      background: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);
      border-bottom: 1px solid var(--line);
    }
    .hero-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo {
      width: 36px; height: 36px;
      display: grid; place-items: center;
      background: linear-gradient(135deg, #34d399, #22d3ee);
      color: #0b1220;
      font-weight: 800;
      border-radius: 8px;
      font-size: 18px;
      letter-spacing: -0.5px;
    }
    .brand-name { font-weight: 700; font-size: 16px; }
    .brand-path { color: var(--muted); font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .nav { display: flex; gap: 18px; }
    .nav a {
      color: var(--muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 0;
      border-bottom: 2px solid transparent;
      transition: color 0.15s, border-color 0.15s;
    }
    .nav a:hover { color: var(--ink); border-bottom-color: var(--line-strong); }

    .status-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 24px 0;
    }
    .pill {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--surface-2);
    }
    .pill-num { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .pill-label { color: var(--muted); font-size: 13px; font-weight: 600; }
    .pill-crit { background: var(--crit-bg); border-color: var(--crit-line); }
    .pill-crit .pill-num { color: var(--crit-fg); }
    .pill-warn { background: var(--warn-bg); border-color: var(--warn-line); }
    .pill-warn .pill-num { color: var(--warn-fg); }
    .pill-ok { background: var(--ok-bg); border-color: var(--ok-line); }
    .pill-ok .pill-num { color: var(--ok-fg); }
    .pill-info { background: var(--info-bg); border-color: var(--info-line); }
    .pill-info .pill-num { color: var(--info-fg); }

    .hero-headline { padding: 8px 0 32px; }
    .hero-headline h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.5px; }
    .hero-headline p { margin: 0; color: var(--muted); }

    main { padding: 28px 40px 64px; max-width: 1200px; margin: 0 auto; }

    .tier { padding: 28px 0 8px; border-top: 1px solid var(--line); margin-top: 24px; }
    .tier:first-child { border-top: 0; margin-top: 0; }
    .tier-head { margin-bottom: 18px; }
    .tier-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 8px;
    }
    .tier-head h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.3px; }
    .tier-head p { margin: 0; color: var(--muted); font-size: 14px; }
    .tier-crit .tier-tag { background: var(--crit-bg); color: var(--crit-fg); }
    .tier-warn .tier-tag { background: var(--warn-bg); color: var(--warn-fg); }
    .tier-ok .tier-tag { background: var(--ok-bg); color: var(--ok-fg); }
    .tier-info .tier-tag { background: var(--info-bg); color: var(--info-fg); }

    .visual-wrap {
      margin: 16px 0 24px;
      padding: 12px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    .visual-wrap svg { display: block; width: 100%; height: auto; }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 14px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px 20px;
      box-shadow: var(--shadow);
    }
    .chain-card { border-left: 4px solid var(--crit-line); }
    .chain-card.chain-critical { border-left-color: var(--crit-fg); }
    .chain-card.chain-high { border-left-color: var(--warn-fg); }
    .gap-card { border-left: 4px solid var(--warn-fg); }
    .obs-card { border-left: 4px solid var(--ok-fg); }
    .chain-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
    .chain-head h3 { margin: 0; font-size: 16px; letter-spacing: -0.2px; }
    .comp-header { margin-bottom: 14px; }
    .comp-id { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
    .comp-label {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: var(--ink);
      word-break: break-word;
    }
    .comp-type {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--code-bg);
      color: var(--muted);
      border: 1px solid var(--line);
    }
    .comp-path { margin-top: 2px; }
    .comp-path code {
      background: transparent;
      padding: 0;
      font-size: 11px;
      color: var(--muted);
      word-break: break-all;
    }
    .comp-subtitle {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .chain-flow {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 8px 0 12px;
      flex-wrap: wrap;
    }
    .chain-cap {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 10px;
      background: var(--code-bg);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--ink);
    }
    .chain-arrow {
      color: var(--muted);
      font-weight: 800;
      font-size: 18px;
    }
    .chain-msg { margin: 0 0 10px; color: var(--ink); font-size: 14px; }
    .chain-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--muted); }
    .chain-component code { font-size: 11px; }
    .chain-evidence { margin-top: 12px; }
    .chain-evidence summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 0;
    }
    .ev-row { padding: 8px 10px; background: var(--code-bg); border-radius: 6px; margin-top: 6px; font-size: 12px; }
    .ev-snippet {
      margin-top: 4px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .empty { padding: 18px; color: var(--muted); font-size: 14px; }

    .risk-pill {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .risk-pill.risk-critical, .risk-critical { background: var(--crit-bg); color: var(--crit-fg); }
    .risk-pill.risk-high, .risk-high { background: var(--warn-bg); color: var(--warn-fg); }
    .risk-pill.risk-medium, .risk-medium { background: var(--info-bg); color: var(--info-fg); }
    .risk-pill.risk-low, .risk-low { background: var(--ok-bg); color: var(--ok-fg); }

    .cap-pill {
      display: inline-block;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--code-bg);
      border: 1px solid var(--line);
      margin: 2px 4px 2px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .metric-num { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .metric-label { color: var(--muted); font-size: 12px; font-weight: 600; margin-top: 2px; }

    h3 { margin: 22px 0 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; text-transform: uppercase; color: var(--muted); }

    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface); }
    th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 13px; }
    th { background: var(--surface-2); font-size: 12px; color: var(--muted); font-weight: 700; }
    tr:last-child td { border-bottom: 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: var(--code-bg); padding: 2px 5px; border-radius: 4px; }
    .path { color: var(--muted); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    .obs-list { padding-left: 18px; color: var(--ink); font-size: 13px; line-height: 1.7; }
    .obs-list li { margin-bottom: 4px; }

    .next-step { margin-top: 36px; padding: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
    .next-step h3 { margin-top: 0; }
    .next-step pre {
      margin: 12px 0 8px;
      background: var(--surface-2);
      color: var(--ink);
      padding: 14px 16px;
      border-radius: 8px;
      border: 1px solid var(--line);
      overflow-x: auto;
      font-size: 13px;
    }
    .next-step pre code { background: transparent; padding: 0; }
    .muted { color: var(--muted); font-size: 13px; }

    footer {
      padding: 24px 40px;
      color: var(--muted);
      font-size: 12px;
      border-top: 1px solid var(--line);
      text-align: center;
    }

    @media (max-width: 720px) {
      .hero, main, footer { padding-left: 20px; padding-right: 20px; }
      .nav { width: 100%; }
      .cards { grid-template-columns: 1fr; }
    }
  `;
}
