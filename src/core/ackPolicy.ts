import fs from "node:fs/promises";
import path from "node:path";
import type { Capability, ScanResult } from "./types.js";
import { scanWorkspace } from "./scanWorkspace.js";
import { starterPolicy } from "./personalAgentBaseline.js";

export interface AckBatchItem {
  componentId: string;
  capability?: Capability;
  reason?: string;
}

export interface AckBatchOptions {
  workspaceRoot: string;
  policyFile: string;
  items: AckBatchItem[];
  defaultReason?: string;
  scan?: ScanResult;
}

export interface AckBatchResult {
  policyFile: string;
  added: AckEntry[];
  alreadyPresent: AckEntry[];
  skipped: Array<{ componentId: string; capability?: Capability; reason: string }>;
  itemCount: number;
}

export interface AckEntry {
  componentId: string;
  capability: Capability;
  reason: string;
}

export interface AckResult {
  policyFile: string;
  added: AckEntry[];
  alreadyPresent: AckEntry[];
  capabilitiesFound: Capability[];
  componentExists: boolean;
}

export interface AckOptions {
  workspaceRoot: string;
  policyFile: string;
  componentId: string;
  capability?: Capability;
  reason: string;
  scan?: ScanResult;
}

export async function ackInPolicy(options: AckOptions): Promise<AckResult> {
  const scan = options.scan ?? await scanWorkspace(options.workspaceRoot);
  const findings = scan.findings.filter((finding) => finding.componentId === options.componentId);
  const componentExists = scan.components.some((component) => component.id === options.componentId);
  const capabilitiesFound = uniqueSorted(findings.map((finding) => finding.capability));

  const targetCapabilities: Capability[] = options.capability
    ? [options.capability]
    : capabilitiesFound;

  if (!options.capability && targetCapabilities.length === 0) {
    throw new Error(`Component "${options.componentId}" was not found in the scan, or has no detected capabilities to acknowledge. Pass an explicit <capability> to ack it anyway.`);
  }

  const entries: AckEntry[] = targetCapabilities.map((capability) => ({
    componentId: options.componentId,
    capability,
    reason: options.reason
  }));

  const existing = await readExistingExpectedKeys(options.policyFile);
  const alreadyPresent = entries.filter((entry) => existing.has(`${entry.componentId}:${entry.capability}`));
  const toAdd = entries.filter((entry) => !existing.has(`${entry.componentId}:${entry.capability}`));

  if (toAdd.length > 0) {
    await appendToPolicy(options.policyFile, toAdd);
  }

  return {
    policyFile: options.policyFile,
    added: toAdd,
    alreadyPresent,
    capabilitiesFound,
    componentExists
  };
}

async function readExistingExpectedKeys(policyFile: string): Promise<Set<string>> {
  let raw: string;
  try {
    raw = await fs.readFile(policyFile, "utf8");
  } catch (error) {
    if (isMissing(error)) return new Set();
    throw error;
  }
  const keys = new Set<string>();
  const componentRegex = /^\s*-\s*component\s*:\s*"?([^"\n]+)"?\s*$/gm;
  const capabilityRegex = /^\s*capability\s*:\s*"?([^"\n]+)"?\s*$/gm;
  const components: string[] = [];
  const capabilities: string[] = [];
  for (const match of raw.matchAll(componentRegex)) components.push(match[1]?.trim() ?? "");
  for (const match of raw.matchAll(capabilityRegex)) capabilities.push(match[1]?.trim() ?? "");
  const length = Math.min(components.length, capabilities.length);
  for (let i = 0; i < length; i += 1) keys.add(`${components[i]}:${capabilities[i]}`);
  return keys;
}

async function appendToPolicy(policyFile: string, entries: AckEntry[]): Promise<void> {
  const exists = await fileExists(policyFile);
  if (!exists) {
    await fs.mkdir(path.dirname(path.resolve(policyFile)), { recursive: true });
    const seed = starterPolicy("personal-agent");
    await fs.writeFile(policyFile, seed, "utf8");
  }
  const current = await fs.readFile(policyFile, "utf8");
  const next = insertExpectedEntries(current, entries);
  await fs.writeFile(policyFile, next, "utf8");
}

