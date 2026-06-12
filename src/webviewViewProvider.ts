import * as vscode from "vscode";
import { AdvisorResult } from "./types";

export class AdvisorWebviewViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: ViewState = { kind: "idle" };

  constructor(private readonly extensionUri: vscode.Uri) {}

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

      if (message.command === "openSettings") {
        void vscode.commands.executeCommand("githubCopilotModelAdvisor.openSettings");
      }
    });

    this.render();
  }

  setLoading(): void {
    this.state = { kind: "loading" };
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

type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; result: AdvisorResult }
  | { kind: "error"; message: string };

type WebviewMessage = {
  command: "checkNow" | "openSettings";
};

function getHtml(state: ViewState, nonce: string): string {
  const body = renderBody(state);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHubCopilotModelAdvisor</title>
  <style>
    :root {
      --surface: color-mix(in srgb, var(--vscode-editor-background) 86%, var(--vscode-editor-foreground) 14%);
      --surface-2: color-mix(in srgb, var(--vscode-editor-background) 76%, var(--vscode-editor-foreground) 24%);
      --border: color-mix(in srgb, var(--vscode-editor-foreground) 18%, transparent);
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
      padding: 14px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.4;
    }

    button {
      border: 1px solid var(--border);
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-radius: 6px;
      padding: 7px 10px;
      font: inherit;
      cursor: pointer;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
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
      letter-spacing: 0;
    }

    .subtitle {
      margin-top: 2px;
      color: var(--muted);
      font-size: 11px;
    }

    .summary {
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .summary strong {
      display: block;
      font-size: 18px;
      margin-top: 4px;
    }

    .metric-row,
    .provider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 0;
      border-bottom: 1px solid var(--border);
    }

    .metric-row:last-child,
    .provider-row:last-child {
      border-bottom: 0;
    }

    .model-main {
      min-width: 0;
    }

    .model-name {
      font-weight: 650;
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

    .score {
      min-width: 38px;
      text-align: right;
      font-weight: 700;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--muted);
      font-size: 11px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted);
      flex: 0 0 auto;
    }

    .dot.good {
      background: var(--mint);
    }

    .dot.warn {
      background: var(--amber);
    }

    .dot.bad {
      background: var(--coral);
    }

    .recommended {
      border: 1px solid color-mix(in srgb, var(--mint) 70%, transparent);
      background: color-mix(in srgb, var(--mint) 10%, var(--surface));
      border-radius: 8px;
      padding: 10px;
      margin: 0 -2px 8px;
    }

    .section-title {
      margin: 16px 0 6px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .state {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      padding: 12px;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">GitHubCopilotModelAdvisor</h1>
      <div class="subtitle">Rank models by speed and provider health.</div>
    </div>
    <button id="settings" title="Open settings" aria-label="Open settings">$(gear)</button>
  </div>
  ${body}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-command]').forEach((item) => {
      item.addEventListener('click', () => vscode.postMessage({ command: item.dataset.command }));
    });
    document.getElementById('settings')?.addEventListener('click', () => vscode.postMessage({ command: 'openSettings' }));
  </script>
</body>
</html>`;
}

function renderBody(state: ViewState): string {
  if (state.kind === "loading") {
    return `<div class="state"><strong>Checking models...</strong><p class="note">Measuring first-token latency and provider health.</p></div>`;
  }

  if (state.kind === "error") {
    return `<div class="state"><strong>Check failed</strong><p class="note">${escapeHtml(state.message)}</p><div class="actions"><button data-command="checkNow">Try again</button></div></div>`;
  }

  if (state.kind === "idle") {
    return `<div class="summary"><span class="badge"><span class="dot"></span>Ready</span><strong>Check models</strong><p class="reason">Uses about 5 Copilot tokens per model.</p><div class="actions"><button data-command="checkNow">Run check</button></div></div>`;
  }

  const { result } = state;
  const best = result.best;
  const summary = best
    ? `<div class="summary"><span class="badge"><span class="dot good"></span>Recommended</span><strong>${escapeHtml(best.model.name)}</strong><p class="reason">${escapeHtml(best.reason)}</p><div class="actions"><button data-command="checkNow">Refresh</button></div></div>`
    : `<div class="summary"><span class="badge"><span class="dot warn"></span>No models</span><strong>No Copilot models found</strong><p class="reason">Install and sign in to GitHub Copilot Chat.</p><div class="actions"><button data-command="checkNow">Try again</button></div></div>`;

  const models = result.models
    .map((item) => {
      const latency = item.latency.latency === null ? item.latency.status : `${item.latency.latency} ms`;
      const classes = item.recommended ? "metric-row recommended" : "metric-row";
      return `<div class="${classes}">
        <div class="model-main">
          <div class="model-name">${escapeHtml(item.model.name)}</div>
          <div class="model-meta">${escapeHtml(item.model.provider)} · ${escapeHtml(latency)}</div>
          <div class="reason">${escapeHtml(item.reason)}</div>
        </div>
        <div class="score">${item.score}</div>
      </div>`;
    })
    .join("");

  const providers = result.providers
    .map((provider) => `<div class="provider-row"><span>${escapeHtml(provider.provider)}</span><span class="badge"><span class="dot ${statusClass(provider.status)}"></span>${escapeHtml(provider.status.replace("_", " "))}</span></div>`)
    .join("");

  return `${summary}
    <div class="section-title">Models</div>
    ${models || `<div class="state note">No model data yet.</div>`}
    <div class="section-title">Provider Health</div>
    ${providers || `<div class="state note">No provider data yet.</div>`}
    <p class="note">${escapeHtml(result.tokenNotice)}</p>`;
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
