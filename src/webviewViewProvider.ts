import * as vscode from "vscode";
import { AdvisorResult } from "./types";

export class AdvisorWebviewViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: ViewState = { kind: "idle" };

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onBenchmarkModel: (modelId: string) => Promise<void>
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")]
    };

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      if (message.command === "checkNow") {
        void vscode.commands.executeCommand("githubCopilotModelAdvisor.checkNow");
      }

      if (message.command === "benchmarkNow") {
        void vscode.commands.executeCommand("githubCopilotModelAdvisor.benchmarkNow");
      }

      if (message.command === "benchmarkModel" && message.modelId) {
        void this.onBenchmarkModel(message.modelId);
      }

      if (message.command === "openSettings") {
        void vscode.commands.executeCommand("githubCopilotModelAdvisor.openSettings");
      }

      if (message.command === "openExternal" && message.url) {
        void vscode.env.openExternal(vscode.Uri.parse(message.url));
      }
    });

    this.render();
  }

  setLoading(mode: "healthOnly" | "benchmark" | "selectedBenchmark", modelName?: string): void {
    this.state = { kind: "loading", mode, modelName };
    this.render();
  }

  setResult(result: AdvisorResult): void {
    this.state = { kind: "result", result };
    this.render();
  }

  setError(message: string): void {
    this.state = { kind: "error", message };
    this.render();
  }

  reveal(): void {
    this.view?.show?.(true);
  }

  private render(): void {
    if (!this.view) {
      return;
    }

    const nonce = String(Date.now());
    this.view.webview.html = getHtml(this.state, nonce);
  }
}

export type ViewState =
  | { kind: "idle" }
  | { kind: "loading"; mode: "healthOnly" | "benchmark" | "selectedBenchmark"; modelName?: string }
  | { kind: "result"; result: AdvisorResult }
  | { kind: "error"; message: string };

type WebviewMessage = {
  command: "checkNow" | "benchmarkNow" | "benchmarkModel" | "openSettings" | "openExternal";
  url?: string;
  modelId?: string;
};

