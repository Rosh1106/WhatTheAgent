import path from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import type { Capability, Evidence, Finding, McpRiskFlag, McpServerComponent, WellKnownClient } from "../core/types.js";
import { classifyCapability } from "../risk/classifier.js";
import { compactSnippet, redactedRecord, relativePath, stableId } from "../utils/normalize.js";
import { readTextFileForScan } from "../utils/safeRead.js";

export interface ParsedMcpConfig {
  servers: McpServerComponent[];
  findings: Finding[];
}

interface RawMcpServer {
  command?: unknown;
  args?: unknown;
  env?: unknown;
  url?: unknown;
  transport?: unknown;
}

export async function parseMcpConfig(root: string, configFile: string, allowMcpExec = false, client?: WellKnownClient): Promise<ParsedMcpConfig> {
  const relPath = relativePath(root, configFile);
  const safeRead = await readTextFileForScan(configFile);
  if (safeRead.skipped) {
    return {
      servers: [],
      findings: [{
        id: stableId("finding", `${relPath}-skipped-large-mcp-config`),
        componentId: stableId("config", relPath),
        capability: "read_file",
        risk: "low",
        evidence: {
          file: relPath,
          pattern: "skipped:large-file",
          snippet: `Skipped MCP config larger than ${safeRead.skipped.maxBytes} bytes`
        }
      }]
    };
  }

  const raw = safeRead.content ?? "";
  const parsed = parseJsonc(raw) as unknown;
  const serverEntries = extractServerEntries(parsed);
  const servers: McpServerComponent[] = [];
  const findings: Finding[] = [];

  for (const [serverName, server] of serverEntries) {
    const command = readString(server.command);
    const args = readStringArray(server.args);
    const env = readStringRecord(server.env);
    const redactedEnv = redactedRecord(env);
    const url = readString(server.url);
    const transport = readString(server.transport);
    const riskFlags = detectRiskFlags(command, args, env, url);
    const componentId = stableId("mcp", `${relPath}-${serverName}`);

    const component: McpServerComponent = {
      id: componentId,
      type: "mcp_server",
      label: serverName,
      path: relPath,
      metadata: {
        configFile: relPath,
        serverName,
        clientId: client?.id,
        clientName: client?.name,
        command,
        args,
        env: redactedEnv,
        url,
        transport,
        riskFlags,
        staticOnly: !allowMcpExec
      }
    };

    servers.push(component);
    findings.push(...buildMcpFindings(component, raw));
  }

  return { servers, findings };
}

function extractServerEntries(value: unknown): Array<[string, RawMcpServer]> {
  if (!isObject(value)) return [];
  const root = value as Record<string, unknown>;
  const mcp = isObject(root.mcp) ? root.mcp : undefined;
  const container = firstObject(root.mcpServers, root.servers, root.mcp_servers, mcp?.servers, mcp?.mcpServers) ?? (looksLikeServerMap(root) ? root : undefined);
  if (!container) return [];

  return Object.entries(container)
    .filter(([, server]) => isObject(server) && looksLikeMcpServer(server))
    .map(([name, server]): [string, RawMcpServer] => [name, server as RawMcpServer])
    .sort(([left], [right]) => left.localeCompare(right));
}

function buildMcpFindings(component: McpServerComponent, raw: string): Finding[] {
  const findings: Finding[] = [];
  const metadata = component.metadata;
  const evidenceBase = (pattern: string): Evidence => {
    const foundLine = findLine(raw, pattern);
    return {
      file: metadata.configFile,
      line: foundLine?.line,
      snippet: foundLine?.snippet,
      pattern
    };
  };

  const add = (capability: Capability, pattern: string): void => {
    findings.push({
      id: stableId("finding", `${component.id}-${capability}-${pattern}`),
      componentId: component.id,
      capability,
      risk: classifyCapability(capability),
      evidence: evidenceBase(pattern)
    });
  };

  if (metadata.command) add("execute_code", "command");
  if (Object.keys(metadata.env).length > 0) add("credential_access", "env");
  if (metadata.url) add("network_access", "url");
  if (metadata.args.some((arg) => /^https?:\/\//i.test(arg))) add("network_access", "args:http");
  if (metadata.args.some((arg) => /stripe|payment|refund/i.test(arg))) add("payment", "args:payment");
  if (metadata.args.some((arg) => /order/i.test(arg))) add("order_placement", "args:order");

  return findings;
}

function detectRiskFlags(
  command: string | undefined,
  args: string[],
  env: Record<string, string>,
  url: string | undefined
): McpRiskFlag[] {
  const flags = new Set<McpRiskFlag>();
  if (command === "npx" && hasUnpinnedNpxPackage(args)) flags.add("unpinned_package");
  if (command === "docker" && args.some((arg) => /:latest\b/.test(arg))) flags.add("unpinned_image");
  if (url || args.some((arg) => /^https?:\/\//i.test(arg))) flags.add("remote_mcp");
  if (Object.keys(env).some((key) => /SECRET|TOKEN|KEY/i.test(key))) flags.add("sensitive_env");
  return [...flags].sort();
}

function hasUnpinnedNpxPackage(args: string[]): boolean {
  const packageArg = args.find((arg) => !arg.startsWith("-"));
  if (!packageArg) return false;
  if (/^@[^/]+\/[^@]+@[^@]+$/.test(packageArg)) return false;
  if (/^[^@]+@[^@]+$/.test(packageArg)) return false;
  return true;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, String(item)])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function firstObject(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isObject) as Record<string, unknown> | undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeServerMap(value: Record<string, unknown>): boolean {
  const entries = Object.values(value);
  return entries.length > 0 && entries.every((entry) => isObject(entry) && looksLikeMcpServer(entry));
}

function looksLikeMcpServer(value: Record<string, unknown>): boolean {
  return typeof value.command === "string" || typeof value.url === "string" || Array.isArray(value.args) || typeof value.transport === "string";
}

function findLine(content: string, pattern: string): { line: number; snippet: string } | undefined {
  const target = pattern.split(":")[0];
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(`"${target}"`) || line.includes(target));
  if (index === -1) return undefined;
  return {
    line: index + 1,
    snippet: compactSnippet(lines[index] ?? "")
  };
}
