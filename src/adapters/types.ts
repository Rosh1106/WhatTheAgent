import type { AdapterMetadata, AdapterScanResult } from "../core/types.js";

export type { AdapterMetadata, AdapterScanResult };

export interface AgentAdapter {
  metadata: AdapterMetadata;
  scan(root: string): Promise<AdapterScanResult>;
}
