# Design

## Register

product

## Scene

A developer is inside VS Code, often in a focused coding session, and wants a quick confidence signal without leaving the editor. The UI should read as a compact instrument panel, not a standalone analytics app.

## Color Strategy

Restrained product palette.

- Surface: VS Code theme background, with a slightly lifted panel layer.
- Text: VS Code foreground and muted description colors.
- Accent: mint signal for recommended or healthy states.
- Warning: amber for degraded states.
- Critical: coral for avoid states.
- Unknown: neutral gray.

Use VS Code CSS variables first. Custom colors should be used sparingly and must remain readable in dark and light themes.

## Typography

Use the native VS Code font stack:

```css
font-family: var(--vscode-font-family);
font-size: var(--vscode-font-size);
```

Hierarchy should come from weight, spacing, and compact scale, not oversized headings. The sidebar is narrow, so labels must be short and scannable.

## Layout

- Primary surface: Activity Bar webview.
- First row: recommendation summary and check action.
- Next: ranked model list with score, latency, health, and reason.
- Secondary: provider status and token disclosure.
- Footer: last checked timestamp and settings link.

Avoid nested cards. Use rows, panels, separators, and compact controls.

## Components

- Recommendation summary.
- Check button with loading state.
- Ranked model row.
- Provider status row.
- Token disclosure note.
- Empty state for no Copilot models.
- Error state for Copilot Chat missing or inactive.

Every interactive component needs default, hover, focus, active, disabled, and loading states.

## Motion

Use short 150-200 ms transitions for state changes only: row highlight, loading shimmer, and status changes. Respect reduced motion.

## Visual Assets

- `media/icon.png`: Marketplace icon, 128x128.
- `media/activity-icon.svg`: theme-aware Activity Bar icon.
- `media/hero.jpg`: README and Marketplace preview visual.
