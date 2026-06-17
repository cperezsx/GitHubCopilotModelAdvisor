import {
  AdvisorResult,
  LatencyResult,
  ModelInfo,
  ModelRecommendation,
  Provider,
  ServiceProvider,
  StatusResult,
  AdvisorMode,
  ConfidenceLevel,
  TaskProfile,
  TaskRecommendation
} from "./types";

export function buildAdvisorResult(
  models: ModelInfo[],
  latencyResults: Map<string, LatencyResult>,
  statusResults: Map<ServiceProvider, StatusResult>,
  mode: AdvisorMode,
  benchmarkedModelId?: string,
  options: { cacheTtlMinutes?: number } = {}
): AdvisorResult {
  const recommendations = models
    .map((model) => {
      const latency = latencyResults.get(model.id) ?? { status: "error", latency: null, error: "No latency result." };
      const statusKey = statusKeyForModel(model);
      const providerStatus = statusResults.get(statusKey) ?? {
        provider: statusKey,
        status: "unknown",
        incidents: [],
        statusPageUrl: statusPageUrl(statusKey),
        checkedAt: Date.now()
      };

      return scoreModel(model, latency, providerStatus);
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return latencyValue(left.latency) - latencyValue(right.latency);
    });

  const [best] = recommendations;
  const withRecommendation = recommendations.map((item) => ({
    ...item,
    recommended: item.model.id === best?.model.id
  }));
  const lastBenchmarkAt = latestBenchmarkTimestamp(withRecommendation);

  return {
    mode,
    benchmarkedModelId,
    checkedAt: Date.now(),
    models: withRecommendation,
    providers: Array.from(statusResults.values()),
    best,
    taskRecommendations: buildTaskRecommendations(withRecommendation),
    lastBenchmarkAt,
    cacheTtlMinutes: options.cacheTtlMinutes,
    tokenNotice:
      mode === "benchmark"
        ? "Latency benchmark sends a tiny prompt to each model and uses about 5 GitHub Copilot tokens per model."
        : mode === "selectedBenchmark"
          ? "Selected-model benchmark sends a tiny prompt to one model and uses a small amount of GitHub Copilot tokens."
          : mode === "cachedBenchmark"
            ? "Cached benchmark uses the last saved latency measurements and does not send prompts to any model."
            : lastBenchmarkAt
              ? "Health check does not send prompts to any model; cached benchmark latency is reused when available."
              : "Health check does not send prompts to any model, so it does not use GitHub Copilot tokens.",
    availabilityNotice: "Showing only GitHub Copilot models currently enabled for this user in VS Code."
  };
}

function latestBenchmarkTimestamp(models: ModelRecommendation[]): number | undefined {
  const timestamps = models
    .map((item) => item.latency.checkedAt)
    .filter((checkedAt): checkedAt is number => typeof checkedAt === "number");

  return timestamps.length > 0 ? Math.max(...timestamps) : undefined;
}

function statusKeyForModel(model: ModelInfo): ServiceProvider {
  return model.provider === "unknown" ? "github-copilot" : model.provider;
}

function statusPageUrl(provider: ServiceProvider): string {
  switch (provider) {
    case "openai":
      return "https://status.openai.com/";
    case "anthropic":
      return "https://status.claude.com/";
    case "google":
      return "https://status.cloud.google.com/";
    case "github-copilot":
      return "https://www.githubstatus.com/";
    case "unknown":
      return "https://www.githubstatus.com/";
  }
}

export function scoreModel(
  model: ModelInfo,
  latency: LatencyResult,
  providerStatus: StatusResult
): ModelRecommendation {
  const score = Math.max(
    0,
    100 - latencyPenalty(latency) - statusPenalty(providerStatus) - incidentPenalty(providerStatus) - stalePenalty(latency)
  );

  return {
    model,
    latency,
    providerStatus,
    score,
    confidence: confidenceFor(latency, providerStatus),
    reason: reasonFor(model, latency, providerStatus, score),
    recommended: false
  };
}

function latencyPenalty(result: LatencyResult): number {
  if (result.status === "skipped") {
    return 10;
  }

  if (result.status === "timeout") {
    return 90;
  }

  if (result.status === "error") {
    return 80;
  }

  if (result.latency < 800) {
    return 0;
  }

  if (result.latency < 1500) {
    return 10;
  }

  if (result.latency < 3000) {
    return 30;
  }

  return 50;
}

function statusPenalty(result: StatusResult): number {
  switch (result.status) {
    case "operational":
      return 0;
    case "degraded_performance":
      return 20;
    case "partial_outage":
      return 40;
    case "major_outage":
      return 80;
    case "unknown":
      return 5;
  }
}

function incidentPenalty(result: StatusResult): number {
  return result.incidents.length > 0 ? 30 : 0;
}

function stalePenalty(result: LatencyResult): number {
  return result.isStale ? 10 : 0;
}

