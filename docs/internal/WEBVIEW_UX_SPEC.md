# Webview UX Spec

## Primary Job

Answer one question quickly: which Copilot model should I use right now?

## Sidebar Structure

1. Header
   - Product name.
   - Last checked time.
   - Icon buttons: refresh, settings.

2. Recommendation
   - Best model name.
   - Score.
   - Latency when benchmarked, or "not benchmarked" in health-only mode.
   - One short reason.

3. Task Fit
   - Light tasks prefer lightweight enabled models such as mini, haiku, flash, nano, or similar.
   - Medium tasks prefer balanced enabled models.
   - Complex tasks prefer enabled models with stronger reasoning or coding-processing signals.
   - The section must say or imply that these suggestions are based on enabled Copilot models for the current user.

4. Ranked Models
   - Rows are grouped by inferred model provider, not by delivery route.
   - Provider groups are collapsible/expandable, visually separated, and show a model count.
   - Group subtitles clarify that models are delivered through GitHub Copilot.
   - Each row shows name, latency, status, score, and a short reason.
   - Duplicate display entries are collapsed before rendering.
   - Recommended row gets a full outline and check mark.
   - Avoid rows use warning or critical indicators.

5. Health Sources
   - Compact rows for OpenAI, Anthropic, Google, and GitHub Copilot service health.
   - Unknown model-provider groups fall back to GitHub Copilot service health.
   - Each provider row links to its public status page.
   - Active incident names appear only when present.

6. Disclosure
   - "Showing only Copilot models currently enabled for this user in VS Code."
   - Token disclosure is a prominent notice, not a footer note.
   - "Health check does not use Copilot tokens. Latency benchmark uses about 5 Copilot tokens per model."

## Empty State

Title: "No Copilot models found"

Body: "Install and sign in to GitHub Copilot Chat, then run a check again."

Actions:

- Open Extensions search for GitHub Copilot Chat.
- Open GitHub sign-in command when available.

## Error State

Do not dump raw stack traces in the sidebar. Show a short message and write technical details to the output channel.

Examples:

- "GitHub Copilot Chat is required."
- "VS Code 1.92 or newer is required."
- "Provider status is unavailable, latency results still count."

## Interaction Rules

- Health check button starts a token-free provider and model availability check.
- Benchmark latency button asks for confirmation before starting a Copilot prompt-based latency test.
- Each model row has a selected-model benchmark action that asks for confirmation and benchmarks only that model.
- Sidebar auto-renders the latest result.
- Status bar item runs a token-free health check on click.
- Notification appears only after manual checks, not noisy startup checks.

## Visual Direction

Compact, native, and calm. The UI should look like it belongs inside VS Code but has enough identity to feel intentional.
