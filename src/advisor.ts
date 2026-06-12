import {
  AdvisorResult,
  LatencyResult,
  ModelInfo,
  ModelRecommendation,
  Provider,
  StatusResult
} from "./types";

export function buildAdvisorResult(
  models: ModelInfo[],
  latencyResults: Map<string, LatencyResult>,
  statusResults: Map<Provider, StatusResult>
): AdvisorResult {
  const recommendations = models
    .map((model) => {
      const latency = latencyResults.get(model.id) ?? { status: "error", latency: null, error: "No latency result." };
      const providerStatus = statusResults.get(model.provider) ?? {
        provider: model.provider,
        status: "unknown",
        incidents: [],
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

  return {
    checkedAt: Date.now(),
    models: withRecommendation,
    providers: Array.from(statusResults.values()),
    best,
    tokenNotice: "This check uses about 5 Copilot tokens per model."
  };
}

export function scoreModel(
  model: ModelInfo,
  latency: LatencyResult,
  providerStatus: StatusResult
): ModelRecommendation {
  const score = Math.max(
    0,
    100 - latencyPenalty(latency) - statusPenalty(providerStatus) - incidentPenalty(providerStatus)
  );

  return {
    model,
    latency,
    providerStatus,
    score,
    reason: reasonFor(model, latency, providerStatus, score),
    recommended: false
  };
}

function latencyPenalty(result: LatencyResult): number {
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

function reasonFor(
  model: ModelInfo,
  latency: LatencyResult,
  providerStatus: StatusResult,
  score: number
): string {
  const providerLabel = providerName(model.provider);

  if (score > 80 && latency.latency !== null) {
    return `${model.name} looks good right now: ${latency.latency} ms and ${providerLabel} is healthy.`;
  }

  if (latency.status === "timeout") {
    return `${model.name} timed out before the first token.`;
  }

  if (providerStatus.status !== "operational" && providerStatus.status !== "unknown") {
    return `${providerLabel} is reporting ${providerStatus.status.replace("_", " ")}.`;
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
    case "github":
      return "GitHub";
  }
}
