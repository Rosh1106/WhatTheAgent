// --fail-on threshold logic for CI gating.
//
// Given a threshold and an UnderstandResult, returns whether the process
// should exit non-zero, plus a short human summary of why. The threshold
// is inclusive: --fail-on high fails on high OR critical; --fail-on medium
// fails on medium, high, or critical; etc.

import type { RiskLevel, UnderstandResult } from "./types.js";

export type FailOnThreshold = "none" | "low" | "medium" | "high" | "critical";

const RANK: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const THRESHOLD_RANK: Record<FailOnThreshold, number> = {
  none: Number.POSITIVE_INFINITY,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export interface FailOnDecision {
  shouldFail: boolean;
  threshold: FailOnThreshold;
  chainCount: number;
  gapCount: number;
  message: string;
}

export function parseFailOnThreshold(value: string | undefined): FailOnThreshold {
  if (!value) return "none";
  const normalized = value.trim().toLowerCase();
  if (normalized === "none" || normalized === "off" || normalized === "never") return "none";
  if (normalized === "low" || normalized === "note") return "low";
  if (normalized === "medium" || normalized === "warning" || normalized === "warn") return "medium";
  if (normalized === "high" || normalized === "error") return "high";
  if (normalized === "critical") return "critical";
  throw new Error(`Invalid --fail-on value "${value}". Expected one of: none, low, medium, high, critical.`);
}

export function evaluateFailOn(result: UnderstandResult, threshold: FailOnThreshold): FailOnDecision {
  if (threshold === "none") {
    return { shouldFail: false, threshold, chainCount: 0, gapCount: 0, message: "Gating disabled (--fail-on none)." };
  }

  const minRank = THRESHOLD_RANK[threshold];
  const failingChains = result.riskChains.filter((chain) => RANK[chain.risk] >= minRank);
  const failingGaps = result.controlGaps
    .filter((gap) => gap.impact === "fix_required" || gap.impact === "fix_recommended")
    .filter((gap) => RANK[gap.risk] >= minRank);

  const total = failingChains.length + failingGaps.length;
  if (total === 0) {
    return {
      shouldFail: false,
      threshold,
      chainCount: 0,
      gapCount: 0,
      message: `No findings at or above '${threshold}'. CI gate passes.`
    };
  }

  const parts: string[] = [];
  if (failingChains.length > 0) parts.push(`${failingChains.length} risk chain${failingChains.length === 1 ? "" : "s"}`);
  if (failingGaps.length > 0) parts.push(`${failingGaps.length} control gap${failingGaps.length === 1 ? "" : "s"}`);

  return {
    shouldFail: true,
    threshold,
    chainCount: failingChains.length,
    gapCount: failingGaps.length,
    message: `WhatTheAgent: failing CI — ${parts.join(" and ")} at or above '${threshold}'.`
  };
}
