import * as vscode from "vscode";
import { buildAdvisorResult } from "./advisor";
import { checkProviderStatus } from "./statusChecker";
import { testModelLatency } from "./latencyTester";
import { detectModels } from "./modelDetector";
import { AdvisorWebviewViewProvider } from "./webviewViewProvider";
import { LatencyResult, ModelInfo, Provider, ServiceProvider, StatusResult } from "./types";

let statusBarItem: vscode.StatusBarItem;
let lastResult: ReturnType<typeof buildAdvisorResult> | null = null;
type CheckMode = "healthOnly" | "benchmark";
const BENCHMARK_CACHE_KEY = "githubCopilotModelAdvisor.benchmarkCache.v1";
const MAX_HISTORY_SAMPLES = 5;

type StoredLatencySample = {
  status: Exclude<LatencyResult["status"], "skipped">;
  latency: number | null;
  checkedAt: number;
};

type StoredLatencyEntry = {
  latest: LatencyResult;
  history: StoredLatencySample[];
};

type StoredBenchmarkCacheV1 = {
  version: 1;
  updatedAt: number;
  latencies: Record<string, LatencyResult>;
};

type StoredBenchmarkCache = {
  version: 2;
  updatedAt: number;
  models: Record<string, StoredLatencyEntry>;
};

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("GitHubCopilotModelAdvisor");
  const provider = new AdvisorWebviewViewProvider(context.extensionUri, async (modelId) => {
    await runSelectedBenchmark(context, provider, output, modelId);
  });

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "githubCopilotModelAdvisor.checkNow";
  statusBarItem.text = "$(pulse) Model Advisor";
  statusBarItem.tooltip = "Check GitHub Copilot model availability and health sources";

  const showStatusBar = vscode.workspace
    .getConfiguration("githubCopilotModelAdvisor")
    .get<boolean>("showInStatusBar", true);

  if (showStatusBar) {
    statusBarItem.show();
  }

  context.subscriptions.push(
    output,
    statusBarItem,
    vscode.window.registerWebviewViewProvider("githubCopilotModelAdvisor.panel", provider),
    vscode.commands.registerCommand("githubCopilotModelAdvisor.open", () => provider.reveal()),
    vscode.commands.registerCommand("githubCopilotModelAdvisor.openSettings", () =>
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:cperezsx.githubcopilotmodeladvisor"
      )
    ),
    vscode.commands.registerCommand("githubCopilotModelAdvisor.checkNow", async () => {
      await runCheck(context, provider, output, true, "healthOnly");
    }),
    vscode.commands.registerCommand("githubCopilotModelAdvisor.benchmarkNow", async () => {
      await runCheck(context, provider, output, true, "benchmark");
    }),
    vscode.commands.registerCommand("githubCopilotModelAdvisor.copyDiagnostics", async () => {
      await copyDiagnostics(context);
    })
  );

  const autoCheck = vscode.workspace
    .getConfiguration("githubCopilotModelAdvisor")
    .get<boolean>("autoCheckOnStartup", false);

  if (autoCheck) {
    void runCheck(context, provider, output, false, "healthOnly");
  }
}

export function deactivate(): void {
  statusBarItem?.dispose();
}

