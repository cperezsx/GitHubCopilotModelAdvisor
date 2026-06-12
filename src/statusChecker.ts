import * as https from "https";
import { Provider, ProviderStatusLevel, StatusResult } from "./types";

const STATUS_URLS: Partial<Record<Provider, string>> = {
  openai: "https://status.openai.com/api/v2/summary.json",
  anthropic: "https://status.anthropic.com/api/v2/summary.json",
  github: "https://www.githubstatus.com/api/v2/summary.json"
};

export async function checkProviderStatus(provider: Provider): Promise<StatusResult> {
  if (provider === "google") {
    return unknownStatus(provider, "Google status parsing is out of scope for v1.");
  }

  const url = STATUS_URLS[provider];

  if (!url) {
    return unknownStatus(provider);
  }

  try {
    const payload = await getJson<StatuspageSummary>(url, 5000);
    const relevantComponents = (payload.components ?? []).filter((component) =>
      isRelevantComponent(provider, component.name)
    );
    const componentStatus = worstStatus(relevantComponents.map((component) => component.status));
    const pageStatus = indicatorToStatus(payload.status?.indicator);
    const incidents = (payload.incidents ?? [])
      .filter((incident) => !incident.resolved_at)
      .map((incident) => incident.name)
      .filter(Boolean);

    return {
      provider,
      status: worstStatus([componentStatus, pageStatus]),
      incidents,
      checkedAt: Date.now()
    };
  } catch {
    return unknownStatus(provider);
  }
}

function getJson<T>(url: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("Status request timed out."));
    });
    request.on("error", reject);
  });
}

function isRelevantComponent(provider: Provider, name: string): boolean {
  const normalized = name.toLowerCase();

  if (provider === "openai") {
    return normalized.includes("api");
  }

  if (provider === "anthropic") {
    return normalized.includes("api") || normalized.includes("claude");
  }

  if (provider === "github") {
    return normalized.includes("copilot") || normalized.includes("actions");
  }

  return false;
}

function indicatorToStatus(indicator?: string): ProviderStatusLevel {
  switch (indicator) {
    case "none":
      return "operational";
    case "minor":
      return "degraded_performance";
    case "major":
      return "partial_outage";
    case "critical":
      return "major_outage";
    default:
      return "unknown";
  }
}

function worstStatus(statuses: ProviderStatusLevel[]): ProviderStatusLevel {
  const rank: Record<ProviderStatusLevel, number> = {
    operational: 0,
    unknown: 1,
    degraded_performance: 2,
    partial_outage: 3,
    major_outage: 4
  };

  return statuses.reduce<ProviderStatusLevel>((worst, current) => {
    return rank[current] > rank[worst] ? current : worst;
  }, "operational");
}

function unknownStatus(provider: Provider, incident?: string): StatusResult {
  return {
    provider,
    status: "unknown",
    incidents: incident ? [incident] : [],
    checkedAt: Date.now()
  };
}

type StatuspageSummary = {
  status?: {
    indicator?: string;
  };
  components?: Array<{
    name: string;
    status: ProviderStatusLevel;
  }>;
  incidents?: Array<{
    name: string;
    resolved_at: string | null;
  }>;
};
