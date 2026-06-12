# GitHubCopilotModelAdvisor Spec

## Goal

Help a VS Code user choose the best available GitHub Copilot Chat model right now by combining local Copilot model availability, first-token latency, and public provider health.

## Surfaces

1. Activity Bar sidebar webview.
2. Status bar item.
3. Command palette commands.
4. Output channel for detailed diagnostics.

## Core Flow

1. User opens the GitHubCopilotModelAdvisor sidebar or runs `Check Models Now`.
2. Extension calls `vscode.lm.selectChatModels({ vendor: "copilot" })`.
3. Extension maps each model to a provider using the model family.
4. Extension runs latency tests in parallel with an 8 second timeout per model.
5. Extension checks provider health in parallel with a 5 second timeout per provider.
6. Advisor scores each model and ranks results.
7. UI shows the best model first, with details available below.

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
  provider: "openai" | "anthropic" | "google" | "github";
};
```

Provider mapping:

- `gpt*` -> `openai`
- `o1*` -> `openai`
- `claude*` -> `anthropic`
- `gemini*` -> `google`
- fallback -> `github`

## Latency Testing

Module: `src/latencyTester.ts`

Measure time to first token, not full response time.

Rules:

- Default prompt: `hi`
- Timeout: 8 seconds per model.
- Execute all tests with `Promise.allSettled`.
- Cancel stream after the first chunk.
- Inform the user that a check uses about 5 Copilot tokens per model.

Statuses:

- `fast`: under 1500 ms.
- `slow`: 1500 to 4000 ms.
- `timeout`: no first token within 8 seconds.
- `error`: request failed.

## Provider Health

Module: `src/statusChecker.ts`

Statuspage sources:

- OpenAI: `https://status.openai.com/api/v2/summary.json`
- Anthropic: `https://status.anthropic.com/api/v2/summary.json`
- GitHub: `https://www.githubstatus.com/api/v2/summary.json`

Google Cloud status has a different shape and should stay `unknown` in v1 unless Gemini usage becomes important.

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
- TTFT latency test.
- OpenAI, Anthropic, and GitHub status checks.
- Recommendation scoring.
- Marketplace-ready extension metadata.

Excluded:

- Automatic Copilot model switching.
- Predictive outage forecasting.
- Gemini status parsing.
- Persisted historical analytics.
