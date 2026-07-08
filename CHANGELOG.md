# Changelog

## 1.1.0

- Added Moonshot AI as an inferred provider (Kimi K2.7 Code and other Kimi models) with its own public health feed (status.moonshot.cn).
- Added Microsoft as an inferred provider (MAI-Code-1-Flash and other MAI models). Microsoft AI publishes no dedicated public status feed, so MAI model health tracks the GitHub Copilot service status.
- Added xAI as an inferred provider (Grok Code Fast and other Grok models). status.x.ai has no machine-readable feed, so Grok model health also tracks the GitHub Copilot service status.
- Task-fit weighting now recognizes Kimi/K2 models as balanced everyday models and speed-focused models ("fast", like Grok Code Fast) as light picks; MAI Flash models already land in the light bucket.
- CI now runs the full test suite and a webview render smoke test on every pull request, not just the TypeScript type check.
- Refreshed the landing-site sidebar screenshot to the redesigned UI, including the new provider groups.
- Redesigned model rows: fewer chips (latency, change vs previous benchmark as an arrow, stale, confidence), with the measurement time and recent median moved to a quiet secondary line. Timestamps are now relative ("8 min ago") with the full date in a tooltip; confidence chips explain themselves in a tooltip.
- Redesigned Health Sources: rows use a fixed grid (status dot, provider, status, link) so long incident descriptions wrap below the row instead of misaligning it. Incident text is clamped to two lines with the full text in a tooltip.
- Removed the redundant "via GitHub Copilot" line from every model row; the provider group header already states it.
- Removed activation events that VS Code generates automatically from contribution declarations.

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
