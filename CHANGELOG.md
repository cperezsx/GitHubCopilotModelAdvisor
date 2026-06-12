# Changelog

## 1.0.0

First stable release.

- Activity Bar sidebar with ranked model list, provider health, and task-fit suggestions (light / medium / complex).
- Token-free health check: reads public status feeds from OpenAI, Anthropic, Google, and GitHub without sending any prompt.
- Opt-in latency benchmark: measures time to first token, cancels on the first response chunk, and always asks for confirmation before spending GitHub Copilot tokens.
- Scoring system: models start at 100 and lose points for slow first tokens, degraded providers, and active incidents. Ties break by latency.
- `Auto` routing alias excluded from detection and scoring — latency and provider health cannot be attributed to an alias that routes to an unknown underlying model.
- Compact status bar summary with clickable shortcut (`Ctrl+Shift+M` / `Cmd+Shift+M`).
- GitHub Pages landing site and automated Pages deployment workflow.
- `scripts/webview-preview.js` for local visual inspection of the sidebar without the extension host.
