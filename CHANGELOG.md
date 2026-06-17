# Changelog

## 1.0.2

- Added global benchmark latency cache shared across VS Code workspaces.
- Added visible last-benchmark timestamps in the sidebar and output channel.
- Benchmark commands now offer cached results before spending more GitHub Copilot tokens.
- Added configurable cache TTL, stale-cache labeling, benchmark history, median latency, and trend chips.
- Added benchmark comparison against the previous measurement for the same model.
- Added recommendation confidence levels so users can distinguish live, cached, stale, and partial signals.
- Added a setting to disable Benchmark All while keeping per-model benchmarks available.
- Added a Copy Diagnostics command for support reports without including prompts or workspace content.
- Provider incidents now appear inline next to health sources when available.
- Removed the default keyboard shortcut to avoid conflicting with VS Code's Problems shortcut.
- Hardened webview external-link handling and script nonce generation.
- Reduced Marketplace package contents and added basic recommendation tests.

## 1.0.0

First stable release.

- Activity Bar sidebar with ranked model list, provider health, and task-fit suggestions (light / medium / complex).
- Token-free health check: reads public status feeds from OpenAI, Anthropic, Google, and GitHub without sending any prompt.
- Opt-in latency benchmark: measures time to first token, cancels on the first response chunk, and always asks for confirmation before spending GitHub Copilot tokens.
- Scoring system: models start at 100 and lose points for slow first tokens, degraded providers, and active incidents. Ties break by latency.
- `Auto` routing alias excluded from detection and scoring — latency and provider health cannot be attributed to an alias that routes to an unknown underlying model.
- Compact status bar summary with clickable health-check command.
- GitHub Pages landing site and automated Pages deployment workflow.
- `scripts/webview-preview.js` for local visual inspection of the sidebar without the extension host.
