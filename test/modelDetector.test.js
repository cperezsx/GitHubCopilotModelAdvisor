const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

// providerFromModel is pure; stub the vscode module so it can load outside
// the extension host, mirroring scripts/webview-preview.js.
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "vscode") {
    return {};
  }
  return originalLoad.call(this, request, ...rest);
};

const { providerFromModel } = require("../out/modelDetector");

test("providerFromModel detects OpenAI models including o-series", () => {
  assert.equal(providerFromModel("GPT-5 mini", "gpt-5-mini", "gpt-5-mini"), "openai");
  assert.equal(providerFromModel("o3-mini", "o3-mini", "o3-mini"), "openai");
  assert.equal(providerFromModel("GPT-5.3-Codex", "gpt-5.3-codex", "gpt-5.3-codex"), "openai");
});

test("providerFromModel detects Anthropic models", () => {
  assert.equal(providerFromModel("Claude Sonnet 5", "claude-sonnet-5", "claude-sonnet-5"), "anthropic");
  assert.equal(providerFromModel("Claude Haiku 4.5", "claude-haiku-4.5", "claude-haiku-4.5"), "anthropic");
});

test("providerFromModel detects Moonshot AI Kimi models", () => {
  assert.equal(providerFromModel("Kimi K2.7 Code", "kimi-k2.7-code", "kimi-k2.7-code"), "moonshot");
});

test("providerFromModel detects Microsoft MAI models", () => {
  assert.equal(providerFromModel("MAI-Code-1-Flash", "mai-code-1-flash", "mai-code-1-flash"), "microsoft");
});

test("providerFromModel detects xAI Grok models", () => {
  assert.equal(providerFromModel("Grok Code Fast 1", "grok-code-fast-1", "grok-code-fast-1"), "xai");
});

test("providerFromModel keeps unrecognized models as unknown", () => {
  assert.equal(providerFromModel("Mystery Model", "mystery", "mystery-1"), "unknown");
});
