import type { AdapterMetadata, AdapterScanResult, McpServerComponent } from "../core/types.js";
import { parseMcpConfig } from "../parser/mcpParser.js";
import { findExistingFiles } from "../utils/fileWalker.js";
import { relativePath } from "../utils/normalize.js";

export async function scanMcpConfigFiles(root: string, files: string[], adapter: AdapterMetadata): Promise<AdapterScanResult> {
  const configFiles = await findExistingFiles(root, files);
  const components: McpServerComponent[] = [];
  const findings = [];

  for (const configFile of configFiles) {
    const parsed = await parseMcpConfig(root, configFile, false, adapter);
    components.push(...parsed.servers);
    findings.push(...parsed.findings);
  }

  return {
    adapter,
    components,
    findings,
    detectedFiles: configFiles.map((file) => relativePath(root, file)).sort()
  };
}
