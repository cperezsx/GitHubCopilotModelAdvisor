import * as https from "https";
import { Provider, ProviderStatusLevel, ServiceProvider, StatusResult } from "./types";

const STATUS_URLS: Partial<Record<ServiceProvider, string>> = {
  openai: "https://status.openai.com/api/v2/summary.json",
  anthropic: "https://status.claude.com/api/v2/summary.json",
  google: "https://status.cloud.google.com/incidents.json",
  "github-copilot": "https://www.githubstatus.com/api/v2/summary.json"
};

export async function checkProviderStatus(provider: ServiceProvider): Promise<StatusResult> {
  if (provider === "google") {
    return checkGoogleStatus();
  }

  if (provider === "unknown") {
    return unknownStatus(provider);
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
      statusPageUrl: statusPageUrl(provider),
      checkedAt: Date.now()
    };
  } catch {
    return unknownStatus(provider);
  }
}

function getJson<T>(url: string, timeoutMs: number, redirectsLeft = 3): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";

      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location &&
        redirectsLeft > 0
      ) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url).toString();
        getJson<T>(nextUrl, timeoutMs, redirectsLeft - 1).then(resolve, reject);
        return;
      }

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

async function checkGoogleStatus(): Promise<StatusResult> {
  const url = STATUS_URLS.google;

  if (!url) {
    return unknownStatus("google");
  }

  try {
    const incidents = await getJson<GoogleIncident[]>(url, 5000);
    const activeRelevantIncidents = incidents.filter((incident) => {
      if (incident.end || incident.status_impact === "SERVICE_INFORMATION") {
        return false;
      }

      const text = `${incident.service_name ?? ""} ${incident.external_desc ?? ""} ${JSON.stringify(incident.affected_products ?? [])}`.toLowerCase();
      return text.includes("gemini") || text.includes("vertex ai") || text.includes("generative ai");
    });

    return {
      provider: "google",
      status: worstStatus(activeRelevantIncidents.map((incident) => googleImpactToStatus(incident.status_impact))),
      incidents: activeRelevantIncidents.map((incident) => incident.external_desc || incident.service_name || "Google Cloud incident"),
      statusPageUrl: statusPageUrl("google"),
      checkedAt: Date.now()
    };
  } catch {
    return unknownStatus("google");
  }
}

function isRelevantComponent(provider: ServiceProvider, name: string): boolean {
  const normalized = name.toLowerCase();

  if (provider === "openai") {
    return normalized.includes("api");
  }

  if (provider === "anthropic") {
    return normalized.includes("api") || normalized.includes("claude");
  }

  if (provider === "github-copilot") {
    return normalized.includes("copilot");
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

function unknownStatus(provider: ServiceProvider, incident?: string): StatusResult {
  return {
    provider,
    status: "unknown",
    incidents: incident ? [incident] : [],
    statusPageUrl: statusPageUrl(provider),
    checkedAt: Date.now()
  };
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

function googleImpactToStatus(impact: string): ProviderStatusLevel {
  switch (impact) {
    case "SERVICE_OUTAGE":
      return "major_outage";
    case "SERVICE_DISRUPTION":
      return "partial_outage";
    case "SERVICE_INFORMATION":
      return "degraded_performance";
    default:
      return "unknown";
  }
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

type GoogleIncident = {
  service_name?: string;
  status_impact: string;
  external_desc?: string;
  end?: string;
  affected_products?: unknown[];
};
