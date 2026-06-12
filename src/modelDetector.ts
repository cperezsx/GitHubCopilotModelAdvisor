import * as vscode from "vscode";
import { ModelInfo, Provider } from "./types";

export async function detectModels(): Promise<ModelInfo[]> {
  if (!vscode.lm?.selectChatModels) {
    throw new Error("VS Code 1.92 or newer is required for the language model API.");
  }

  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });

  return models.map((model) => {
    const family = model.family ?? model.id;

    return {
      id: model.id,
      name: model.name,
      vendor: model.vendor,
      family,
      version: model.version,
      maxInputTokens: model.maxInputTokens,
      provider: providerFromFamily(family)
    };
  });
}

export function providerFromFamily(family: string): Provider {
  const normalized = family.toLowerCase();

  if (normalized.startsWith("gpt") || normalized.startsWith("o1")) {
    return "openai";
  }

  if (normalized.startsWith("claude")) {
    return "anthropic";
  }

  if (normalized.startsWith("gemini")) {
    return "google";
  }

  return "github";
}
