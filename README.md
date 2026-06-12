# GitHub Copilot Model Advisor

> Know which GitHub Copilot Chat model to use right now, without leaving VS Code.

[![Version](https://img.shields.io/badge/version-1.0.1-68f0a7)](CHANGELOG.md)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.92-65d8e9)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-f3bb58)](LICENSE)

You notice Copilot feels slow. Is it the model, the provider, or just your current task? Without leaving the editor you have no signal — until now.

GitHub Copilot Model Advisor answers that question in seconds: it checks which models are enabled for your account, reads public provider health feeds without sending any prompts, and optionally measures first-token latency when you want a live speed signal.

**Website:** [cperezsx.github.io/GitHubCopilotModelAdvisor](https://cperezsx.github.io/GitHubCopilotModelAdvisor/)

![GitHub Copilot Model Advisor sidebar](media/hero.jpg)

## Contents

- [Why It Exists](#why-it-exists)
- [What Is Real and What Is a Heuristic](#what-is-real-and-what-is-a-heuristic)
- [Quickstart](#quickstart)
- [How It Works](#how-it-works)
- [Commands & Settings](#commands--settings)
- [Limits](#limits)
- [Development](#development)
- [Support](#support)
- [Authors](#authors)
- [License](#license)

## Why It Exists

The everyday scenario: you are mid-task, Copilot feels sluggish, and you do not know whether to switch models or wait. Opening a provider dashboard breaks your flow. Asking a colleague is not always an option.

Model Advisor keeps that signal inside VS Code. Open the sidebar, press `Ctrl+Shift+M`, and in a few seconds you see which of your enabled models is healthy and fast right now. The default check never sends a prompt to any model and uses zero GitHub Copilot tokens. Benchmarking is opt-in and always asks for confirmation.

## What Is Real and What Is a Heuristic

Being honest about what the extension can and cannot know:

### Reliable signals

| What | Why it is reliable |
| --- | --- |
| Model list | Read directly from `vscode.lm.selectChatModels({ vendor: "copilot" })` — the official VS Code API. Always reflects your account, organization, and session. |
| Provider health and incidents | Read from the same public status feeds the providers themselves maintain (OpenAI, Anthropic, Google, GitHub). When an incident is declared there, it appears here. |
| First-token latency (benchmark) | Measured by sending a tiny real prompt and cancelling the stream on the first chunk. As honest as latency measurement gets. |

### Heuristics and known gaps

| What | Why it is approximate |
| --- | --- |
| Recommendation score | Starts at 100, subtracts points for slow tokens, degraded providers, and active incidents. Useful orientation — not a guarantee about your specific prompt or task. |
| Google / Gemini status | Google Cloud's incident feed is generic. The extension flags incidents that mention Gemini, Vertex AI, or generative AI — it will miss silent degradation that goes undeclared. |
| Benchmark vs real-world latency | A `hi` prompt measuring 300 ms does not predict a 4 000-token context. It tells you the model is alive and responding, not how it will perform under load. |
| Silent saturation | If a provider's servers are stressed but no incident has been declared, the extension cannot detect it. Neither can any external tool. |

The `Auto` entry (GitHub's routing alias) is excluded from detection, scoring, and benchmarks: because GitHub picks the underlying model per request, latency and provider health cannot be attributed to it.

## Quickstart

1. Install [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) and sign in to GitHub in VS Code.
2. Install GitHub Copilot Model Advisor.
3. Open the **Model Advisor** icon in the Activity Bar.
4. Click **Health check** or press `Ctrl+Shift+M` (`Cmd+Shift+M` on macOS).
5. Use the recommended model at the top, or pick from the light / medium / complex task suggestions.

When raw speed matters, click **Benchmark** on one model or **Benchmark all**. The extension shows a confirmation dialog before sending any prompt.

## How It Works

Models are discovered through the official VS Code language model API, so the list always matches what your account can actually use. Each model starts at a score of 100 and loses points based on three signals:

**1. Latency** (only when benchmarked)

| First-token time | Penalty |
| --- | --- |
| Under 800 ms | 0 |
| 800 – 1 500 ms | −10 |
| 1 500 – 3 000 ms | −30 |
| Over 3 000 ms | −50 |
| Timeout | −90 |
| Error | −80 |
| Not benchmarked | −10 |

**2. Provider health**

| Status | Penalty |
| --- | --- |
| Operational | 0 |
| Degraded performance | −20 |
| Partial outage | −40 |
| Major outage | −80 |
| Unknown | −5 |

**3. Active incidents** add −30 on top. Ties break by latency.

Health signals come from public status feeds:

| Provider | Source |
| --- | --- |
| OpenAI | status.openai.com |
| Anthropic | status.claude.com |
| Google | status.cloud.google.com |
| GitHub Copilot | githubstatus.com |

## Commands & Settings

| Command | Purpose |
| --- | --- |
| `Open Advisor` | Opens the sidebar. |
| `Check Health Now` | Token-free detection, health check, and scoring. |
| `Benchmark Latency (Uses GitHub Copilot Tokens)` | Confirms, then runs the live latency benchmark. |
| `Open Settings` | Opens extension settings. |

Default keyboard shortcut: `Ctrl+Shift+M` / `Cmd+Shift+M`.

| Setting | Default | Purpose |
| --- | --- | --- |
| `githubCopilotModelAdvisor.autoCheckOnStartup` | `false` | Run a token-free check when VS Code starts. |
| `githubCopilotModelAdvisor.showInStatusBar` | `true` | Show the status bar item. |
| `githubCopilotModelAdvisor.testPrompt` | `hi` | Prompt used only for explicit latency benchmarks. |

## Limits

- **Model switching**: VS Code does not expose an API for an extension to set the active Copilot Chat model. The extension advises; you select.
- **Silent saturation**: Undeclared provider degradation is invisible to any external tool, including this one.
- **Benchmark ≠ production latency**: The tiny benchmark prompt measures responsiveness, not throughput under your real workload.
- **Google precision**: Only declared Google Cloud incidents mentioning Gemini, Vertex AI, or generative AI are flagged.
- **Tokens**: Only explicit benchmarks use GitHub Copilot tokens. Health checks never do.

## Development

```bash
npm install
npm run check     # type-check only
npm run compile
npm run package   # build .vsix
```

Press `F5` to launch an Extension Development Host. Run `node scripts/webview-preview.js` to render the sidebar with sample data in `out/webview-preview.html` for visual inspection and screenshots. Design notes and internal specs live in [docs/internal/](docs/internal/).

## Support

Report bugs via [GitHub Issues](https://github.com/cperezsx/GitHubCopilotModelAdvisor/issues). Include your VS Code version, OS, extension version, and whether GitHub Copilot Chat is installed and signed in. Never include secrets, private prompts, or provider tokens. See [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).

## Authors

Carlos Perez — GitHub: [@cperezsx](https://github.com/cperezsx) · LinkedIn: [cperezsx](https://www.linkedin.com/in/cperezsx/)

Jose Miguel Durá — GitHub: [@JMDura](https://github.com/JMDura) · LinkedIn: [Jose Miguel Durá Sirvent](https://www.linkedin.com/in/jose-miguel-dur%C3%A1-sirvent/)

## License

MIT. See [LICENSE](LICENSE).
