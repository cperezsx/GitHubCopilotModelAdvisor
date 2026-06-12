import * as vscode from "vscode";
import { ModelInfo, Provider } from "./types";

export async function detectModels(): Promise<ModelInfo[]> {
  if (!vscode.lm?.selectChatModels) {
    throw new Error("VS Code 1.92 or newer is required for the language model API.");
  }

  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });

  const detected = models.filter((model) => !isAutoRoutingEntry(model)).map((model) => {
    const family = model.family ?? model.id;
    const provider = providerFromModel(model.name, family, model.id);

    return {
      id: model.id,
      name: model.name,
      vendor: model.vendor,
      family,
      version: model.version,
      maxInputTokens: model.maxInputTokens,
      provider,
      route: "github-copilot" as const
    };
  });

  return dedupeModels(detected).sort(compareModels);
}

// Copilot's "Auto" entry is a routing alias, not a concrete model: GitHub picks
// the underlying model per request, so latency and provider health cannot be
// attributed to it honestly. Keep it out of detection, scoring, and benchmarks.
function isAutoRoutingEntry(model: vscode.LanguageModelChat): boolean {
  const candidates = [model.id, model.name, model.family];
  return candidates.some((value) => value?.trim().toLowerCase() === "auto");
}

export function providerFromModel(name: string, family: string, id: string): Provider {
  const normalized = `${name} ${family} ${id}`.toLowerCase();

  if (
    containsAny(normalized, ["gpt", "openai", "codex"]) ||
    /\bo[1-9]\b/.test(normalized)
  ) {
    return "openai";
  }

  if (containsAny(normalized, ["claude", "anthropic", "haiku", "sonnet", "opus"])) {
    return "anthropic";
  }

  if (containsAny(normalized, ["gemini", "google"])) {
    return "google";
  }

  return "unknown";
}

function dedupeModels(models: ModelInfo[]): ModelInfo[] {
  const byDisplayIdentity = new Map<string, ModelInfo>();

  for (const model of models) {
    const key = [
      model.provider,
      normalizeModelLabel(model.name)
    ].join("|");

    if (!byDisplayIdentity.has(key)) {
      byDisplayIdentity.set(key, model);
    }
  }

  return Array.from(byDisplayIdentity.values());
}

function compareModels(left: ModelInfo, right: ModelInfo): number {
  const providerDelta = providerRank(left.provider) - providerRank(right.provider);

  if (providerDelta !== 0) {
    return providerDelta;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });
}

function providerRank(provider: Provider): number {
  switch (provider) {
    case "openai":
      return 0;
    case "anthropic":
      return 1;
    case "google":
      return 2;
    case "unknown":
      return 3;
  }
}

function normalizeModelLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}