async function runCheck(
  context: vscode.ExtensionContext,
  provider: AdvisorWebviewViewProvider,
  output: vscode.OutputChannel,
  notify: boolean,
  mode: CheckMode
): Promise<void> {
  if (mode === "healthOnly") {
    provider.setLoading(mode);
    statusBarItem.text = "$(pulse) Checking health";
  } else {
    statusBarItem.text = "$(watch) Benchmark ready";
    statusBarItem.tooltip = "Waiting for confirmation before sending benchmark prompts";
  }

  try {
    const config = vscode.workspace.getConfiguration("githubCopilotModelAdvisor");
    const prompt = config.get<string>("testPrompt", "hi");
    const cacheTtlMinutes = getBenchmarkCacheTtlMinutes(config);
    const allowBenchmarkAll = config.get<boolean>("allowBenchmarkAll", true);
    const models = await detectModels();
    const benchmarkCache = filterBenchmarkCacheForModels(loadBenchmarkCache(context), models, cacheTtlMinutes);

    if (models.length === 0) {
      throw new Error("No GitHub Copilot models were found. Check that GitHub Copilot Chat is installed and signed in.");
    }

    if (mode === "benchmark") {
      if (!allowBenchmarkAll) {
        void vscode.window.showWarningMessage(
          "Benchmark all is disabled in settings. Use the Benchmark button on a single model instead.",
          "Open Settings"
        ).then((selection) => {
          if (selection === "Open Settings") {
            void vscode.commands.executeCommand("githubCopilotModelAdvisor.openSettings");
          }
        });
        statusBarItem.text = "$(pulse) Model Advisor";
        statusBarItem.tooltip = "Benchmark all is disabled in settings.";
        return;
      }

      const choice = await confirmBenchmarkTokenUse(models.length, prompt, benchmarkCache);

      if (choice === "cancel") {
        statusBarItem.text = "$(pulse) Model Advisor";
        statusBarItem.tooltip = "Latency benchmark cancelled before sending prompts.";
        return;
      }

      if (choice === "cached") {
        provider.setLoading("healthOnly");
        statusBarItem.text = "$(database) Loading cached benchmark";
        statusBarItem.tooltip = benchmarkCache
          ? `Using cached benchmark from ${formatDateTime(benchmarkCache.updatedAt)}`
          : "Using cached benchmark";

        const providers = serviceProvidersForModels(models);
        const [latencies, statuses] = await Promise.all([
          collectCachedOrSkippedLatencies(models, benchmarkCache),
          collectStatuses(providers)
        ]);
        const result = buildAdvisorResult(models, latencies, statuses, "cachedBenchmark", undefined, { cacheTtlMinutes });
        lastResult = result;
        provider.setResult(result);
        writeOutput(output, result);
        updateStatusFromResult(result, notify, output);
        return;
      }

      provider.setLoading(mode);
      statusBarItem.text = "$(pulse) Benchmarking models";
      statusBarItem.tooltip = "Sending tiny prompts to measure first-token latency";
    }

    const providers = serviceProvidersForModels(models);
    const [latencies, statuses] = await Promise.all([
      mode === "benchmark" ? collectLatencies(models, prompt, benchmarkCache) : collectCachedOrSkippedLatencies(models, benchmarkCache),
      collectStatuses(providers)
    ]);
    const result = buildAdvisorResult(models, latencies, statuses, mode, undefined, { cacheTtlMinutes });
    lastResult = result;

    if (mode === "benchmark") {
      await saveBenchmarkCache(context, latencies);
    }

    provider.setResult(result);
    writeOutput(output, result);
    updateStatusFromResult(result, notify, output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    statusBarItem.text = "$(warning) Check models";
    statusBarItem.tooltip = message;
    provider.setError(message);
    output.appendLine(`[error] ${message}`);

    if (notify) {
      void vscode.window.showErrorMessage(message, "See Details").then((selection) => {
        if (selection === "See Details") {
          output.show();
        }
      });
    }
  }
}

async function runSelectedBenchmark(
  context: vscode.ExtensionContext,
  provider: AdvisorWebviewViewProvider,
  output: vscode.OutputChannel,
  modelId: string
): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration("githubCopilotModelAdvisor");
    const prompt = config.get<string>("testPrompt", "hi");
    const cacheTtlMinutes = getBenchmarkCacheTtlMinutes(config);
    const models = await detectModels();
    const selectedModel = models.find((model) => model.id === modelId);
    const benchmarkCache = filterBenchmarkCacheForModels(loadBenchmarkCache(context), models, cacheTtlMinutes);

    if (!selectedModel) {
      throw new Error("Selected model is no longer enabled for this user.");
    }

    const choice = await confirmSelectedBenchmarkTokenUse(selectedModel, prompt, benchmarkCache);

    if (choice === "cancel") {
      statusBarItem.text = "$(pulse) Model Advisor";
      statusBarItem.tooltip = "Selected-model benchmark cancelled before sending a prompt.";
      return;
    }

    if (choice === "cached") {
      provider.setLoading("healthOnly");
      statusBarItem.text = `$(database) ${selectedModel.name}`;
      statusBarItem.tooltip = benchmarkCache
        ? `Using cached benchmark from ${formatDateTime(benchmarkCache.updatedAt)}`
        : "Using cached benchmark";
    } else {
      provider.setLoading("selectedBenchmark", selectedModel.name);
      statusBarItem.text = `$(pulse) Benchmarking ${selectedModel.name}`;
      statusBarItem.tooltip = "Sending one tiny prompt to measure first-token latency";
    }

    const providers = serviceProvidersForModels(models);
    const [latencies, statuses] = await Promise.all([
      choice === "cached"
        ? collectCachedOrSkippedLatencies(models, benchmarkCache)
        : collectSelectedLatency(models, selectedModel, prompt, lastResult?.models, benchmarkCache),
      collectStatuses(providers)
    ]);
    const result = buildAdvisorResult(
      models,
      latencies,
      statuses,
      choice === "cached" ? "cachedBenchmark" : "selectedBenchmark",
      selectedModel.id,
      { cacheTtlMinutes }
    );
    lastResult = result;

    if (choice === "run") {
      await saveBenchmarkCache(context, latencies);
    }

    provider.setResult(result);
    writeOutput(output, result);

    const selectedRecommendation = result.models.find((model) => model.model.id === selectedModel.id);
    statusBarItem.text = selectedRecommendation?.latency.latency !== null && selectedRecommendation?.latency.latency !== undefined
      ? `$(watch) ${selectedModel.name} ${selectedRecommendation.latency.latency} ms`
      : `$(watch) ${selectedModel.name}`;
    statusBarItem.tooltip = selectedRecommendation?.reason ?? "Selected-model benchmark complete";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    statusBarItem.text = "$(warning) Benchmark failed";
    statusBarItem.tooltip = message;
    provider.setError(message);
    output.appendLine(`[error] ${message}`);
    void vscode.window.showErrorMessage(message, "See Details").then((selection) => {
      if (selection === "See Details") {
        output.show();
      }
    });
  }
}