export function getHtml(state: ViewState, nonce: string): string {
  const body = renderBody(state);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>GitHubCopilotModelAdvisor</title>
  <style>
    :root {
      --surface: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-editor-foreground) 12%);
      --surface-2: color-mix(in srgb, var(--vscode-editor-background) 80%, var(--vscode-editor-foreground) 20%);
      --border: color-mix(in srgb, var(--vscode-editor-foreground) 16%, transparent);
      --border-soft: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent);
      --muted: var(--vscode-descriptionForeground);
      --mint: #28e5bc;
      --amber: #f7bd3e;
      --coral: #ff776e;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 14px 14px 20px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.45;
    }

    button {
      border: 1px solid transparent;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-radius: 6px;
      padding: 7px 12px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s ease;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      color: var(--vscode-foreground);
      background: transparent;
      border-color: var(--border);
    }

    button.secondary:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .link-button {
      border: 0;
      padding: 0;
      color: var(--vscode-textLink-foreground);
      background: transparent;
      font-size: 11px;
      font-weight: 400;
      text-align: left;
    }

    .link-button:hover {
      color: var(--vscode-textLink-activeForeground);
      background: transparent;
      text-decoration: underline;
    }

    .pill-button {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 10px;
      color: var(--vscode-foreground);
      background: transparent;
      font-size: 10px;
      font-weight: 500;
    }

    .pill-button:hover {
      border-color: color-mix(in srgb, var(--mint) 60%, transparent);
      color: var(--mint);
      background: color-mix(in srgb, var(--mint) 8%, transparent);
    }

    .icon-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border-radius: 6px;
      color: var(--vscode-icon-foreground);
      background: transparent;
    }

    .icon-button:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .icon {
      display: block;
      flex: 0 0 auto;
    }

    button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 14px;
    }

    .title {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .subtitle {
      margin-top: 2px;
      color: var(--muted);
      font-size: 11px;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: none; }
    }

    .summary {
      position: relative;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, var(--surface-2), var(--surface));
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
      overflow: hidden;
      animation: rise 0.25s ease both;
    }

    .summary.best {
      border-color: color-mix(in srgb, var(--mint) 55%, transparent);
    }

    .summary.best::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--mint);
    }

    .summary strong {
      display: block;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-top: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .summary .reason {
      margin: 4px 0 0;
    }

    .metric-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--border-soft);
      border-radius: 8px;
      background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-editor-foreground) 6%);
      margin-top: 6px;
    }

    .metric-row.recommended {
      border-color: color-mix(in srgb, var(--mint) 55%, transparent);
      background: color-mix(in srgb, var(--mint) 7%, var(--surface));
    }

    .provider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 0;
      border-bottom: 1px solid var(--border-soft);
    }

    .provider-row:last-child {
      border-bottom: 0;
    }

    .model-main {
      min-width: 0;
      flex: 1 1 auto;
    }

    .model-name {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .model-meta,
    .reason,
    .note {
      color: var(--muted);
      font-size: 11px;
    }

    .model-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 2px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--border-soft);
      border-radius: 999px;
      padding: 0 7px;
      font-size: 10px;
      line-height: 16px;
      color: var(--muted);
      background: color-mix(in srgb, var(--vscode-editor-background) 70%, transparent);
      white-space: nowrap;
    }

    .chip.good { color: var(--mint); border-color: color-mix(in srgb, var(--mint) 35%, transparent); }
    .chip.warn { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 35%, transparent); }
    .chip.bad { color: var(--coral); border-color: color-mix(in srgb, var(--coral) 35%, transparent); }

    .score-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
      flex: 0 0 auto;
      min-width: 56px;
    }

    .score {
      font-weight: 700;
      font-size: 14px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .score-bar {
      width: 56px;
      height: 3px;
      border-radius: 2px;
      background: var(--border-soft);
      overflow: hidden;
    }

    .score-bar i {
      display: block;
      height: 100%;
      border-radius: 2px;
      background: var(--mint);
    }

    .score-bar.warn i { background: var(--amber); }
    .score-bar.bad i { background: var(--coral); }

    .notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      border: 1px solid color-mix(in srgb, var(--amber) 45%, transparent);
      border-radius: 8px;
      background: color-mix(in srgb, var(--amber) 12%, var(--vscode-sideBar-background));
      padding: 10px 12px;
      margin: 12px 0;
      color: var(--vscode-foreground);
      font-size: 11px;
    }

    .notice.cost {
      border-color: color-mix(in srgb, var(--coral) 48%, transparent);
      background: color-mix(in srgb, var(--coral) 11%, var(--vscode-sideBar-background));
    }

    .notice.no-cost {
      border-color: color-mix(in srgb, var(--mint) 38%, transparent);
      background: color-mix(in srgb, var(--mint) 8%, var(--vscode-sideBar-background));
    }

    .notice strong {
      display: block;
      margin-bottom: 2px;
      font-size: 11.5px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--muted);
      flex: 0 0 auto;
    }

    .dot.good {
      background: var(--mint);
      box-shadow: 0 0 5px color-mix(in srgb, var(--mint) 60%, transparent);
    }

    .dot.warn {
      background: var(--amber);
      box-shadow: 0 0 5px color-mix(in srgb, var(--amber) 55%, transparent);
    }

    .dot.bad {
      background: var(--coral);
      box-shadow: 0 0 5px color-mix(in srgb, var(--coral) 55%, transparent);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 18px 0 7px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .section-title::after {
      content: "";
      flex: 1 1 auto;
      height: 1px;
      background: var(--border-soft);
    }

    .provider-title {
      margin: 0;
      color: var(--vscode-foreground);
      font-size: 12px;
      font-weight: 650;
    }

    .provider-group {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      margin: 8px 0;
      overflow: hidden;
    }

    .provider-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px;
      cursor: pointer;
      list-style: none;
      background: color-mix(in srgb, var(--vscode-editor-background) 84%, var(--vscode-editor-foreground) 16%);
      transition: background 0.12s ease;
    }

    .provider-summary:hover {
      background: color-mix(in srgb, var(--vscode-editor-background) 78%, var(--vscode-editor-foreground) 22%);
    }

    .provider-summary::-webkit-details-marker {
      display: none;
    }

    .chevron {
      flex: 0 0 auto;
      color: var(--muted);
      transition: transform 0.15s ease;
    }

    .provider-group[open] .chevron {
      transform: rotate(90deg);
    }

    .provider-summary-main {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1 1 auto;
    }

    .provider-heading {
      min-width: 0;
    }

    .provider-subtitle {
      display: block;
      color: var(--muted);
      font-size: 10px;
      margin-top: 1px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .provider-count {
      color: var(--muted);
      font-size: 10px;
      font-weight: 600;
      flex: 0 0 auto;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 1px 8px;
      background: transparent;
      font-variant-numeric: tabular-nums;
    }

    .provider-body {
      border-top: 1px solid var(--border-soft);
      padding: 4px 8px 8px;
    }

    .task-fit {
      display: grid;
      gap: 6px;
    }

    .task-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
      border: 1px solid var(--border-soft);
      border-radius: 8px;
      background: var(--surface);
      padding: 9px 11px;
    }

    .task-label {
      flex: 0 0 58px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .task-main {
      min-width: 0;
    }

    .task-model {
      font-weight: 600;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .state {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      padding: 16px 14px;
      animation: rise 0.25s ease both;
    }

    .state strong {
      display: block;
      font-size: 13px;
      margin-bottom: 2px;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    /* Loading skeleton */
    @keyframes shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border);
      border-top-color: var(--mint);
      border-radius: 50%;
      flex: 0 0 auto;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-head {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 4px;
    }

    .skeleton {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .skeleton .line {
      height: 34px;
      border-radius: 8px;
      background: linear-gradient(90deg, var(--border-soft) 25%, var(--border) 50%, var(--border-soft) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
    }

    .skeleton .line:nth-child(2) { opacity: 0.7; }
    .skeleton .line:nth-child(3) { opacity: 0.4; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">GitHubCopilotModelAdvisor</h1>
      <div class="subtitle">Check health first. Benchmark speed only when needed.</div>
    </div>
    <button id="settings" class="icon-button" title="Open settings" aria-label="Open settings">${settingsIcon()}</button>
  </div>
  ${body}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-command]').forEach((item) => {
      item.addEventListener('click', () => vscode.postMessage({ command: item.dataset.command, url: item.dataset.url, modelId: item.dataset.modelId }));
    });
    document.getElementById('settings')?.addEventListener('click', () => vscode.postMessage({ command: 'openSettings' }));
  </script>
</body>
</html>`;
}

function renderBody(state: ViewState): string {
  if (state.kind === "loading") {
    const title =
      state.mode === "benchmark"
        ? "Benchmarking all models..."
        : state.mode === "selectedBenchmark"
          ? `Benchmarking ${state.modelName ?? "selected model"}...`
          : "Checking health...";
    const message =
      state.mode === "benchmark"
        ? "Waiting for first tokens. Each enabled model receives the configured tiny prompt."
        : state.mode === "selectedBenchmark"
          ? "Waiting for the first token from this model only."
          : "Checking model availability and health sources without sending prompts.";
    return `<div class="state">
      <div class="loading-head"><span class="spinner" aria-hidden="true"></span><strong>${title}</strong></div>
      <p class="note">${message}</p>
      <div class="skeleton" aria-hidden="true"><div class="line"></div><div class="line"></div><div class="line"></div></div>
    </div>`;
  }

  if (state.kind === "error") {
    return `<div class="state"><span class="badge"><span class="dot bad"></span>Error</span><strong>Check failed</strong><p class="note">${escapeHtml(state.message)}</p><div class="actions"><button data-command="checkNow">Try again</button></div></div>`;
  }

  if (state.kind === "idle") {
    return `<div class="summary"><span class="badge"><span class="dot"></span>Ready</span><strong>Check models</strong><p class="reason">Health check does not use GitHub Copilot tokens. Benchmark only when you want live latency.</p><div class="actions"><button data-command="checkNow">Health check</button><button class="secondary" data-command="benchmarkNow">Benchmark latency</button></div></div>`;
  }

  const { result } = state;
  const best = result.best;
  const summary = best
    ? `<div class="summary best"><span class="badge"><span class="dot good"></span>${result.mode === "healthOnly" ? "Healthy pick" : "Recommended"}</span><strong>${escapeHtml(best.model.name)}</strong><p class="reason">${escapeHtml(best.reason)}</p><div class="actions"><button data-command="checkNow">Health check</button><button class="secondary" data-command="benchmarkNow">Benchmark all</button></div></div>`
    : `<div class="summary"><span class="badge"><span class="dot warn"></span>No models</span><strong>No GitHub Copilot models found</strong><p class="reason">Install and sign in to GitHub Copilot Chat.</p><div class="actions"><button data-command="checkNow">Try again</button></div></div>`;

  const models = renderModelGroups(result);

  const providers = result.providers
    .slice()
    .sort((left, right) => providerOrder(left.provider) - providerOrder(right.provider))
    .map((provider) => `<div class="provider-row">
      <span>${escapeHtml(providerLabel(provider.provider))}</span>
      <span class="badge"><span class="dot ${statusClass(provider.status)}"></span>${escapeHtml(statusLabel(provider.status))}</span>
      <button class="link-button" data-command="openExternal" data-url="${escapeHtml(provider.statusPageUrl)}">Status page</button>
    </div>`)
    .join("");

  return `${summary}
    ${renderTokenNotice(result)}
    <div class="section-title">Task fit</div>
    ${renderTaskRecommendations(result)}
    <div class="section-title">Models</div>
    <p class="note">${escapeHtml(result.availabilityNotice)}</p>
    ${models || `<div class="state note">No model data yet.</div>`}
    <div class="section-title">Health Sources</div>
    ${providers || `<div class="state note">No provider data yet.</div>`}
    `;
}

function settingsIcon(): string {
  return `<svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M6.1 1.4h3.8l.4 1.6c.3.1.6.3.9.5l1.5-.5 1.9 3.3-1.2 1.1v1.2l1.2 1.1-1.9 3.3-1.5-.5c-.3.2-.6.4-.9.5l-.4 1.6H6.1L5.7 13c-.3-.1-.6-.3-.9-.5l-1.5.5-1.9-3.3 1.2-1.1V7.4L1.4 6.3 3.3 3l1.5.5c.3-.2.6-.4.9-.5l.4-1.6Zm.8 1.2-.3 1.3-.4.1c-.4.1-.8.4-1.2.7l-.3.3-1.2-.4-.7 1.2 1 .9-.1.4a4 4 0 0 0 0 1.6l.1.4-1 .9.7 1.2 1.2-.4.3.3c.4.3.8.6 1.2.7l.4.1.3 1.3h2.2l.3-1.3.4-.1c.4-.1.8-.4 1.2-.7l.3-.3 1.2.4.7-1.2-1-.9.1-.4a4 4 0 0 0 0-1.6l-.1-.4 1-.9-.7-1.2-1.2.4-.3-.3a4 4 0 0 0-1.2-.7l-.4-.1-.3-1.3H6.9ZM8 5.5A2.5 2.5 0 1 1 8 10.5 2.5 2.5 0 0 1 8 5.5Zm0 1.2A1.3 1.3 0 1 0 8 9.3 1.3 1.3 0 0 0 8 6.7Z"/>
  </svg>`;
}

function chevronIcon(): string {
  return `<svg class="chevron" width="10" height="10" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M5.7 13.7 4.3 12.3 8.6 8 4.3 3.7 5.7 2.3 11.4 8z"/>
  </svg>`;
}

function renderModelGroups(result: AdvisorResult): string {
  return groupModelsByProvider(result.models)
    .map(([provider, items], index) => {
      const rows = items
        .slice()
        .sort((left, right) => {
          if (left.recommended !== right.recommended) {
            return left.recommended ? -1 : 1;
          }

          if (left.score !== right.score) {
            return right.score - left.score;
          }

          return left.model.name.localeCompare(right.model.name, undefined, { sensitivity: "base", numeric: true });
        })
        .map((item) => {
          const selectedBenchmarked = result.benchmarkedModelId === item.model.id;
          const classes = item.recommended ? "metric-row recommended" : "metric-row";
          return `<div class="${classes}">
            <div class="model-main">
              <div class="model-name">${escapeHtml(item.model.name)}</div>
              <div class="model-meta">
                <span>${escapeHtml(providerMeta(item.model.provider))}</span>
                <span class="chip ${latencyChipClass(item.latency)}">${escapeHtml(latencyLabel(item.latency))}</span>
                ${selectedBenchmarked ? `<span class="chip good">benchmarked</span>` : ""}
              </div>
              <div class="reason">${escapeHtml(item.reason)}</div>
            </div>
            <div class="score-wrap">
              <div class="score">${item.score}</div>
              <div class="score-bar ${scoreBarClass(item.score)}" role="img" aria-label="Score ${item.score} out of 100"><i style="width:${clampScore(item.score)}%"></i></div>
              <button class="pill-button" data-command="benchmarkModel" data-model-id="${escapeHtml(item.model.id)}">Benchmark</button>
            </div>
          </div>`;
        })
        .join("");

      return `<details class="provider-group" ${index === 0 ? "open" : ""}>
        <summary class="provider-summary">
          <span class="provider-summary-main">
            ${chevronIcon()}
            <span class="dot ${providerDotClass(provider)}"></span>
            <span class="provider-heading">
              <span class="provider-title">${escapeHtml(providerLabel(provider))}</span>
              <span class="provider-subtitle">${escapeHtml(providerGroupSubtitle(provider))}</span>
            </span>
          </span>
          <span class="provider-count">${items.length} model${items.length === 1 ? "" : "s"}</span>
        </summary>
        <div class="provider-body">${rows}</div>
      </details>`;
    })
    .join("");
}

function renderTokenNotice(result: AdvisorResult): string {
  if (result.mode === "healthOnly") {
    return `<div class="notice no-cost"><div><strong>No GitHub Copilot tokens used</strong>${escapeHtml(result.tokenNotice)}</div></div>`;
  }

  return `<div class="notice cost"><div><strong>GitHub Copilot tokens used</strong>${escapeHtml(result.tokenNotice)}</div></div>`;
}

function renderTaskRecommendations(result: AdvisorResult): string {
  const rows = result.taskRecommendations
    .map((item) => {
      const model = item.model ? escapeHtml(item.model.name) : "No model available";
      return `<div class="task-row">
        <div class="task-label">${escapeHtml(item.label)}</div>
        <div class="task-main">
          <div class="task-model">${model}</div>
          <div class="reason">${escapeHtml(item.reason)}</div>
        </div>
      </div>`;
    })
    .join("");

  return `<div class="task-fit">${rows}</div>`;
}

function groupModelsByProvider(models: AdvisorResult["models"]): Array<[AdvisorResult["models"][number]["model"]["provider"], AdvisorResult["models"]]> {
  const groups = new Map<AdvisorResult["models"][number]["model"]["provider"], AdvisorResult["models"]>();

  for (const model of models) {
    const provider = model.model.provider;
    groups.set(provider, [...(groups.get(provider) ?? []), model]);
  }

  return Array.from(groups.entries()).sort((left, right) => providerOrder(left[0]) - providerOrder(right[0]));
}

function latencyLabel(latency: AdvisorResult["models"][number]["latency"]): string {
  if (latency.status === "skipped") {
    return "not benchmarked";
  }

  if (latency.latency === null) {
    return latency.status;
  }

  return `${latency.latency} ms`;
}

function latencyChipClass(latency: AdvisorResult["models"][number]["latency"]): string {
  if (latency.status === "skipped") {
    return "";
  }

  if (latency.status === "fast") {
    return "good";
  }

  if (latency.status === "slow") {
    return "warn";
  }

  return "bad";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function scoreBarClass(score: number): string {
  if (score >= 80) {
    return "";
  }

  if (score >= 50) {
    return "warn";
  }

  return "bad";
}

function providerLabel(provider: AdvisorResult["models"][number]["model"]["provider"] | AdvisorResult["providers"][number]["provider"]): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google";
    case "unknown":
      return "Unknown provider";
    case "github-copilot":
      return "GitHub Copilot";
  }
}

function providerMeta(provider: AdvisorResult["models"][number]["model"]["provider"]): string {
  return provider === "unknown" ? "Unknown provider via GitHub Copilot" : `${providerLabel(provider)} via GitHub Copilot`;
}

function providerGroupSubtitle(provider: AdvisorResult["models"][number]["model"]["provider"]): string {
  if (provider === "unknown") {
    return "Provider not inferred, delivered by GitHub Copilot";
  }

  return `${providerLabel(provider)} models delivered through GitHub Copilot`;
}

function providerOrder(provider: AdvisorResult["models"][number]["model"]["provider"] | AdvisorResult["providers"][number]["provider"]): number {
  switch (provider) {
    case "openai":
      return 0;
    case "anthropic":
      return 1;
    case "google":
      return 2;
    case "unknown":
      return 3;
    case "github-copilot":
      return 4;
  }
}

function providerDotClass(provider: AdvisorResult["models"][number]["model"]["provider"]): string {
  return provider === "unknown" ? "" : "good";
}

function statusLabel(status: string): string {
  return status.replace("_", " ");
}

function statusClass(status: string): string {
  if (status === "operational") {
    return "good";
  }

  if (status === "major_outage" || status === "partial_outage") {
    return "bad";
  }

  if (status === "degraded_performance") {
    return "warn";
  }

  return "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
