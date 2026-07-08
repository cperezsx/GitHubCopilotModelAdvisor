const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAdvisorResult, scoreModel } = require("../out/advisor");

function model(id, name, provider) {
  return {
    id,
    name,
    vendor: "copilot",
    family: id,
    provider,
    route: "github-copilot"
  };
}

function status(provider, level, incidents = []) {
  return {
    provider,
    status: level,
    incidents,
    statusPageUrl: "https://example.com",
    checkedAt: 1
  };
}

test("scoreModel penalizes skipped latency without hiding a healthy model", () => {
  const recommendation = scoreModel(
    model("gpt-5-mini", "GPT-5 mini", "openai"),
    { status: "skipped", latency: null, reason: "health only" },
    status("openai", "operational")
  );

  assert.equal(recommendation.score, 90);
  assert.equal(recommendation.confidence.level, "medium");
  assert.match(recommendation.reason, /Run a benchmark/);
});

test("scoreModel applies provider and incident penalties", () => {
  const recommendation = scoreModel(
    model("claude-sonnet", "Claude Sonnet", "anthropic"),
    { status: "fast", latency: 500, checkedAt: 1000 },
    status("anthropic", "partial_outage", ["Incident"])
  );

  assert.equal(recommendation.score, 30);
  assert.equal(recommendation.confidence.level, "low");
});

test("scoreModel lowers confidence and score for stale cached latency", () => {
  const recommendation = scoreModel(
    model("gpt-5-mini", "GPT-5 mini", "openai"),
    { status: "fast", latency: 450, checkedAt: 1000, source: "cache", isStale: true },
    status("openai", "operational")
  );

  assert.equal(recommendation.score, 90);
  assert.equal(recommendation.confidence.level, "low");
  assert.match(recommendation.reason, /stale/);
});

test("Microsoft and xAI models fall back to GitHub Copilot health, Moonshot uses its own feed", () => {
  const models = [
    model("mai-code-1-flash", "MAI-Code-1-Flash", "microsoft"),
    model("grok-code-fast-1", "Grok Code Fast 1", "xai"),
    model("kimi-k2.7-code", "Kimi K2.7 Code", "moonshot")
  ];
  const latencies = new Map([
    ["mai-code-1-flash", { status: "fast", latency: 300, checkedAt: 1000, source: "live" }],
    ["grok-code-fast-1", { status: "fast", latency: 350, checkedAt: 1000, source: "live" }],
    ["kimi-k2.7-code", { status: "fast", latency: 500, checkedAt: 1000, source: "live" }]
  ]);
  const statuses = new Map([
    ["moonshot", status("moonshot", "operational")],
    ["github-copilot", status("github-copilot", "major_outage")]
  ]);

  const result = buildAdvisorResult(models, latencies, statuses, "benchmark");
  const mai = result.models.find((item) => item.model.id === "mai-code-1-flash");
  const grok = result.models.find((item) => item.model.id === "grok-code-fast-1");
  const kimi = result.models.find((item) => item.model.id === "kimi-k2.7-code");

  assert.equal(mai.providerStatus.provider, "github-copilot");
  assert.equal(mai.score, 20);
  assert.equal(grok.providerStatus.provider, "github-copilot");
  assert.equal(grok.score, 20);
  assert.equal(kimi.providerStatus.provider, "moonshot");
  assert.equal(kimi.score, 100);
});

test("buildAdvisorResult keeps benchmark timestamp and cached token notice", () => {
  const models = [
    model("gpt-5-mini", "GPT-5 mini", "openai"),
    model("claude-opus", "Claude Opus", "anthropic")
  ];
  const latencies = new Map([
    ["gpt-5-mini", { status: "fast", latency: 450, checkedAt: 1000, source: "cache" }],
    ["claude-opus", { status: "slow", latency: 2200, checkedAt: 2000, source: "cache" }]
  ]);
  const statuses = new Map([
    ["openai", status("openai", "operational")],
    ["anthropic", status("anthropic", "operational")],
    ["github-copilot", status("github-copilot", "operational")]
  ]);

  const result = buildAdvisorResult(models, latencies, statuses, "cachedBenchmark");

  assert.equal(result.lastBenchmarkAt, 2000);
  assert.equal(result.best.model.id, "gpt-5-mini");
  assert.equal(result.best.confidence.level, "medium");
  assert.match(result.tokenNotice, /does not send prompts/);
  assert.equal(result.taskRecommendations.length, 3);
});