type BenchmarkChoice = "run" | "cached" | "cancel";

async function confirmBenchmarkTokenUse(
  modelCount: number,
  prompt: string,
  cache: StoredBenchmarkCache | undefined
): Promise<BenchmarkChoice> {
  const cacheLabel = cache ? ` A cached benchmark from ${formatDateTime(cache.updatedAt)} is available.` : "";
  const selection = await vscode.window.showWarningMessage(
    `Latency benchmark will send the prompt "${prompt}" to ${modelCount} GitHub Copilot model${modelCount === 1 ? "" : "s"}. This uses a small amount of GitHub Copilot tokens, roughly 5 tokens per model.${cacheLabel}`,
    { modal: true },
    ...(cache ? ["Use Cached Results", "Run New Benchmark", "Cancel"] : ["Run Benchmark", "Cancel"])
  );

  if (selection === "Use Cached Results") {
    return "cached";
  }

  if (selection === "Run Benchmark" || selection === "Run New Benchmark") {
    return "run";
  }

  return "cancel";
}

async function confirmSelectedBenchmarkTokenUse(
  model: ModelInfo,
  prompt: string,
  cache: StoredBenchmarkCache | undefined
): Promise<BenchmarkChoice> {
  const cachedModel = cache?.models[model.id];
  const hasCachedModel = Boolean(cachedModel && cache);
  const cacheLabel = cache && cachedModel ? ` A cached benchmark from ${formatDateTime(cache.updatedAt)} is available.` : "";
  const selection = await vscode.window.showWarningMessage(
    `Selected benchmark will send the prompt "${prompt}" to "${model.name}" only. This uses a small amount of GitHub Copilot tokens.${cacheLabel}`,
    { modal: true },
    ...(hasCachedModel ? ["Use Cached Result", "Run New Benchmark", "Cancel"] : ["Benchmark This Model", "Cancel"])
  );

  if (selection === "Use Cached Result") {
    return "cached";
  }

  if (selection === "Benchmark This Model" || selection === "Run New Benchmark") {
    return "run";
  }

  return "cancel";
}

