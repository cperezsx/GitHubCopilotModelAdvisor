import * as vscode from "vscode";
import { buildAdvisorResult } from "./advisor";
import { checkProviderStatus } from "./statusChecker";
import { testModelLatency } from "./latencyTester";
import { detectModels } from "./modelDetector";
import { AdvisorWebviewViewProvider } from "./webviewViewProvider";
import { LatencyResult, ModelInfo, Provider, ServiceProvider, StatusResult } from "./types";

let statusBarItem: vscode.StatusBarItem;
type CheckMode = "healthOnly" | "benchmark";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("GitHubCopilotModelAdvisor");
  const provider = new AdvisorWebviewViewProvider(context.extensionUri, async (modelId) => {
    await runSelectedBenchmark(provider, output, modelId);
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
      await runCheck(provider, output, true, "healthOnly");
    }),
    vscode.commands.registerCommand("githubCopilotModelAdvisor.benchmarkNow", async () => {
      await runCheck(provider, output, true, "benchmark");
    })
  );

  const autoCheck = vscode.workspace
    .getConfiguration("githubCopilotModelAdvisor")
    .get<boolean>("autoCheckOnStartup", false);

  if (autoCheck) {
    void runCheck(provider, output, false, "healthOnly");
  }
}

export function deactivate(): void {
  statusBarItem?.dispose();
}

async function runCheck(
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
    const models = await detectModels();

    if (models.length === 0) {
      throw new Error("No GitHub Copilot models were found. Check that GitHub Copilot Chat is installed and signed in.");
    }

    if (mode === "benchmark") {
      const confirmed = await confirmBenchmarkTokenUse(models.length, prompt);

      if (!confirmed) {
        statusBarItem.text = "$(pulse) Model Advisor";
        statusBarItem.tooltip = "Latency benchmark cancelled before sending prompts.";
        return;
      }

      provider.setLoading(mode);
      statusBarItem.text = "$(pulse) Benchmarking models";
      statusBarItem.tooltip = "Sending tiny prompts to measure first-token latency";
    }

    const providers = serviceProvidersForModels(models);
    const [latencies, statuses] = await Promise.all([
      mode === "benchmark" ? collectLatencies(models, prompt) : collectSkippedLatencies(models),
      collectStatuses(providers)
    ]);
    const result = buildAdvisorResult(models, latencies, statuses, mode);

    provider.setResult(result);
    writeOutput(output, result);

    if (result.best) {
      statusBarItem.text = `$(check) ${result.best.model.name}`;
      statusBarItem.tooltip = result.best.reason;

      if (notify) {
        void vscode.window.showInformationMessage(
          `${mode === "benchmark" ? "Best model right now" : "Best healthy model"}: ${result.best.model.name}. ${result.best.reason}`,
          "See Details"
        ).then((selection) => {
          if (selection === "See Details") {
            output.show();
          }
        });
      }
    }
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
  provider: AdvisorWebviewViewProvider,
  output: vscode.OutputChannel,
  modelId: string
): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration("githubCopilotModelAdvisor");
    const prompt = config.get<string>("testPrompt", "hi");
    const models = await detectModels();
    const selectedModel = models.find((model) => model.id === modelId);

    if (!selectedModel) {
      throw new Error("Selected model is no longer enabled for this user.");
    }

    const confirmed = await confirmSelectedBenchmarkTokenUse(selectedModel, prompt);

    if (!confirmed) {
      statusBarItem.text = "$(pulse) Model Advisor";
      statusBarItem.tooltip = "Selected-model benchmark cancelled before sending a prompt.";
      return;
    }

    provider.setLoading("selectedBenchmark", selectedModel.name);
    statusBarItem.text = `$(pulse) Benchmarking ${selectedModel.name}`;
    statusBarItem.tooltip = "Sending one tiny prompt to measure first-token latency";

    const providers = serviceProvidersForModels(models);
    const [latencies, statuses] = await Promise.all([
      collectSelectedLatency(models, selectedModel, prompt),
      collectStatuses(providers)
    ]);
    const result = buildAdvisorResult(models, latencies, statuses, "selectedBenchmark", selectedModel.id);

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

async function confirmBenchmarkTokenUse(modelCount: number, prompt: string): Promise<boolean> {
  const selection = await vscode.window.showWarningMessage(
    `Latency benchmark will send the prompt "${prompt}" to ${modelCount} GitHub Copilot model${modelCount === 1 ? "" : "s"}. This uses a small amount of GitHub Copilot tokens, roughly 5 tokens per model. Continue?`,
    { modal: true },
    "Run Benchmark",
    "Cancel"
  );

  return selection === "Run Benchmark";
}

async function confirmSelectedBenchmarkTokenUse(model: ModelInfo, prompt: string): Promise<boolean> {
  const selection = await vscode.window.showWarningMessage(
    `Selected benchmark will send the prompt "${prompt}" to "${model.name}" only. This uses a small amount of GitHub Copilot tokens. Continue?`,
    { modal: true },
    "Benchmark This Model",
    "Cancel"
  );

  return selection === "Benchmark This Model";
}

async function collectSkippedLatencies(models: Array<{ id: string }>): Promise<Map<string, LatencyResult>> {
  const results = new Map<string, LatencyResult>();

  for (const model of models) {
    results.set(model.id, {
      status: "skipped",
      latency: null,
      reason: "Health-only check does not send prompts to GitHub Copilot models."
    });
  }

  return results;
}

async function collectSelectedLatency(
  models: ModelInfo[],
  selectedModel: ModelInfo,
  prompt: string
): Promise<Map<string, LatencyResult>> {
  const results = await collectSkippedLatencies(models);
  results.set(selectedModel.id, await testModelLatency(selectedModel, prompt));
  return results;
}

async function collectLatencies(models: Array<{ id: string } & Parameters<typeof testModelLatency>[0]>, prompt: string): Promise<Map<string, LatencyResult>> {
  const settled = await Promise.allSettled(models.map(async (model) => [model.id, await testModelLatency(model, prompt)] as const));
  const results = new Map<string, LatencyResult>();

  for (const item of settled) {
    if (item.status === "fulfilled") {
      results.set(item.value[0], item.value[1]);
    }
  }

  return results;
}

function serviceProvidersForModels(models: ModelInfo[]): ServiceProvider[] {
  const providers = new Set<ServiceProvider>(["github-copilot"]);

  for (const model of models) {
    if (model.provider !== "unknown") {
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
      output.appendLine(`  ${marker}: ${item.model.name} | score ${item.score} | ${latency} | ${item.reason}`);
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

function modeLabel(mode: ReturnType<typeof buildAdvisorResult>["mode"]): string {
  switch (mode) {
    case "benchmark":
      return "latency benchmark";
    case "selectedBenchmark":
      return "selected-model latency benchmark";
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
    case "GitHub":
      return 3;
    default:
      return 4;
  }
}
