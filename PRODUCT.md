# Product

## Register

product

## Users

Developers using GitHub Copilot Chat in VS Code who need to choose a model quickly while staying in flow. They are often mid-task, comparing speed and reliability rather than studying provider dashboards.

## Product Purpose

GitHubCopilotModelAdvisor turns model selection into a quick operational signal. It detects Copilot models available to the user, checks public model-provider and GitHub Copilot service health without sending prompts, optionally measures first-token latency on explicit request, and recommends the best current option with minimal interaction.

Success means the user can open the sidebar, run a check, and know which model to use in a few seconds.

## Brand Personality

Precise, calm, useful.

The product should feel like a compact developer instrument: factual, fast, and quietly polished.

## Anti-references

Avoid marketing-heavy dashboards, decorative AI sparkle overload, noisy charts, provider tribalism, and any UI that hides uncertainty. Do not make the user read a long report before seeing the recommendation.

## Design Principles

1. Recommendation first, details second.
2. No hidden cost: default checks use no Copilot tokens, and benchmarks disclose their token use before they run.
3. Treat uncertainty as data, not failure.
4. Fit the VS Code surface instead of fighting it.
5. Make the fastest path the obvious path.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Do not rely on color alone for status. Respect VS Code theme colors where possible, support keyboard interaction, visible focus states, reduced motion, and concise screen-reader labels.