async function collectCachedOrSkippedLatencies(
  models: Array<{ id: string }>,
  cache: StoredBenchmarkCache | undefined
): Promise<Map<string, LatencyResult>> {
  const results = new Map<string, LatencyResult>();

  for (const model of models) {
    const cached = cache?.models[model.id]?.latest;

    results.set(model.id, {
      ...(cached ?? {
        status: "skipped",
        latency: null,
        reason: "Health-only check does not send prompts to GitHub Copilot models."
      })
    });
  }

  return results;
}

async function collectSelectedLatency(
  models: ModelInfo[],
  selectedModel: ModelInfo,
  prompt: string,
  previousModels?: ReturnType<typeof buildAdvisorResult>["models"],
  cache?: StoredBenchmarkCache
): Promise<Map<string, LatencyResult>> {
  const results = new Map<string, LatencyResult>();

  for (const model of models) {
    if (model.id === selectedModel.id) {
      continue;
    }

    const previous = previousModels?.find((m) => m.model.id === model.id);
    const cached = cache?.models[model.id]?.latest;
    results.set(
      model.id,
      previous && previous.latency.status !== "skipped"
        ? previous.latency
        : cached
          ? cached
        : { status: "skipped", latency: null, reason: "Not included in this benchmark run." }
    );
  }

  results.set(
    selectedModel.id,
    decorateLiveLatency(await testModelLatency(selectedModel, prompt), cache?.models[selectedModel.id])
  );
  return results;
}

async function collectLatencies(
  models: Array<{ id: string } & Parameters<typeof testModelLatency>[0]>,
  prompt: string,
  cache?: StoredBenchmarkCache
): Promise<Map<string, LatencyResult>> {
  const settled = await Promise.allSettled(
    models.map(async (model) => [
      model.id,
      decorateLiveLatency(await testModelLatency(model, prompt), cache?.models[model.id])
    ] as const)
  );
  const results = new Map<string, LatencyResult>();

  for (const item of settled) {
    if (item.status === "fulfilled") {
      results.set(item.value[0], item.value[1]);
    }
  }

  return results;
}

function loadBenchmarkCache(context: vscode.ExtensionContext): StoredBenchmarkCache | undefined {
  const cache = context.globalState.get<StoredBenchmarkCache | StoredBenchmarkCacheV1>(BENCHMARK_CACHE_KEY);

  if (!cache) {
    return undefined;
  }

  if (cache.version === 1) {
    return migrateCacheV1(cache);
  }

  if (cache.version !== 2 || !cache.models || Object.keys(cache.models).length === 0) {
    return undefined;
  }

  return cache;
}

function filterBenchmarkCacheForModels(
  cache: StoredBenchmarkCache | undefined,
  models: Array<{ id: string }>,
  cacheTtlMinutes: number
): StoredBenchmarkCache | undefined {
  if (!cache) {
    return undefined;
  }

  const entries: Record<string, StoredLatencyEntry> = {};

  for (const model of models) {
    const entry = cache.models[model.id];

    if (entry) {
      entries[model.id] = decorateCachedEntry(entry, cacheTtlMinutes);
    }
  }

  if (Object.keys(entries).length === 0) {
    return undefined;
  }

  return {
    ...cache,
    models: entries
  };
}

async function saveBenchmarkCache(
  context: vscode.ExtensionContext,
  latencies: Map<string, LatencyResult>
): Promise<void> {
  const previous = loadBenchmarkCache(context);
  const nextModels: Record<string, StoredLatencyEntry> = { ...(previous?.models ?? {}) };

  for (const [modelId, latency] of latencies) {
    if (latency.status !== "skipped" && latency.source !== "cache") {
      const sample = sampleFromLatency(latency);
      const previousHistory = nextModels[modelId]?.history ?? [];
      const history = sample
        ? [...previousHistory, sample].slice(-MAX_HISTORY_SAMPLES)
        : previousHistory.slice(-MAX_HISTORY_SAMPLES);

      nextModels[modelId] = {
        latest: {
          ...latency,
          source: "cache"
        },
        history
      };
    }
  }

  const timestamps = Object.values(nextModels)
    .map((entry) => entry.latest.checkedAt)
    .filter((checkedAt): checkedAt is number => typeof checkedAt === "number");

  await context.globalState.update(BENCHMARK_CACHE_KEY, {
    version: 2,
    updatedAt: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
    models: nextModels
  } satisfies StoredBenchmarkCache);
}

