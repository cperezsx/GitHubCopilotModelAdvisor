# Marketplace Checklist

## Required

- `package.json` includes `publisher`, `repository`, `bugs`, `license`, `icon`, and categories.
- `media/icon.png` is 128x128.
- `README.md` explains the product and limitation around token usage.
- `CHANGELOG.md` exists.
- `LICENSE` exists.
- `.vscodeignore` excludes source and dev-only files from VSIX.
- `npm run check` passes.
- `npm run package` creates a VSIX.

## Repository

- Main branch is `main`.
- Development branch is `develop`.
- Ruleset requires `TypeScript check` before merging to `main`.

## Secrets

- Add repository secret `VSCE_PAT` before running the publish workflow.

## Manual Validation

- Open Extension Development Host.
- Confirm Activity Bar icon appears.
- Confirm sidebar webview renders in dark and light themes.
- Confirm `Check Health Now` handles missing Copilot gracefully.
- Confirm `Benchmark Latency` asks for token-use confirmation before sending prompts.
- Confirm status bar item updates during and after a check.
