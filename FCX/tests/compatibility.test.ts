import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hookInstallOrder } from "../src/hooks/manifest";

const root = resolve(import.meta.dirname, "..");
const settingsSource = readFileSync(
  resolve(root, "src/ui/settings-runtime.ts"),
  "utf8",
);
const bootstrapSource = readFileSync(
  resolve(root, "src/platform/bootstrap-runtime.ts"),
  "utf8",
);
const sbcSource = readFileSync(
  resolve(root, "src/domain/sbc/runtime.ts"),
  "utf8",
);
const marketSource = readFileSync(
  resolve(root, "src/domain/market/runtime.ts"),
  "utf8",
);
const solverSource = readFileSync(resolve(root, "src/ui/solver-runtime.ts"), "utf8");
const baseUiSource = readFileSync(resolve(root, "src/ui/base-runtime.ts"), "utf8");
const defaultsSource = readFileSync(
  resolve(root, "src/config/default-settings.ts"),
  "utf8",
);

describe("legacy behavior characterization", () => {
  it("keeps the original hook installation order", () => {
    expect(hookInstallOrder).toEqual([
      "sbcViewOverride",
      "sbcButtonOverride",
      "playerItemOverride",
      "playerSlotOverride",
      "packOverRide",
      "sideBarNavOverride",
      "favTagOverride",
      "sbcSubmitChallengeOverride",
      "unassignedItemsOverride",
      "initDefaultSettings",
      "futHomeOverride",
    ]);
  });

  it("removes duplicate choices and routes named-player protection through locks", () => {
    expect(settingsSource).not.toContain("excludePlayers");
    expect(settingsSource).not.toContain("createChoice");
    expect(settingsSource.match(/createExclusionPicker\(\{/g)).toHaveLength(4);
  });

  it("keeps FCX pages out of the native Home Hub tile lifecycle", () => {
    expect(settingsSource).toContain("JSUtils.inherits(fcxStandaloneView, EAView)");
    expect(settingsSource).toContain(
      "JSUtils.inherits(sbcSettingsView, fcxStandaloneView)",
    );
    expect(settingsSource).toContain(
      "JSUtils.inherits(autoSbcView, fcxStandaloneView)",
    );
    expect(settingsSource).not.toContain(
      "JSUtils.inherits(sbcSettingsView, UTHomeHubView)",
    );
    expect(settingsSource).not.toContain(
      "JSUtils.inherits(autoSbcView, UTHomeHubView)",
    );
    expect(solverSource).toContain("homeHubInit.apply(this, args)");
  });

  it("keeps debug shortcuts out of editable input and removes the unresolved SBC call", () => {
    expect(bootstrapSource).toContain("const isFcxShortcutTypingTarget");
    expect(bootstrapSource).toContain(
      'target.closest("input, textarea, select, [contenteditable]")',
    );
    expect(bootstrapSource).toContain("e.defaultPrevented");
    expect(bootstrapSource).toContain("e.isComposing");
    expect(bootstrapSource).toContain("e.ctrlKey");
    expect(bootstrapSource).toContain('e.key === "z"');
    expect(bootstrapSource).toContain("await getStorage()");
    expect(bootstrapSource).toContain('e.key === "q"');
    expect(bootstrapSource).not.toContain("let nextSetId;");
    expect(bootstrapSource).not.toContain("solveSBC(nextSetId");
    expect(bootstrapSource).toContain('e.key === "r"');
    expect(solverSource).toContain("Number.isSafeInteger(numericSetId)");
    expect(solverSource).toContain("SBC集合编号无效，请重新选择SBC");
  });

  it("removes the legacy three-digit task counter", () => {
    expect(bootstrapSource).not.toContain("function Counter");
    expect(baseUiSource).not.toContain(".numCounter");
  });

  it("removes the stale recursive set tracker while retaining the price fix", () => {
    expect(sbcSource).not.toContain("window.__sbcTried");
    expect(marketSource).not.toContain("items[key] = cachedItem");
  });

  it("retains a loopback-only configurable backend without polling solver logs", () => {
    expect(defaultsSource).toContain('apiUrl: "http://127.0.0.1:8000"');
    expect(defaultsSource).toContain("backendPort: 8000");
    expect(settingsSource).toContain("normalizeBackendPort");
    expect(settingsSource).not.toContain("/solver-logs");
    expect(sbcSource).toContain("requestSbcSolution");
    expect(settingsSource).not.toContain("/solver-logs");
    expect(sbcSource).toContain("canonicalizeBackendCandidates");
    expect(sbcSource).toContain("clubPlayers: backendPlayersInput");
  });

  it("uses the native Tampermonkey transport for FUT.GG", () => {
    expect(baseUiSource).not.toContain("function GM_xmlhttpRequest");
    expect(marketSource).toContain("requestTextWithRetry(spec.url, GM_xmlhttpRequest");
    expect(marketSource).not.toContain(
      'createProgressBar(progressBarId, containerId, "正在读取球员价格")',
    );
  });

  it("keeps the ordered fallback chain and shared batch size explicit", () => {
    expect(marketSource).toContain("PRICE_LOOKUP_BATCH_SIZE");
    expect(marketSource).toContain("resolvePriceBatch");
    expect(marketSource).toContain("runtimeState.futggBlockedForSession");
  });

  it("keeps price infrastructure failures out of the solve control flow", () => {
    expect(marketSource).toContain("provider unavailable");
    expect(marketSource).not.toContain(
      "所有在线价格源暂时不可用，继续使用本地旧缓存",
    );
    expect(marketSource).not.toContain(
      "showNotification(message, UINotificationType.NEGATIVE)",
    );
    expect(sbcSource).toContain("normalizedRunOptions.ignoreValue");
    expect(solverSource).toContain("if (!ignoreValue && item.concept)");
    expect(solverSource).toContain(
      'if (!ignoreValue && cardType.includes("volution"))',
    );
  });
});
