# GitHubCopilotModelAdvisor

GitHubCopilotModelAdvisor is a VS Code sidebar extension that helps you choose the best GitHub Copilot chat model for the moment you are working in.

It compares the Copilot models available to your account, measures first-token latency with a tiny prompt, checks public provider health, and recommends the fastest healthy option.

![GitHubCopilotModelAdvisor preview](media/hero.jpg)

## Product Intent

The extension is designed for low-friction use inside VS Code:

- Sidebar webview in the Activity Bar.
- One-click model check.
- Status bar summary.
- Clear scoring based on latency, provider health, and active incidents.
- Honest limitations: it does not switch the Copilot model automatically and it uses a few Copilot tokens per check.

## Development

```bash
npm install
npm run check
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.

## Commands

- `GitHubCopilotModelAdvisor: Check Models Now`
- `GitHubCopilotModelAdvisor: Open Advisor`
- `GitHubCopilotModelAdvisor: Open Settings`

## Repository

Main branch: `main`

Working branch: `develop`
