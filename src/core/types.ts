export type ComponentType =
  | "skill"
  | "mcp_server"
  | "script"
  | "env_var"
  | "api_endpoint"
  | "capability";

export type Capability =
  | "read_file"
  | "write_file"
  | "delete_file"
  | "execute_code"
  | "network_access"
  | "external_send"
  | "credential_access"
  | "database_access"
  | "payment"
  | "order_placement"
  | "agent_delegation"
  | "approval_bypass";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Evidence {
  file: string;
  line?: number;
  snippet?: string;
  pattern: string;
}

export interface Finding {
  id: string;
  componentId: string;
  capability: Capability;
  risk: RiskLevel;
  evidence: Evidence;
}

export interface Component {
  id: string;
  type: ComponentType;
  label: string;
  path?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface SkillComponent extends Component {
  type: "skill";
  metadata: {
    name: string;
    description?: string;
    frontmatter: Record<string, unknown>;
    referencedFiles: string[];
    scripts: string[];
  };
}

export interface McpServerComponent extends Component {
  type: "mcp_server";
  metadata: {
    configFile: string;
    serverName: string;
    command?: string;
    args: string[];
    env: Record<string, string>;
    url?: string;
    transport?: string;
    riskFlags: McpRiskFlag[];
    staticOnly: boolean;
  };
}

export type McpRiskFlag =
  | "unpinned_package"
  | "unpinned_image"
  | "remote_mcp"
  | "sensitive_env";

export interface RiskChain {
  id: string;
  name: string;
  componentId: string;
  capabilities: Capability[];
  risk: RiskLevel;
  message: string;
  evidence: Evidence[];
}

export type GraphNodeType =
  | "Workspace"
  | "Skill"
  | "MCPServer"
  | "Script"
  | "EnvVar"
  | "APIEndpoint"
  | "Capability"
  | "RiskChain";

export type GraphEdgeType =
  | "CONTAINS"
  | "USES"
  | "CALLS"
  | "HAS_CAPABILITY"
  | "HAS_RISK_CHAIN"
  | "DEFINED_IN";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
  evidence?: Evidence;
}

export interface CapabilityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ScanSummary {
  componentsByType: Record<ComponentType, number>;
  capabilities: Record<Capability, number>;
  riskChainsByRisk: Record<RiskLevel, number>;
}

export interface ScanResult {
  schemaVersion: "0.1";
  workspace: {
    root: string;
  };
  components: Component[];
  findings: Finding[];
  riskChains: RiskChain[];
  graph: CapabilityGraph;
  summary: ScanSummary;
}

export interface ScanOptions {
  allowMcpExec?: boolean;
}

export interface DiffResult {
  addedComponents: Component[];
  removedComponents: Component[];
  addedCapabilities: Finding[];
  removedCapabilities: Finding[];
  addedGraphEdges: GraphEdge[];
  removedGraphEdges: GraphEdge[];
  addedRiskChains: RiskChain[];
  removedRiskChains: RiskChain[];
  riskLevelChanges: Array<{
    componentId: string;
    capability: Capability;
    from: RiskLevel;
    to: RiskLevel;
    evidence: Evidence;
  }>;
}