export function insertExpectedEntries(yaml: string, entries: AckEntry[]): string {
  const block = entries
    .map((entry) => `  - component: "${entry.componentId}"\n    capability: "${entry.capability}"\n    reason: "${escapeYamlString(entry.reason)}"`)
    .join("\n");

  if (/^expected:\s*$/m.test(yaml)) {
    return yaml.replace(/^expected:\s*\n(\s*\[\s*\]\s*\n)?/m, (match) => {
      if (match.includes("[]")) {
        return `expected:\n${block}\n`;
      }
      return `expected:\n${block}\n`;
    });
  }

  if (/^expected:/m.test(yaml)) {
    return yaml.replace(/^expected:.*$/m, (match) => `${match}\n${block}`);
  }

  const trimmed = yaml.endsWith("\n") ? yaml : `${yaml}\n`;
  return `${trimmed}\nexpected:\n${block}\n`;
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function uniqueSorted<T>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

export async function readReasonFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("No reason was provided on stdin. Pipe a non-empty string in, e.g. `echo \"...\" | wta ack ...`.");
  return text;
}

export async function ackBatchInPolicy(options: AckBatchOptions): Promise<AckBatchResult> {
  if (options.items.length === 0) {
    return { policyFile: options.policyFile, added: [], alreadyPresent: [], skipped: [], itemCount: 0 };
  }

  const scan = options.scan ?? await scanWorkspace(options.workspaceRoot);
  const findingsByComponent = new Map<string, Capability[]>();
  for (const finding of scan.findings) {
    const list = findingsByComponent.get(finding.componentId) ?? [];
    list.push(finding.capability);
    findingsByComponent.set(finding.componentId, list);
  }
  const componentIds = new Set(scan.components.map((component) => component.id));

  const expanded: AckEntry[] = [];
  const skipped: AckBatchResult["skipped"] = [];
  for (const item of options.items) {
    const reason = item.reason ?? options.defaultReason;
    if (!reason || !reason.trim()) {
      skipped.push({ componentId: item.componentId, capability: item.capability, reason: "no reason supplied (item-level reason or --reason)" });
      continue;
    }
    if (item.capability) {
      expanded.push({ componentId: item.componentId, capability: item.capability, reason });
      continue;
    }
    const detected = uniqueSorted(findingsByComponent.get(item.componentId) ?? []);
    if (detected.length === 0 && !componentIds.has(item.componentId)) {
      skipped.push({ componentId: item.componentId, reason: "component not found in scan and no explicit capability supplied" });
      continue;
    }
    if (detected.length === 0) {
      skipped.push({ componentId: item.componentId, reason: "component has no detected capabilities; specify one explicitly" });
      continue;
    }
    for (const capability of detected) expanded.push({ componentId: item.componentId, capability, reason });
  }

  if (expanded.length === 0) {
    return { policyFile: options.policyFile, added: [], alreadyPresent: [], skipped, itemCount: options.items.length };
  }

  const existing = await readExistingExpectedKeys(options.policyFile);
  const seen = new Set<string>();
  const toAdd: AckEntry[] = [];
  const alreadyPresent: AckEntry[] = [];
  for (const entry of expanded) {
    const key = `${entry.componentId}:${entry.capability}`;
    if (existing.has(key)) {
      alreadyPresent.push(entry);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    toAdd.push(entry);
  }

  if (toAdd.length > 0) {
    await appendToPolicy(options.policyFile, toAdd);
  }

  return { policyFile: options.policyFile, added: toAdd, alreadyPresent, skipped, itemCount: options.items.length };
}

export function parseAckBatchInput(raw: string): AckBatchItem[] {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty input. Pipe a JSON array of ack items on stdin.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse stdin as JSON: ${message}`);
  }
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of objects with at least { componentId, reason }.");
  return parsed.map((entry, index) => normalizeBatchItem(entry, index));
}

function normalizeBatchItem(value: unknown, index: number): AckBatchItem {
  if (!value || typeof value !== "object") throw new Error(`Item ${index} is not an object.`);
  const record = value as Record<string, unknown>;
  const componentId = record.componentId;
  if (typeof componentId !== "string" || !componentId.trim()) {
    throw new Error(`Item ${index} is missing a string \"componentId\".`);
  }
  const item: AckBatchItem = { componentId: componentId.trim() };
  if (typeof record.capability === "string" && record.capability.trim()) {
    item.capability = record.capability.trim() as Capability;
  }
  if (typeof record.reason === "string" && record.reason.trim()) {
    item.reason = record.reason.trim();
  }
  return item;
}

export async function readJsonFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}
