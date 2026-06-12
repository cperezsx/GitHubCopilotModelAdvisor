export type Provider = "openai" | "anthropic" | "google" | "unknown";
export type ServiceProvider = Provider | "github-copilot";

export type ModelInfo = {
  id: string;
  name: string;
  vendor: string;
  family: string;
  version?: string;
  maxInputTokens?: number;
  provider: Provider;
  route: "github-copilot";
};

export type LatencyResult =
  | { status: "fast"; latency: number }
  | { status: "slow"; latency: number }
  | { status: "skipped"; latency: null; reason: string }
  | { status: "timeout"; latency: null }
  | { status: "error"; latency: null; error: string };

export type ProviderStatusLevel =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "unknown";

export type StatusResult = {
  provider: ServiceProvider;
  status: ProviderStatusLevel;
  incidents: string[];
  statusPageUrl: string;
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

export type TaskProfile = "light" | "medium" | "complex";

export type TaskRecommendation = {
  profile: TaskProfile;
  label: string;
  model?: ModelInfo;
  reason: string;
};

export type AdvisorMode = "healthOnly" | "benchmark" | "selectedBenchmark";

export type AdvisorResult = {
  mode: AdvisorMode;
  benchmarkedModelId?: string;
  checkedAt: number;
  models: ModelRecommendation[];
  providers: StatusResult[];
  best?: ModelRecommendation;
  taskRecommendations: TaskRecommendation[];
  tokenNotice: string;
  availabilityNotice: string;
};
