import type { UnderstandResult } from "../core/types.js";

export function renderHtmlReport(result: UnderstandResult): string {
  const topCapabilities = result.capabilities
    .slice()
    .sort((a, b) => b.count - a.count || a.capability.localeCompare(b.capability))
    .slice(0, 12);
  const riskChains = result.riskChains.slice(0, 25);
  const toolServers = result.inventory.toolServers;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WhatTheAgent Understand Report</title>
  <style>
    :root { color-scheme: light; --ink:#172026; --muted:#60717d; --line:#d9e1e6; --panel:#f7f9fa; --accent:#0f766e; --risk:#b42318; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:#ffffff; }
    header { padding:32px 40px 20px; border-bottom:1px solid var(--line); }
    main { padding:28px 40px 48px; max-width:1180px; }
    h1 { margin:0 0 8px; font-size:30px; letter-spacing:0; }
    h2 { margin:32px 0 12px; font-size:18px; letter-spacing:0; }
    p { color:var(--muted); margin:0; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:14px 16px; background:var(--panel); }
    .metric { font-size:28px; font-weight:700; }
    .label { color:var(--muted); font-size:13px; margin-top:4px; }
    table { width:100%; border-collapse:collapse; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { background:var(--panel); font-size:13px; color:#33444f; }
    tr:last-child td { border-bottom:0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; background:#eef3f5; padding:2px 5px; border-radius:4px; }
    .risk-critical { color:var(--risk); font-weight:700; }
    .risk-high { color:#9a5b00; font-weight:700; }
    .path { color:var(--muted); font-size:12px; }
    .pill { display:inline-block; margin:2px 4px 2px 0; padding:2px 7px; border:1px solid var(--line); border-radius:999px; font-size:12px; background:#fff; }
  </style>
</head>
<body>
  <header>
    <h1>WhatTheAgent Understand Report</h1>
    <p>Capability-first inventory, control gaps, risk chains, and implementation tasks.</p>
  </header>
  <main>
    <section class="grid">
      ${metric("Skills", result.inventory.counts.skills)}
      ${metric("Scripts", result.inventory.counts.scripts)}
      ${metric("Tool Servers", result.inventory.counts.toolServers)}
      ${metric("Findings", result.inventory.counts.findings)}
      ${metric("Risk Chains", result.inventory.counts.riskChains)}
      ${metric("Control Gaps", result.summary.controlGapCount)}
    </section>

    <h2>Top Capabilities</h2>
    <table>
      <thead><tr><th>Capability</th><th>State</th><th>Risk</th><th>Findings</th></tr></thead>
      <tbody>
        ${topCapabilities.map((capability) => `<tr><td><code>${escapeHtml(capability.capability)}</code></td><td>${capability.state}</td><td class="risk-${capability.risk}">${capability.risk}</td><td>${capability.count}</td></tr>`).join("\n")}
      </tbody>
    </table>

    <h2>Tool Servers</h2>
    <table>
      <thead><tr><th>Name</th><th>Subtype</th><th>Source</th><th>Capabilities</th></tr></thead>
      <tbody>
        ${toolServers.length === 0 ? `<tr><td colspan="4">No tool servers detected.</td></tr>` : toolServers.map((server) => `<tr><td>${escapeHtml(server.label)}</td><td>${server.subtype}</td><td><span class="path">${escapeHtml(server.path ?? "")}</span></td><td>${server.capabilities.map((capability) => `<span class="pill">${escapeHtml(capability)}</span>`).join("")}</td></tr>`).join("\n")}
      </tbody>
    </table>

    <h2>Risk Chains</h2>
    <table>
      <thead><tr><th>Risk</th><th>Chain</th><th>Component</th><th>Capabilities</th></tr></thead>
      <tbody>
        ${riskChains.length === 0 ? `<tr><td colspan="4">No risk chains detected.</td></tr>` : riskChains.map((chain) => `<tr><td class="risk-${chain.risk}">${chain.risk}</td><td>${escapeHtml(chain.name)}</td><td><code>${escapeHtml(chain.componentId)}</code></td><td>${chain.capabilities.map((capability) => `<span class="pill">${escapeHtml(capability)}</span>`).join("")}</td></tr>`).join("\n")}
      </tbody>
    </table>

    <h2>Quick Fixes</h2>
    <table>
      <thead><tr><th>Risk</th><th>Fix</th><th>Kind</th><th>Component</th></tr></thead>
      <tbody>
        ${result.quickFixes.slice(0, 40).map((fix) => `<tr><td class="risk-${fix.risk}">${fix.risk}</td><td>${escapeHtml(fix.title)}</td><td>${fix.kind}</td><td><code>${escapeHtml(fix.componentId ?? "")}</code></td></tr>`).join("\n") || `<tr><td colspan="4">No quick fixes generated.</td></tr>`}
      </tbody>
    </table>
  </main>
</body>
</html>
`;
}

function metric(label: string, value: number): string {
  return `<div class="card"><div class="metric">${value}</div><div class="label">${escapeHtml(label)}</div></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