function confidenceFor(
  latency: LatencyResult,
  providerStatus: StatusResult
): { level: ConfidenceLevel; reason: string } {
  if (latency.isStale) {
    return { level: "low", reason: "Latency is cached but older than the configured cache window." };
  }

  if (latency.source === "live" && providerStatus.status === "operational" && providerStatus.incidents.length === 0) {
    return { level: "high", reason: "Live latency and healthy provider status are both available." };
  }

  if (latency.source === "cache" && providerStatus.status === "operational" && providerStatus.incidents.length === 0) {
    return { level: "medium", reason: "Fresh cached latency is combined with current provider health." };
  }

  if (latency.status === "skipped" && providerStatus.status === "operational") {
    return { level: "medium", reason: "Provider health is current, but live latency has not been measured." };
  }

  return { level: "low", reason: "Recommendation depends on incomplete, stale, or degraded signals." };
}

function reasonFor(
  model: ModelInfo,
  latency: LatencyResult,
  providerStatus: StatusResult,
  score: number
): string {
  const providerLabel = providerName(model.provider);
  const healthLabel = providerStatus.provider === "github-copilot" ? "GitHub Copilot service" : providerLabel;
  const routeLabel = "via GitHub Copilot";

  if (score > 80 && latency.latency !== null) {
    if (latency.isStale) {
      return `${model.name} has cached latency (${latency.latency} ms), but that measurement is stale. Refresh the benchmark for a stronger signal.`;
    }

    return `${model.name} looks good right now: ${latency.latency} ms, ${providerLabel} ${routeLabel}, and ${healthLabel} is healthy.`;
  }

  if (latency.status === "skipped") {
    if (providerStatus.status === "operational") {
      return `${model.name} is enabled ${routeLabel}; ${healthLabel} health is good. Run a benchmark for live latency.`;
    }

    return `${model.name} is enabled ${routeLabel}, but live latency was not measured.`;
  }

  if (latency.status === "timeout") {
    return `${model.name} timed out before the first token.`;
  }

  if (providerStatus.status !== "operational" && providerStatus.status !== "unknown") {
    return `${healthLabel} is reporting ${providerStatus.status.replace("_", " ")}.`;
  }

  if (latency.status === "slow") {
    return `${model.name} is responding, but slower than ideal.`;
  }

  return `${model.name} is usable, with some uncertainty in the signal.`;
}

function latencyValue(result: LatencyResult): number {
  return result.latency ?? Number.MAX_SAFE_INTEGER;
}

function providerName(provider: Provider): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google";
    case "unknown":
      return "Unknown provider";
  }
}

function buildTaskRecommendations(models: ModelRecommendation[]): TaskRecommendation[] {
  return [
    recommendForTask("light", "Light tasks", models),
    recommendForTask("medium", "Medium tasks", models),
    recommendForTask("complex", "Complex tasks", models)
  ];
}

function recommendForTask(
  profile: TaskProfile,
  label: string,
  models: ModelRecommendation[]
): TaskRecommendation {
  const candidates = models
    .filter((item) => item.score > 0)
    .map((item) => ({
      item,
      taskScore: item.score + taskFitScore(profile, item.model)
    }))
    .sort((left, right) => {
      if (right.taskScore !== left.taskScore) {
        return right.taskScore - left.taskScore;
      }

      return latencyValue(left.item.latency) - latencyValue(right.item.latency);
    });

  const best = candidates[0]?.item;

  if (!best) {
    return {
      profile,
      label,
      reason: "No enabled GitHub Copilot model is usable for this task profile right now."
    };
  }

  return {
    profile,
    label,
    model: best.model,
    reason: taskReason(profile, best.model)
  };
}

function taskFitScore(profile: TaskProfile, model: ModelInfo): number {
  const weight = modelWeight(model);

  switch (profile) {
    case "light":
      return weight.light;
    case "medium":
      return weight.medium;
    case "complex":
      return weight.complex;
  }
}

function modelWeight(model: ModelInfo): { light: number; medium: number; complex: number } {
  const label = `${model.name} ${model.family} ${model.id}`.toLowerCase();

  if (containsAny(label, ["haiku", "mini", "nano", "flash", "lite", "small"])) {
    return { light: 28, medium: 8, complex: -12 };
  }

  if (containsAny(label, ["opus", "o1", "o3", "o4", "reasoning", "codex", "thinking"])) {
    return { light: -16, medium: 10, complex: 30 };
  }

  if (containsAny(label, ["sonnet", "gpt-4o", "gpt-4.1", "gpt-5", "gemini-pro", "pro"])) {
    return { light: -4, medium: 22, complex: 16 };
  }

  return { light: 4, medium: 10, complex: 4 };
}

function taskReason(profile: TaskProfile, model: ModelInfo): string {
  switch (profile) {
    case "light":
      return `${model.name} is the lightest good fit among the enabled models for quick edits, small questions, and low-friction checks.`;
    case "medium":
      return `${model.name} balances speed and capability for everyday coding tasks.`;
    case "complex":
      return `${model.name} is the strongest enabled fit for deeper reasoning, larger refactors, and harder debugging.`;
  }
}

function containsAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}
