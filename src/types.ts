export type Provider = "openai" | "anthropic" | "google" | "github";

export type ModelInfo = {
  id: string;
  name: string;
  vendor: string;
  family: string;
  version?: string;
  maxInputTokens?: number;
  provider: Provider;
};

export type LatencyResult =
  | { status: "fast"; latency: number }
  | { status: "slow"; latency: number }
  | { status: "timeout"; latency: null }
  | { status: "error"; latency: null; error: string };

export type ProviderStatusLevel =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "unknown";

export type StatusResult = {
  provider: Provider;
  status: ProviderStatusLevel;
  incidents: string[];
  checkedAt: number;
};

export type ModelRecommendation = {
  model: ModelInfo;
  latency: LatencyResult;
  providerStatus: StatusResult;
  score: number;
  reason: string;
  recommended: boolean;
};

export type AdvisorResult = {
  checkedAt: number;
  models: ModelRecommendation[];
  providers: StatusResult[];
  best?: ModelRecommendation;
  tokenNotice: string;
};
