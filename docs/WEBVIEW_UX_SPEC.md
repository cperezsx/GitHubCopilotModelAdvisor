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
   - Latency.
   - One short reason.

3. Ranked Models
   - Each row shows name, provider, latency, status, score, and a short reason.
   - Recommended row gets a full outline and check mark.
   - Avoid rows use warning or critical indicators.

4. Provider Health
   - Compact rows for OpenAI, Anthropic, GitHub, and unknown providers.
   - Active incident names appear only when present.

5. Disclosure
   - "This check uses about 5 Copilot tokens per model."

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

- Refresh button starts a check immediately.
- Sidebar auto-renders the latest result.
- Status bar item runs a check on click.
- Notification appears only after manual checks, not noisy startup checks.

## Visual Direction

Compact, native, and calm. The UI should look like it belongs inside VS Code but has enough identity to feel intentional.
