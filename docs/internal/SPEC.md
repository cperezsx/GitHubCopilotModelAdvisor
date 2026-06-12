# GitHubCopilotModelAdvisor Spec

## Goal

Help a VS Code user choose the best available GitHub Copilot Chat model right now by combining local Copilot model availability, public model-provider health, GitHub Copilot service health, and optional first-token latency.

## Surfaces

1. Activity Bar sidebar webview.
2. Status bar item.
3. Command palette commands.
4. Output channel for detailed diagnostics.

## Core Flow

1. User opens the GitHubCopilotModelAdvisor sidebar or runs `Check Health Now`.
2. Extension calls `vscode.lm.selectChatModels({ vendor: "copilot" })`.
3. Extension maps each model to its model provider using model name, family, and id.
4. Extension deduplicates repeated display entries before rendering or benchmarking.
5. Extension checks model-provider health plus GitHub Copilot service health in parallel with a 5 second timeout per source.
6. If the user explicitly runs `Benchmark Latency`, extension asks for confirmation before sending prompts.
7. If the user benchmarks one selected model, extension asks for confirmation and sends a prompt only to that model.
8. After confirmation, extension runs latency tests with an 8 second timeout per benchmarked model.
9. Advisor scores each model and ranks results.
10. Advisor derives light, medium, and complex task-fit recommendations from the enabled model list.
11. UI shows the best model first, with task-fit and grouped provider details below.

## Model Detection

Module: `src/modelDetector.ts`

Inputs:

- VS Code language model API.

Output:

```ts
type ModelInfo = {
  id: string;
  name: string;
  vendor: string;
  family: string;
  version?: string;
  maxInputTokens?: number;
  provider: "openai" | "anthropic" | "google" | "unknown";
  route: "github-copilot";
};
```

Provider mapping:

- names, family, or ids containing `gpt`, `openai`, `codex`, or `o[1-9]` -> `openai`
- names, family, or ids containing `claude`, `anthropic`, `haiku`, `sonnet`, or `opus` -> `anthropic`
- names, family, or ids containing `gemini` or `google` -> `google`
- fallback -> `unknown`

Only models returned by `vscode.lm.selectChatModels({ vendor: "copilot" })` are displayed or benchmarked. The extension must describe these as models enabled for the current VS Code/Copilot user, not as a global catalog.

GitHub Copilot is the delivery route for every displayed model. It must not be shown as a model provider. Unknown model providers use GitHub Copilot service health as their fallback operational signal.

## Latency Testing

Module: `src/latencyTester.ts`

Measure time to first token, not full response time.

Rules:

- Default prompt: `hi`
- User confirmation is required before sending benchmark prompts.
- Selected-model benchmark sends a prompt only to the selected model.
- Timeout: 8 seconds per model.
- Execute all tests with `Promise.allSettled`.
- Cancel stream after the first chunk.
- Inform the user that only explicit latency benchmarks use about 5 Copilot tokens per model.

Statuses:

- `fast`: under 1500 ms.
- `slow`: 1500 to 4000 ms.
- `skipped`: health-only mode did not send a prompt.
- `timeout`: no first token within 8 seconds.
- `error`: request failed.

## Provider Health

Module: `src/statusChecker.ts`

Status sources:

- OpenAI: `https://status.openai.com/api/v2/summary.json`
- Anthropic: `https://status.claude.com/api/v2/summary.json`
- Google: `https://status.cloud.google.com/incidents.json`
- GitHub Copilot service: `https://www.githubstatus.com/api/v2/summary.json`

Google Cloud status has a different shape. v1 treats Google as operational when the feed is reachable and no active Gemini, Vertex AI, or generative AI incident is found.

Provider status failures must not block latency scoring.

## Scoring

Module: `src/advisor.ts`

Base score: `100`

Latency penalties:

- Under 800 ms: `0`
- 800 to 1500 ms: `-10`
- 1500 to 3000 ms: `-30`
- Over 3000 ms: `-50`
- Timeout: `-90`
- Error: `-80`
- Not benchmarked: `-10`

Provider health penalties:

- Operational: `0`
- Degraded: `-20`
- Partial outage: `-40`
- Major outage: `-80`
- Unknown: `-5`

Active incident penalty: `-30`

Tie-breaker: lower latency wins.

## v1 Scope

Included:

- Sidebar webview.
- Status bar item.
- Command palette command.
- Model detection.
- Token-free health check.
- Explicit TTFT latency benchmark.
- Selected-model latency benchmark.
- OpenAI, Anthropic, Google, and GitHub Copilot service status checks.
- Provider status page links in the webview.
- Collapsible model grouping by inferred model provider.
- Duplicate display-entry collapse.
- Light, medium, and complex task-fit recommendations.
- Recommendation scoring.
- Marketplace-ready extension metadata.

Excluded:

- Automatic Copilot model switching.
- Predictive outage forecasting.
- Full Google Cloud product-impact precision.
- Persisted historical analytics.
