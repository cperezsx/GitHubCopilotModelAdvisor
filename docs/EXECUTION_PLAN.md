# Execution Plan

## Phase 1: Foundation

- Scaffold VS Code extension with TypeScript.
- Add Activity Bar webview contribution.
- Add status bar command.
- Add Marketplace metadata, icon, localization files, and VSIX scripts.
- Add CI workflow with job name `TypeScript check`.

## Phase 2: Real Advisor Pipeline

- Implement `modelDetector.ts` with `vscode.lm.selectChatModels`.
- Implement `latencyTester.ts` with first-token timing and cancellation.
- Implement `statusChecker.ts` with public status endpoints.
- Implement `advisor.ts` scoring and recommendation.
- Send results to the webview and output channel.

## Phase 3: UX Polish

- Add loading, empty, error, and partial-data states.
- Add compact provider status section.
- Add settings link and token disclosure.
- Add keyboard and screen-reader labels.
- Validate dark and light themes.

## Phase 4: Store Readiness

- Fill Marketplace copy and screenshots.
- Validate package with `vsce package`.
- Add changelog entries.
- Confirm repository secret `VSCE_PAT`.
- Publish through manual workflow.

## Phase 5: Post-v1

- Optional Gemini status parser.
- Optional model history and trend view.
- Optional recommendations by task type.
- Optional exportable diagnostic snapshot.
