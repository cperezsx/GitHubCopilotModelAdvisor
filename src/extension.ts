import * as vscode from "vscode";
import { buildAdvisorResult } from "./advisor";
import { checkProviderStatus } from "./statusChecker";
import { testModelLatency } from "./latencyTester";
import { detectModels } from "./modelDetector";
import { AdvisorWebviewViewProvider } from "./webviewViewProvider";
import { LatencyResult, Provider, StatusResult } from "./types";

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("GitHubCopilotModelAdvisor");
  const provider = new AdvisorWebviewViewProvider(context.extensionUri);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "githubCopilotModelAdvisor.checkNow";
  statusBarItem.text = "$(pulse) Model Advisor";
  statusBarItem.tooltip = "Check Copilot model latency and provider health";

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
      await runCheck(provider, output, true);
    })
  );

  const autoCheck = vscode.workspace
    .getConfiguration("githubCopilotModelAdvisor")
    .get<boolean>("autoCheckOnStartup", false);

  if (autoCheck) {
    void runCheck(provider, output, false);
  }
}

export function deactivate(): void {
  statusBarItem?.dispose();
}

async function runCheck(
  provider: AdvisorWebviewViewProvider,
  output: vscode.OutputChannel,
  notify: boolean
): Promise<void> {
  provider.setLoading();
  statusBarItem.text = "$(pulse) Checking models";

  try {
    const config = vscode.workspace.getConfiguration("githubCopilotModelAdvisor");
    const prompt = config.get<string>("testPrompt", "hi");
    const models = await detectModels();

    if (models.length === 0) {
      throw new Error("No Copilot models were found. Check that GitHub Copilot Chat is installed and signed in.");
    }

    const providers = Array.from(new Set(models.map((model) => model.provider)));
    const [latencies, statuses] = await Promise.all([
      collectLatencies(models, prompt),
      collectStatuses(providers)
    ]);
    const result = buildAdvisorResult(models, latencies, statuses);

    provider.setResult(result);
    writeOutput(output, result);

    if (result.best) {
      statusBarItem.text = `$(check) ${result.best.model.name}`;
      statusBarItem.tooltip = result.best.reason;

      if (notify) {
        void vscode.window.showInformationMessage(
          `Best model right now: ${result.best.model.name}. ${result.best.reason}`,
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

async function collectStatuses(providers: Provider[]): Promise<Map<Provider, StatusResult>> {
  const settled = await Promise.allSettled(providers.map(async (provider) => [provider, await checkProviderStatus(provider)] as const));
  const results = new Map<Provider, StatusResult>();

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
  output.appendLine(`Checked at: ${new Date(result.checkedAt).toLocaleTimeString()}`);
  output.appendLine("");
  output.appendLine("Models");

  for (const item of result.models) {
    const latency = item.latency.latency === null ? item.latency.status : `${item.latency.latency} ms`;
    const marker = item.recommended ? "recommended" : "candidate";
    output.appendLine(`${marker}: ${item.model.name} | score ${item.score} | ${latency} | ${item.reason}`);
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
  output.appendLine(result.tokenNotice);
}
