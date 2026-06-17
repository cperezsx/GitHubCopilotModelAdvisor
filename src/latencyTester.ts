import * as vscode from "vscode";
import { LatencyResult, ModelInfo } from "./types";

const DEFAULT_TIMEOUT_MS = 8000;

export async function testModelLatency(
  model: ModelInfo,
  prompt: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<LatencyResult> {
  const tokenSource = new vscode.CancellationTokenSource();
  const timer = setTimeout(() => tokenSource.cancel(), timeoutMs);
  const start = Date.now();

  try {
    const [chatModel] = await vscode.lm.selectChatModels({
      vendor: "copilot",
      id: model.id
    });

    if (!chatModel) {
      return { status: "error", latency: null, error: "Model is no longer available." };
    }

    const request = await chatModel.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      tokenSource.token
    );

    for await (const _chunk of request.stream) {
      const latency = Date.now() - start;
      tokenSource.cancel();
      return { ...classifyLatency(latency), checkedAt: Date.now() };
    }

    return { status: "timeout", latency: null, checkedAt: Date.now() };
  } catch (error) {
    if (tokenSource.token.isCancellationRequested) {
      return { status: "timeout", latency: null, checkedAt: Date.now() };
    }

    return {
      status: "error",
      latency: null,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: Date.now()
    };
  } finally {
    clearTimeout(timer);
    tokenSource.dispose();
  }
}

export function classifyLatency(latency: number): LatencyResult {
  if (latency < 1500) {
    return { status: "fast", latency };
  }

  if (latency <= 4000) {
    return { status: "slow", latency };
  }

  return { status: "timeout", latency: null };
}
