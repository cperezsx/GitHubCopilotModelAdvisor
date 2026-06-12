// Renders the real webview HTML (out/webviewViewProvider.js) with sample data
// into out/webview-preview.html so it can be screenshotted in a plain browser.
// Run: npm run compile && node scripts/webview-preview.js

const fs = require("fs");
const path = require("path");
const Module = require("module");

// getHtml is pure; stub the vscode module so it can load outside the extension host.
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "vscode") {
    return {};
  }
  return originalLoad.call(this, request, ...rest);
};

const { getHtml } = require("../out/webviewViewProvider");

const NONCE = "preview";

const status = (provider, statusPageUrl) => ({
  provider,
  status: "operational",
  incidents: [],
  statusPageUrl,
  checkedAt: Date.now()
});

const openaiStatus = status("openai", "https://status.openai.com");
const anthropicStatus = status("anthropic", "https://status.claude.com");
const googleStatus = { ...status("google", "https://status.cloud.google.com"), status: "degraded_performance", incidents: ["Elevated latency on Gemini API"] };
const githubStatus = status("github-copilot", "https://www.githubstatus.com");

const model = (id, name, provider, family) => ({
  id,
  name,
  vendor: "copilot",
  family: family ?? id,
  version: "1",
  maxInputTokens: 128000,
  provider,
  route: "github-copilot"
});

const rec = (m, latency, providerStatus, score, reason, recommended = false) => ({
  model: m,
  latency,
  providerStatus,
  score,
  reason,
  recommended
});

const models = [
  rec(model("claude-sonnet-4.5", "Claude Sonnet 4.5", "anthropic"), { status: "fast", latency: 412 }, anthropicStatus, 100, "Fast first token and operational provider.", true),
  rec(model("claude-haiku-4.5", "Claude Haiku 4.5", "anthropic"), { status: "fast", latency: 388 }, anthropicStatus, 100, "Fast first token and operational provider."),
  rec(model("gpt-4.1", "GPT-4.1", "openai"), { status: "fast", latency: 938 }, openaiStatus, 90, "Healthy provider with moderate first-token latency."),
  rec(model("gpt-5-mini", "GPT-5 mini", "openai"), { status: "fast", latency: 612 }, openaiStatus, 100, "Fast first token and operational provider."),
  rec(model("o4-mini", "o4-mini", "openai"), { status: "slow", latency: 2140 }, openaiStatus, 70, "Slow first token right now."),
  rec(model("gemini-2.5-pro", "Gemini 2.5 Pro", "google"), { status: "fast", latency: 701 }, googleStatus, 50, "Provider reports degraded performance with an active incident.")
];

const result = {
  mode: "benchmark",
  checkedAt: Date.now(),
  models,
  best: models[0],
  benchmarkedModelId: undefined,
  taskRecommendations: [
    { label: "Light", model: models[1].model, reason: "Lightweight model with the best current signal." },
    { label: "Medium", model: models[0].model, reason: "Balanced model with the best current signal." },
    { label: "Complex", model: models[2].model, reason: "Reasoning-capable model with the best current signal." }
  ],
  providers: [openaiStatus, anthropicStatus, googleStatus, githubStatus],
  availabilityNotice: "Showing only GitHub Copilot models currently enabled for this user in VS Code.",
  tokenNotice: "Latency benchmark sends a tiny prompt to each model and uses about 5 GitHub Copilot tokens per model."
};

let html = getHtml({ kind: "result", result }, NONCE);

// Stand in for the VS Code webview environment: theme variables (Dark Modern),
// a fixed sidebar width, and a stub for acquireVsCodeApi.
const harness = `<style>
  :root {
    --vscode-editor-background: #1f1f1f;
    --vscode-editor-foreground: #cccccc;
    --vscode-foreground: #cccccc;
    --vscode-descriptionForeground: #9d9d9d;
    --vscode-sideBar-background: #181818;
    --vscode-font-family: "Segoe UI", "Helvetica Neue", sans-serif;
    --vscode-font-size: 13px;
    --vscode-button-background: #0078d4;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #026ec1;
    --vscode-toolbar-hoverBackground: rgba(90, 93, 94, 0.31);
    --vscode-icon-foreground: #cccccc;
    --vscode-focusBorder: #0078d4;
    --vscode-textLink-foreground: #4daafc;
    --vscode-textLink-activeForeground: #4daafc;
  }
  html { background: #181818; zoom: ${process.env.PREVIEW_ZOOM ?? 1}; }
  body { width: 340px; margin: 0 auto; }
  /* Screenshots must not catch entrance animations mid-flight. */
  *, *::before, *::after { animation: none !important; transition: none !important; }
</style>
<script nonce="${NONCE}">window.acquireVsCodeApi = () => ({ postMessage() {}, getState() {}, setState() {} });</script>`;

html = html.replace("<style>", `${harness}<style>`);
html = html.replace("</body>", `<script nonce="${NONCE}">document.querySelectorAll("details").forEach((d) => { d.open = true; });</script></body>`);

const target = path.join(__dirname, "..", "out", "webview-preview.html");
fs.writeFileSync(target, html);
console.log(`Wrote ${target}`);
