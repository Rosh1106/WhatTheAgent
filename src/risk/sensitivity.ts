import type { Component, Finding } from "../core/types.js";

export type Sensitivity = "normal" | "sensitive" | "critical";

const sensitivePathPattern = /(^|\/)(\.env|\.ssh|\.aws|\.kube|credentials?|private[-_]?key|secrets?)(\/|$|\.)/i;
const sensitiveSnippetPattern = /\b(secret|token|api[_-]?key|password|private[_-]?key|authorization|bearer|database_url|stripe_secret_key|github_token)\b/i;
const writeActionPattern = /\b(create|write|update|delete|merge|send|post|upload|publish|deploy|refund|charge|checkout|purchase|order)\b/i;

export function sensitivityForFinding(finding: Finding, component?: Component): Sensitivity {
  if (finding.capability === "payment" || finding.capability === "order_placement") return "critical";
  if (finding.capability === "approval_bypass") return "sensitive";
  if (finding.capability === "execute_code") return "sensitive";
  if (finding.capability === "credential_access") return sensitiveCredentialFinding(finding) ? "sensitive" : "normal";
  if (finding.capability === "database_access") return "sensitive";
  if (finding.capability === "delete_file" || finding.capability === "write_file") return sensitiveFileFinding(finding) ? "sensitive" : "normal";
  if (finding.capability === "external_send") return sensitiveExternalSend(finding) ? "sensitive" : "normal";
  if (component?.type === "mcp_server" && broadToolServer(component)) return "sensitive";
  if (finding.capability === "read_file") return sensitiveFileFinding(finding) ? "sensitive" : "normal";
  return "normal";
}

function sensitiveCredentialFinding(finding: Finding): boolean {
  return sensitivePathPattern.test(finding.evidence.file)
    || sensitiveSnippetPattern.test(finding.evidence.snippet ?? "")
    || sensitiveSnippetPattern.test(finding.evidence.pattern);
}

function sensitiveFileFinding(finding: Finding): boolean {
  return sensitivePathPattern.test(finding.evidence.file) || sensitivePathPattern.test(finding.evidence.snippet ?? "");
}

function sensitiveExternalSend(finding: Finding): boolean {
  const snippet = finding.evidence.snippet ?? "";
  return /payload|data|body|file|customer|user|invoice|secret|token|authorization/i.test(snippet);
}

function broadToolServer(component: Component): boolean {
  const metadata = component.metadata as { args?: string[]; env?: Record<string, string>; command?: string } | undefined;
  const values = [
    metadata?.command ?? "",
    ...(metadata?.args ?? []),
    ...Object.keys(metadata?.env ?? {})
  ].join(" ");
  return sensitiveSnippetPattern.test(values) || writeActionPattern.test(values);
}
