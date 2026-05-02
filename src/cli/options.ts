import type { AgentProfile, RuntimeMode } from "../core/types.js";

export interface GlobalOptions {
  json?: boolean;
  noColor?: boolean;
  quiet?: boolean;
  output?: string;
  allowMcpExec?: boolean;
  html?: boolean;
  forAgent?: boolean;
  forCodex?: boolean;
  forClaude?: boolean;
  forOpenclaw?: boolean;
  forHermes?: boolean;
  ui?: boolean;
  mode?: RuntimeMode;
  profile?: AgentProfile;
  baseline?: string;
  force?: boolean;
}