function migrateCacheV1(cache: StoredBenchmarkCacheV1): StoredBenchmarkCache | undefined {
  const models: Record<string, StoredLatencyEntry> = {};

  for (const [modelId, latency] of Object.entries(cache.latencies)) {
    if (latency.status === "skipped") {
      continue;
    }

    const sample = sampleFromLatency(latency);
    models[modelId] = {
      latest: {
        ...latency,
        source: "cache"
      },
      history: sample ? [sample] : []
    };
  }

  if (Object.keys(models).length === 0) {
    return undefined;
  }

  return {
    version: 2,
    updatedAt: cache.updatedAt,
    models
  };
}

function decorateCachedEntry(entry: StoredLatencyEntry, cacheTtlMinutes: number): StoredLatencyEntry {
  return {
    ...entry,
    latest: {
      ...entry.latest,
      source: "cache",
      isStale: isLatencyStale(entry.latest.checkedAt, cacheTtlMinutes),
      ...historyMetadata(entry.history)
    }
  };
}

function decorateLiveLatency(
  latency: LatencyResult,
  previousEntry?: StoredLatencyEntry
): LatencyResult {
  const history = previousEntry?.history ?? [];
  const previousLatency = lastNumericLatency(history);
  const latencyDelta = latency.latency !== null && previousLatency !== undefined
    ? latency.latency - previousLatency
    : undefined;
  const liveSample = sampleFromLatency(latency);
  const nextHistory = liveSample ? [...history, liveSample].slice(-MAX_HISTORY_SAMPLES) : history;
  const metadata = historyMetadata(nextHistory);

  return {
    ...latency,
    source: "live",
    previousLatency,
    latencyDelta,
    ...metadata,
    trend: trendFromDelta(latencyDelta) ?? metadata.trend
  };
}

function sampleFromLatency(latency: LatencyResult): StoredLatencySample | undefined {
  if (latency.status === "skipped" || !latency.checkedAt) {
    return undefined;
  }

  return {
    status: latency.status,
    latency: latency.latency,
    checkedAt: latency.checkedAt
  };
}

function historyMetadata(history: StoredLatencySample[]): Pick<LatencyResult, "sampleCount" | "medianLatency" | "trend"> {
  const numericLatencies = history
    .map((sample) => sample.latency)
    .filter((latency): latency is number => typeof latency === "number");
  const first = numericLatencies[0];
  const last = numericLatencies[numericLatencies.length - 1];

  return {
    sampleCount: history.length,
    medianLatency: median(numericLatencies),
    trend: first !== undefined && last !== undefined && numericLatencies.length >= 2
      ? trendFromDelta(last - first)
      : undefined
  };
}

