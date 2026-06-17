export type Provider = "openai" | "anthropic" | "google" | "unknown";
export type ServiceProvider = Provider | "github-copilot";
export type LatencySource = "live" | "cache";
export type LatencyTrend = "faster" | "slower" | "stable";
export type ConfidenceLevel = "high" | "medium" | "low";

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

export type LatencyMetadata = {
  checkedAt?: number;
  source?: LatencySource;
  isStale?: boolean;
  previousLatency?: number;
  latencyDelta?: number;
  trend?: LatencyTrend;
  sampleCount?: number;
  medianLatency?: number;
};

export type LatencyResult =
  | ({ status: "fast"; latency: number } & LatencyMetadata)
  | ({ status: "slow"; latency: number } & LatencyMetadata)
  | ({ status: "skipped"; latency: null; reason: string } & LatencyMetadata)
  | ({ status: "timeout"; latency: null } & LatencyMetadata)
  | ({ status: "error"; latency: null; error: string } & LatencyMetadata);

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
  confidence: {
    level: ConfidenceLevel;
    reason: string;
  };
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

export type AdvisorMode = "healthOnly" | "benchmark" | "selectedBenchmark" | "cachedBenchmark";

export type AdvisorResult = {
  mode: AdvisorMode;
  benchmarkedModelId?: string;
  checkedAt: number;
  models: ModelRecommendation[];
  providers: StatusResult[];
  best?: ModelRecommendation;
  taskRecommendations: TaskRecommendation[];
  lastBenchmarkAt?: number;
  cacheTtlMinutes?: number;
  tokenNotice: string;
  availabilityNotice: string;
};
