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
export type FindingCategory =
  | "inventory"
  | "observation"
  | "needs_attention"
  | "control_gap"
  | "risk_chain"
  | "fix_ready";
export type Confidence = "low" | "medium" | "high";
export type UserImpact =
  | "informational"
  | "review_recommended"
  | "fix_recommended"
  | "fix_required";

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
  category?: FindingCategory;
  confidence?: Confidence;
  impact?: UserImpact;
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
  category?: FindingCategory;
  confidence?: Confidence;
  impact?: UserImpact;
}

export type GraphNodeType =
  | "Workspace"
  | "Agent"
  | "Skill"
  | "Prompt"
  | "Rule"
  | "ToolServer"
  | "Script"
  | "Config"
  | "Secret"
  | "ExternalService"
  | "Database"
  | "ScheduledTask"
  | "CIWorkflow"
  | "EnvVar"
  | "APIEndpoint"
  | "Capability"
  | "Observation"
  | "Control"
  | "ControlGap"
  | "RiskChain"
  | "QuickFix"
  | "ImplementationTask";

export type GraphEdgeType =
  | "CONTAINS"
  | "USES"
  | "CALLS"
  | "READS"
  | "WRITES"
  | "SENDS_TO"
  | "ACCESSES"
  | "HAS_CAPABILITY"
  | "HAS_RISK_CHAIN"
  | "PROTECTED_BY"
  | "MISSING_CONTROL"
  | "PART_OF_RISK_CHAIN"
  | "CAN_BE_FIXED_BY"
  | "IMPLEMENTED_BY"
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

export type CapabilityState =
  | "declared"
  | "inferred"
  | "sandbox_confirmed"
  | "sandbox_blocked"
  | "not_tested"
  | "unknown";

export type ControlType =
  | "human_approval"
  | "command_allowlist"
  | "external_domain_allowlist"
  | "secret_redaction"
  | "secret_scoping"
  | "read_only_filesystem"
  | "network_restriction"
  | "sandbox_enabled"
  | "ci_gate"
  | "audit_logging"
  | "policy_file"
  | "least_privilege_token"
  | "delegation_policy"
  | "payment_approval";

export type FixKind = "safe_autofix" | "guided_fix" | "agent_implementation_task";

export interface NormalizedCapability {
  capability: Capability;
  state: CapabilityState;
  count: number;
  risk: RiskLevel;
  evidence: Evidence[];
  category?: FindingCategory;
  confidence?: Confidence;
  impact?: UserImpact;
}

export interface AgentSurface {
  id: string;
  type: "skill" | "script" | "tool_server" | "config";
  subtype?: string;
  label: string;
  path?: string;
  capabilities: Capability[];
  controls: ControlType[];
  controlGaps: string[];
  riskChains: string[];
}

export interface ToolServer {
  id: string;
  type: "ToolServer";
  subtype: "mcp_server";
  label: string;
  path?: string;
  command?: string;
  args: string[];
  transport?: string;
  envVars: string[];
  capabilities: Capability[];
  controls: ControlType[];
  controlGaps: string[];
  riskChains: string[];
}

export interface Control {
  id: string;
  type: ControlType;
  label: string;
  status: "detected" | "missing" | "unknown";
  componentId?: string;
  evidence?: Evidence;
}

export interface ControlGap {
  id: string;
  control: ControlType;
  componentId: string;
  risk: RiskLevel;
  message: string;
  evidence: Evidence[];
  category?: FindingCategory;
  confidence?: Confidence;
  impact?: UserImpact;
}

export interface QuickFix {
  id: string;
  kind: FixKind;
  title: string;
  componentId?: string;
  risk: RiskLevel;
  rationale: string;
  steps: string[];
  controlGaps: string[];
  category?: FindingCategory;
  confidence?: Confidence;
  impact?: UserImpact;
}

export interface ImplementationTask {
  id: string;
  title: string;
  priority: RiskLevel;
  targetFiles: string[];
  instructions: string;
  acceptanceCriteria: string[];
  relatedQuickFixes: string[];
  category?: FindingCategory;
  confidence?: Confidence;
  impact?: UserImpact;
  verificationCommands?: string[];
  doNotDo?: string[];
  why?: string;
}

export interface Observation {
  id: string;
  componentId: string;
  capability?: Capability;
  category: "inventory" | "observation" | "needs_attention";
  confidence: Confidence;
  impact: UserImpact;
  message: string;
  evidence: Evidence[];
  expected?: boolean;
  suppressionReason?: string;
}

export interface SetupInventory {
  workspaceRoot: string;
  surfaces: AgentSurface[];
  toolServers: ToolServer[];
  counts: {
    skills: number;
    scripts: number;
    toolServers: number;
    findings: number;
    riskChains: number;
  };
}

export interface UnderstandResult {
  schemaVersion: "0.1";
  workspace: {
    root: string;
  };
  inventory: SetupInventory;
  capabilities: NormalizedCapability[];
  observations: Observation[];
  expected: Observation[];
  controls: Control[];
  controlGaps: ControlGap[];
  riskChains: RiskChain[];
  quickFixes: QuickFix[];
  implementationTasks: ImplementationTask[];
  graph: CapabilityGraph;
  scan: ScanResult;
  summary: {
    capabilityCount: number;
    controlGapCount: number;
    quickFixCount: number;
    implementationTaskCount: number;
    criticalRiskChains: number;
    highRiskChains: number;
  };
}

export type AgentPlanTarget = "generic" | "codex" | "claude";

export interface AgentPlan {
  schemaVersion: "0.1";
  target: AgentPlanTarget;
  generatedFrom: "understand";
  workspace: {
    root: string;
  };
  summary: UnderstandResult["summary"];
  tasks: ImplementationTask[];
  instructions: string;
  acceptanceCriteria: string[];
  prompt: string;
  verificationCommands: string[];
  doNotDo: string[];
}

export type ProbeStatus = "not_run" | "sandbox_confirmed" | "sandbox_blocked" | "skipped";

export interface SandboxProbe {
  id: string;
  capability: Capability;
  status: ProbeStatus;
  safe: boolean;
  description: string;
  commandPreview?: string;
  expectedControl?: ControlType;
}

export interface ProbePlan {
  schemaVersion: "0.1";
  workspace: {
    root: string;
  };
  mode: "plan_only";
  probes: SandboxProbe[];
  warning: string;
}

export type RuntimeMode = "observe" | "warn" | "approval" | "enforce";

export interface RuntimePlan {
  schemaVersion: "0.1";
  workspace: {
    root: string;
  };
  mode: RuntimeMode;
  status: "preview_only";
  policies: Array<{
    id: string;
    control: ControlType;
    action: "observe" | "warn" | "require_approval" | "block";
    appliesTo: string[];
  }>;
  warning: string;
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