function lastNumericLatency(history: StoredLatencySample[]): number | undefined {
  for (const sample of history.slice().reverse()) {
    if (typeof sample.latency === "number") {
      return sample.latency;
    }
  }

  return undefined;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function trendFromDelta(delta: number | undefined): LatencyResult["trend"] {
  if (delta === undefined || Math.abs(delta) < 100) {
    return delta === undefined ? undefined : "stable";
  }

  return delta < 0 ? "faster" : "slower";
}

function isLatencyStale(checkedAt: number | undefined, cacheTtlMinutes: number): boolean {
  if (!checkedAt || cacheTtlMinutes <= 0) {
    return false;
  }

  return Date.now() - checkedAt > cacheTtlMinutes * 60 * 1000;
}

function getBenchmarkCacheTtlMinutes(config: vscode.WorkspaceConfiguration): number {
  const value = config.get<number>("benchmarkCacheTtlMinutes", 120);
  return Number.isFinite(value) && value >= 0 ? value : 120;
}

function updateStatusFromResult(
  result: ReturnType<typeof buildAdvisorResult>,
  notify: boolean,
  output: vscode.OutputChannel
): void {
  if (!result.best) {
    return;
  }

  statusBarItem.text = `$(check) ${result.best.model.name}`;
  statusBarItem.tooltip = result.lastBenchmarkAt
    ? `${result.best.reason} Last benchmark: ${formatDateTime(result.lastBenchmarkAt)}.`
    : result.best.reason;

  if (notify) {
    const label = result.mode === "benchmark"
      ? "Best model right now"
      : result.mode === "cachedBenchmark"
        ? "Best model from cached benchmark"
        : "Best healthy model";

    void vscode.window.showInformationMessage(
      `${label}: ${result.best.model.name}. ${result.best.reason}`,
      "See Details"
    ).then((selection) => {
      if (selection === "See Details") {
        output.show();
      }
    });
  }
}

function serviceProvidersForModels(models: ModelInfo[]): ServiceProvider[] {
  const providers = new Set<ServiceProvider>(["github-copilot"]);

  for (const model of models) {
    // Unknown, Microsoft (MAI), and xAI models have no machine-readable
    // public status feed; their health rides on the always-included GitHub
    // Copilot status.
    if (model.provider !== "unknown" && model.provider !== "microsoft" && model.provider !== "xai") {
      providers.add(model.provider);
    }
  }

  return Array.from(providers);
}

async function collectStatuses(providers: ServiceProvider[]): Promise<Map<ServiceProvider, StatusResult>> {
  const settled = await Promise.allSettled(providers.map(async (provider) => [provider, await checkProviderStatus(provider)] as const));
  const results = new Map<ServiceProvider, StatusResult>();

  for (const item of settled) {
    if (item.status === "fulfilled") {
      results.set(item.value[0], item.value[1]);
    }
  }

  return results;
}

function writeOutput(output: vscode.OutputChannel, result: ReturnType<typeof buildAdvisorResult>): void {
  output.appendLine("");
  output.appendLine("GitHubCopilotModelAdvisor");
  output.appendLine(`Mode: ${modeLabel(result.mode)}`);
  output.appendLine(`Checked at: ${new Date(result.checkedAt).toLocaleTimeString()}`);
  output.appendLine(
    result.lastBenchmarkAt
      ? `Last benchmark: ${formatDateTime(result.lastBenchmarkAt)}`
      : "Last benchmark: not available"
  );
  output.appendLine("");
  output.appendLine("Task fit");

  for (const item of result.taskRecommendations) {
    output.appendLine(`${item.label}: ${item.model?.name ?? "No model available"} | ${item.reason}`);
  }

  output.appendLine("");
  output.appendLine("Models");

  for (const [providerName, items] of groupRecommendationsByProvider(result.models)) {
    output.appendLine(`${providerName}:`);

    for (const item of items) {
      const latency = latencyLabel(item.latency);
      const marker = item.recommended ? "recommended" : "candidate";
      output.appendLine(
        `  ${marker}: ${item.model.name} | score ${item.score} | confidence ${item.confidence.level} | ${latency}${latencyDetails(item.latency)} | ${item.reason}`
      );
    }
  }

  output.appendLine("");
  output.appendLine("Provider health");

  for (const provider of result.providers) {
    output.appendLine(`${provider.provider}: ${provider.status}`);

    for (const incident of provider.incidents) {
      output.appendLine(`  incident: ${incident}`);
    }
  }

  output.appendLine("");
  output.appendLine(result.availabilityNotice);
  output.appendLine(result.tokenNotice);
}

async function copyDiagnostics(context: vscode.ExtensionContext): Promise<void> {
  if (!lastResult) {
    await vscode.window.showInformationMessage("Run a health check or benchmark before copying diagnostics.");
    return;
  }

  const diagnostics = buildDiagnosticsReport(context, lastResult);
  await vscode.env.clipboard.writeText(diagnostics);
  await vscode.window.showInformationMessage("Model Advisor diagnostics copied to clipboard.");
}

function buildDiagnosticsReport(
  context: vscode.ExtensionContext,
  result: ReturnType<typeof buildAdvisorResult>
): string {
  const packageJson = context.extension.packageJSON as { version?: string };
  const lines = [
    "GitHub Copilot Model Advisor diagnostics",
    `Extension version: ${packageJson.version ?? "unknown"}`,
    `VS Code version: ${vscode.version}`,
    `Platform: ${process.platform} ${process.arch}`,
    `Mode: ${modeLabel(result.mode)}`,
    `Checked at: ${formatDateTime(result.checkedAt)}`,
    result.lastBenchmarkAt
      ? `Last benchmark: ${formatDateTime(result.lastBenchmarkAt)}`
      : "Last benchmark: not available",
    result.cacheTtlMinutes !== undefined
      ? `Cache TTL: ${result.cacheTtlMinutes === 0 ? "never stale" : `${result.cacheTtlMinutes} minutes`}`
      : "Cache TTL: default",
    "",
    "Recommended:",
    result.best
      ? `${result.best.model.name} | score ${result.best.score} | confidence ${result.best.confidence.level} | ${latencyLabel(result.best.latency)}`
      : "No recommendation",
    "",
    "Models:"
  ];

  for (const item of result.models) {
    lines.push(
      `- ${item.model.name} | provider ${providerLabel(item.model.provider)} | score ${item.score} | confidence ${item.confidence.level} | ${latencyLabel(item.latency)}${latencyDetails(item.latency)}`
    );
  }

  lines.push("", "Provider health:");

  for (const provider of result.providers) {
    lines.push(`- ${provider.provider}: ${provider.status}`);

    for (const incident of provider.incidents) {
      lines.push(`  incident: ${incident}`);
    }
  }

  lines.push("", result.availabilityNotice, result.tokenNotice);
  return lines.join("\n");
}

function modeLabel(mode: ReturnType<typeof buildAdvisorResult>["mode"]): string {
  switch (mode) {
    case "benchmark":
      return "latency benchmark";
    case "selectedBenchmark":
      return "selected-model latency benchmark";
    case "cachedBenchmark":
      return "cached latency benchmark";
    case "healthOnly":
      return "health check";
  }
}

function latencyLabel(latency: LatencyResult): string {
  if (latency.status === "skipped") {
    return "not benchmarked";
  }

  if (latency.latency === null) {
    return latency.status;
  }

  return `${latency.latency} ms`;
}

function latencyDetails(latency: LatencyResult): string {
  const details: string[] = [];

  if (latency.source) {
    details.push(latency.source);
  }

  if (latency.isStale) {
    details.push("stale");
  }

  if (latency.latencyDelta !== undefined) {
    details.push(`${latency.latencyDelta >= 0 ? "+" : ""}${latency.latencyDelta} ms vs previous`);
  }

  if (latency.trend) {
    details.push(`trend ${latency.trend}`);
  }

  if (latency.sampleCount) {
    details.push(`${latency.sampleCount} sample${latency.sampleCount === 1 ? "" : "s"}`);
  }

  return details.length > 0 ? ` | ${details.join(", ")}` : "";
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function groupRecommendationsByProvider(
  items: ReturnType<typeof buildAdvisorResult>["models"]
): Array<[string, ReturnType<typeof buildAdvisorResult>["models"]]> {
  const groups = new Map<string, ReturnType<typeof buildAdvisorResult>["models"]>();

  for (const item of items) {
    const label = providerLabel(item.model.provider);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return Array.from(groups.entries()).sort((left, right) => providerOrder(left[0]) - providerOrder(right[0]));
}

function providerLabel(provider: Provider): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google";
    case "moonshot":
      return "Moonshot AI";
    case "microsoft":
      return "Microsoft";
    case "xai":
      return "xAI";
    case "unknown":
      return "Unknown provider";
  }
}

function providerOrder(provider: string): number {
  switch (provider) {
    case "OpenAI":
      return 0;
    case "Anthropic":
      return 1;
    case "Google":
      return 2;
    case "Moonshot AI":
      return 3;
    case "Microsoft":
      return 4;
    case "xAI":
      return 5;
    case "GitHub":
      return 6;
    default:
      return 7;
  }
}
