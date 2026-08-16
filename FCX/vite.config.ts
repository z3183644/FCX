import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import monkey from "vite-plugin-monkey";
import { FCX_BRAND_ICON_DATA_URL } from "./src/ui/brand-icon.ts";

const rootDir = import.meta.dirname;
const entryPath = resolve(rootDir, "src/main.ts");
const packageManifest = JSON.parse(
  readFileSync(resolve(rootDir, "package.json"), "utf8"),
) as { version: string };
const userscriptVersion = packageManifest.version === "26.1.0"
  ? "26.1.1"
  : packageManifest.version;
const GREASYFORK_REPOSITORY_URL = "https://github.com/titi14gj/FCX";
const GREASYFORK_MANIFEST_URL =
  "https://raw.githubusercontent.com/titi14gj/FCX/refs/heads/agent/add-macos-liquid-glass-client/FCX/greasyfork/version.json";

interface ScriptMetadata {
  name: string;
  namespace: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepageURL: string;
  supportURL?: string;
  sourceURL?: string;
  antifeature?: string;
  updateManifestURL: string;
  autoUpdateCheck: boolean;
  fileName: string;
  outDir: string;
  connectHosts: string[];
  icon: string;
}

function createScriptMetadata(mode: string): ScriptMetadata {
  const common = {
    version: userscriptVersion,
    license: "MIT",
    icon: FCX_BRAND_ICON_DATA_URL,
  } as const;
  if (mode === "greasyfork") {
    return {
      ...common,
      name: "FCX macOS 自用维护版（非官方）",
      namespace: GREASYFORK_REPOSITORY_URL,
      description:
        "基于一阵失心风 FCX 的 macOS 非官方维护版，新增原生后端、SBC 统计、停止原因提醒与自然语言诊断。",
      author: "titi14gj（维护）；一阵失心风（原作）",
      homepageURL: GREASYFORK_REPOSITORY_URL,
      supportURL: `${GREASYFORK_REPOSITORY_URL}/issues`,
      sourceURL: GREASYFORK_REPOSITORY_URL,
      antifeature:
        "tracking 可选远程登录功能会向原 FCX 服务发送设备状态、任务状态和运行日志",
      updateManifestURL: GREASYFORK_MANIFEST_URL,
      autoUpdateCheck: false,
      fileName: "FCX-macOS.user.js",
      outDir: resolve(rootDir, "greasyfork"),
      connectHosts: [
        "www.fut.gg",
        "enhancer-api.futnext.com",
        "127.0.0.1",
        "fc.fczhushou.com",
        "fczhushou.com",
        "raw.githubusercontent.com",
        "ntfy.sh",
      ],
    };
  }
  return {
    ...common,
    name: "一阵失心风FCX",
    namespace: "http://tampermonkey.net/",
    description: "FCX 市面最先进滚卡，登录可享小程序。",
    author: "一阵失心风",
    homepageURL: "https://fczhushou.com",
    updateManifestURL: "https://fczhushou.com/fcx/version.json",
    autoUpdateCheck: true,
    fileName: "FCX.js",
    outDir: resolve(rootDir, "dist"),
    connectHosts: [
      "www.fut.gg",
      "enhancer-api.futnext.com",
      "127.0.0.1",
      "fc.fczhushou.com",
      "fczhushou.com",
      "ntfy.sh",
    ],
  };
}

const runtimeFiles = [
  "src/ui/base-runtime.ts",
  "src/domain/inventory/runtime.ts",
  "src/ui/solver-runtime.ts",
  "src/domain/sbc/runtime.ts",
  "src/hooks/items-runtime.ts",
  "src/domain/market/runtime.ts",
  "src/domain/packs/runtime.ts",
  "src/domain/routines/runtime.ts",
  "src/ui/routines-runtime.ts",
  "src/ui/sbc-set-preview-runtime.ts",
  "src/ui/task-history-runtime.ts",
  "src/domain/evolutions/runtime.ts",
  "src/ui/settings-runtime.ts",
  "src/platform/bootstrap-runtime.ts",
].map((path) => resolve(rootDir, path));

function createUserscriptHeader(scriptMetadata: ScriptMetadata): string {
  const optionalMetadata = [
    scriptMetadata.supportURL
      ? `// @supportURL   ${scriptMetadata.supportURL}`
      : "",
    scriptMetadata.sourceURL
      ? `// @source       ${scriptMetadata.sourceURL}`
      : "",
    scriptMetadata.antifeature
      ? `// @antifeature  ${scriptMetadata.antifeature}`
      : "",
  ].filter(Boolean).join("\n");
  const connectMetadata = scriptMetadata.connectHosts
    .map((host) => `// @connect      ${host}`)
    .join("\n");
  return `// ==UserScript==
// @name         ${scriptMetadata.name}
// @namespace    ${scriptMetadata.namespace}
// @version      ${scriptMetadata.version}
// @description  ${scriptMetadata.description}
// @author       ${scriptMetadata.author}
// @license      ${scriptMetadata.license}
// @homepageURL  ${scriptMetadata.homepageURL}
${optionalMetadata}
// @icon         ${scriptMetadata.icon}
// @icon64       ${scriptMetadata.icon}
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
${connectMetadata}

// ==/UserScript==`;
}

function orderedRuntime(): Plugin {
  return {
    name: "fcx-ordered-runtime",
    enforce: "pre",
    load(id) {
      if (resolve(id) !== entryPath) {
        return null;
      }

      const body = runtimeFiles
        .map((file) => readFileSync(file, "utf8"))
        .join("\n\n");

      return `
import { RuntimeState } from "./state/runtime-state";
import { HttpRequestError, requestTextWithRetry, postJsonCompat } from "./api/http";
import { areEaWebAppServicesReady } from "./platform/ea-readiness";
import { SettingsStore } from "./state/settings-store";
import { SettingsEditSession } from "./state/settings-edit-session";
import { PlayerProtectionStore } from "./state/player-protection-store";
import { calculateSbcPrice } from "./domain/sbc/pricing";
import { isBackendCandidate } from "./domain/sbc/player-filter";
import { getStalePriceIds, isCachedPriceOld, updateRatingReferencePrices } from "./domain/market/price-cache";
import { countPlayersByRating } from "./domain/inventory/rating-counts";
import { appendUniqueInventoryItems } from "./domain/inventory/pagination";
import { convertAbbreviatedNumber as convertNumber, padNumber } from "./utils/numbers";
import { uiText } from "./config/ui-text";
import { showFcxLoadedBadge } from "./ui/load-badge";
import { clearPriceRecords, loadPriceRecords, mergePriceRecordMaps, readFallbackPriceRecords, savePriceRecords } from "./state/price-store";
import { collectPriceCacheDiagnostics, appendPriceDiagnosticEvent } from "./state/price-diagnostics";
import { chunkPriceIds, resolvePriceBatch } from "./domain/market/price-providers";
import { PRICE_LOOKUP_BATCH_SIZE, STORAGE_KEYS } from "./config/constants";
import { openPriceCacheDiagnosticsDialog } from "./ui/price-cache-diagnostics";
import { localizeFcxNotification, localizeSolverStatus } from "./ui/notifications";
import { planUnassignedRoutes } from "./domain/packs/routing";
import { expandPackSelections, insertImmediatePackSelections, nextStorageRecoveryRound, storageProgressMade } from "./domain/packs/storage-recovery";
import { openFcxModal } from "./ui/modal";
import { EaRequestGate, eaResponseStatus, executeEaRequest, isEaThrottleStatus, normalizeEaRequestRetryConfig } from "./platform/ea-request-retry";
import { SbcSessionCache } from "./state/sbc-session-cache";
import { InventorySessionCache } from "./state/inventory-session-cache";
import { AutoSbcSessionSnapshotStore, resolveAutoSbcSessionData } from "./state/auto-sbc-session-snapshot";
import { clearOperationStatus, reportOperationStatus } from "./ui/operation-status";
import { createSbcExecutionContext, normalizeSbcRunOptions } from "./types/sbc-run";
import { executeSbcSetPlan } from "./domain/sbc/set-execution";
import { parseSolveOutcome, placeSolverResults } from "./domain/sbc/solver-outcome";
import { formatSquadRatingWindow, resolveStrictSquadRatingWindow, validateMinimumRatingProof, validateSolverSquadRating } from "./domain/sbc/squad-rating";
import { requiresMinimumRatingFirst, supportsMinimumRatingFirst } from "./domain/sbc/backend-features";
import { ensureTaskOverlayRoot, mountTaskEndButton, removeLegacyTaskControls, removeTaskEndButton, removeTaskOverlayRoot, setTaskOverlayFallbackActive } from "./ui/task-overlay";
import { EaTaskShieldController } from "./ui/task-shield";
import { extractActiveSquadEntityItemIds, extractActiveSquadItemIds, filterProtectedPlayers, findProtectedPlayerViolations, isEvolutionPlayer, readActiveSquadItemIdsFromCandidates, resolveActiveSquadEntity, resolveActiveSquadIdCandidates } from "./domain/inventory/player-protection";
import { aggregateProtectedPlayers } from "./domain/inventory/protected-players";
import { getSbcRepeatability, effectiveRequestedRuns, shouldContinueSbcTask } from "./domain/sbc/repeatability";
import { getSbcCatalogStatus } from "./domain/sbc/catalog-status";
import { PriceLookupCoordinator } from "./domain/market/price-coordinator";
import { addPackPlayers, addSbcSubmission, createPackTaskSummary, mergePackTaskSummary, refreshPackDestinationCounts, setPlayerDestination } from "./domain/packs/task-summary";
import { PLAYER_PICK_CONFIRM_WAIT_MS, PLAYER_PICK_MAX_ATTEMPTS, PLAYER_PICK_REPOSITORY_WAIT_MS, PLAYER_PICK_REWARD_ATTEMPTS, PLAYER_PICK_REWARD_WAIT_MS, PLAYER_PICK_ROUTING_PASSES, PLAYER_PICK_ROUTING_WAIT_MS, PLAYER_PICK_UNASSIGNED_TIMEOUT_MS, choosePlayerPickCandidates, confirmedPlayerPickSelections, normalizePlayerPickPayload, playerPickFailureMessage } from "./domain/packs/player-pick";
import {
  findNativePackFooter,
  findNativePackStoreView,
  inspectNativeOwnedPackView,
  readNativePackArticleId,
  resolveNativePackPageWindow,
  resolveNativePackRoot,
} from "./domain/packs/native-pack-action";
import { openPackTaskSummaryDialog } from "./ui/pack-task-summary";
import { openProtectedPlayersDialog } from "./ui/protected-players-dialog";
import { RoutineStore } from "./state/routine-store";
import { RoutineCatalogUpdateController } from "./update/routine-catalog";
import { SpecialFallbackStore } from "./state/special-fallback-store";
import { StorageOverflowFallbackStore } from "./state/storage-overflow-fallback-store";
import { SubmissionCounter } from "./state/submission-counter";
import { runRoutineSchedule } from "./domain/routines/scheduler";
import { resolveRoutineSbcTarget } from "./domain/routines/target-resolution";
import {
  classifyRoutineExecutionStop,
  isRoutineStepFatal,
  isSolveFailureFallbackExhausted,
  shouldTriggerSolveFailureFallback,
} from "./domain/routines/stop-classification";
import { runWithSpecialFallbackLoop } from "./domain/routines/fallback-retry";
import {
  detectTotwShortage,
  hasSupportedSpecialRequirement,
} from "./domain/routines/special-shortage";
import { buildCandidatePipelineDiagnostics, canonicalizeBackendCandidates } from "./domain/sbc/candidate-canonicalization";
import { RemoteControlClient } from "./remote/client";
import { createGmValueAdapter } from "./remote/auth-store";
import { HarvestMomentController } from "./domain/harvest/runtime";
import { ScriptRuntimeLogBuffer } from "./remote/script-logs";
import { localBackendUrl, normalizeBackendPort } from "./config/backend-endpoint";
import { FCX_BRAND_ICON_DATA_URL } from "./ui/brand-icon";
import { ensureFcxDisclaimerAccepted, openFcxDisclaimerDialog } from "./ui/disclaimer";
import { BILIBILI_ICON_SVG, DOUYIN_ICON_SVG, FCX_BILIBILI_URL, FCX_DOUYIN_URL, mountFcxHeaderSupport } from "./ui/support";
import { createFcxMultiSelectControl } from "./ui/multi-select-dialog";
import { createFcxViewSafely, initializeFcxStandaloneView } from "./ui/standalone-view";
import { createFcxSwitchControl } from "./ui/switch-control";
import { FcxVersionUpdateController } from "./ui/version-update";
import { defaultSolverSettings } from "./config/default-settings";
import { hasActivePriceRange, resolveCandidateRules } from "./config/fcx-sbc-recommendations";
import { applyFcxRarityGroupPolicy, requiredRarityGroupIds } from "./domain/sbc/rarity-group-rules";
import { confirmIgnoringPriceRules } from "./ui/price-rule-confirmation";
import { candidateRuleStandaloneSaveChallengeId, createCandidateRulesEditor } from "./ui/candidate-rules-editor";
import { classifySbcRewards, consumeHistoricalPlayerPickBaseline, countPackInventory, countPlayerPickInventory, hasPendingTrackedRewards, isPlayerPickItemLike, markPlayerPickProcessed, markRewardPacksProcessed, packRewardKey, playerPickDefinitionId, playerPickInstanceKey, recordExpectedRewards, selectNewPlayerPickItems, selectNewRewardPacks } from "./domain/sbc/reward-tracking";
import { snapshotConsumedPlayers } from "./domain/sbc/consumption-summary";
import { PLAYSTYLE_ACADEMY_CONFIG, ACADEMY_ROLE_LABELS } from "./config/playstyle-academy";
import { academyPlayerPositions, academyPlayerRarities, buildAcademyApplyPlan, countTargetPlayStyles, isAcademyEligiblePlayer, localizeAcademyError, nextPlayStyleTarget, readPlayStyleCounts, recommendPlayStyles, snapshotPlayStyleLevels } from "./domain/evolutions/playstyle-academy";
import { refreshAcademyClubList } from "./domain/evolutions/academy-refresh";
import { AcademyPreferencesStore } from "./state/academy-preferences-store";
import { TaskHistoryStore } from "./state/task-history-store";
import { buildTaskHistoryDiagnosticText, renderTaskHistoryDetail, taskHistoryLocalDateKey, taskHistoryStatusLabel, taskHistoryTypeLabel } from "./ui/task-history-view";
import { createEaSbcCompletionSnapshot, createSbcActivityEvent, readVisibleDailySbcCount, SbcActivityOutbox } from "./domain/sbc/activity-reporter";

const runtimeState = new RuntimeState();
const fcxSettingsStore = new SettingsStore(window.localStorage);
const fcxSbcCache = new SbcSessionCache();
const fcxInventoryCache = new InventorySessionCache();
const fcxAutoSbcSessionSnapshot = new AutoSbcSessionSnapshotStore();
const fcxRoutineStore = new RoutineStore(window.localStorage);
const fcxRoutineCatalogController = new RoutineCatalogUpdateController(
  GM_xmlhttpRequest,
  fcxRoutineStore
);
const fcxSpecialFallbackStore = new SpecialFallbackStore(window.localStorage);
const fcxStorageOverflowFallbackStore = new StorageOverflowFallbackStore(
  window.localStorage
);
const fcxAcademyPreferences = new AcademyPreferencesStore(window.localStorage);
const fcxTaskHistoryStore = new TaskHistoryStore(window.indexedDB);
const fcxTaskShield = new EaTaskShieldController(window);
const fcxSbcEaRequestGate = new EaRequestGate(900, [3000, 8000, 20000]);
const fcxSbcActivityOutbox = new SbcActivityOutbox(window.localStorage);
let lastEaSbcSets = [];
const flushPendingSbcActivity = () => {
  if (!fcxSbcActivityOutbox.hasPending()) return;
  void fcxSbcActivityOutbox.flush(getSettings(0, 0, "backendPort"));
};
const startSbcActivitySync = () => {
  flushPendingSbcActivity();
  window.setInterval(() => {
    const visibleCount = readVisibleDailySbcCount(document);
    if (visibleCount !== undefined) {
      fcxSbcActivityOutbox.saveEaSnapshot(
        createEaSbcCompletionSnapshot(lastEaSbcSets, new Date().toISOString(), visibleCount)
      );
    }
    flushPendingSbcActivity();
  }, 15_000);
};
const syncEaSbcCompletionSnapshot = (sets) => {
  lastEaSbcSets = Array.isArray(sets) ? sets : [];
  fcxSbcActivityOutbox.saveEaSnapshot(
    createEaSbcCompletionSnapshot(
      lastEaSbcSets,
      new Date().toISOString(),
      readVisibleDailySbcCount(document)
    )
  );
  flushPendingSbcActivity();
};
const reportConfirmedSbcActivity = (eventType, setId, setName) => {
  const event = createSbcActivityEvent(eventType, setId, setName);
  fcxSbcActivityOutbox.enqueue(event);
  flushPendingSbcActivity();
};
const reportLocalClientDiagnostic = (code, message) => {
  const backendPort = normalizeBackendPort(getSettings(0, 0, "backendPort"));
  void fetch(localBackendUrl(backendPort, "/diagnostics/client-event"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, message: String(message || "未知错误").slice(0, 1000) }),
  }).catch(() => {});
};
const executeFcxEaRequest = (factory, label, options = {}) => {
  const config = normalizeEaRequestRetryConfig({
    maxAttempts: fcxSettingsStore.getValue(0, 0, "eaRequestMaxAttempts"),
    retryDelaySeconds: fcxSettingsStore.getValue(0, 0, "eaRequestRetryDelaySeconds"),
    timeoutMs: options.timeoutMs,
  });
  const isSbcRequest = options.scope === "SBC" && options.useSbcRequestGate !== false;
  return executeEaRequest(factory, {
    label,
    maxAttempts: options.maxAttempts ?? (isSbcRequest ? 4 : config.maxAttempts),
    retryDelayMs: options.retryDelayMs ?? config.retryDelayMs,
    retryDelayScheduleMs: options.retryDelayScheduleMs
      ?? (isSbcRequest ? [1000, 2000, 4000] : undefined),
    timeoutMs: config.timeoutMs,
    isCancelled: options.ignoreCancellation
      ? undefined
      : () => typeof isTaskCancellationRequested === "function" && isTaskCancellationRequested(),
    verifyAfterFailure: options.verifyAfterFailure,
    requestGate: isSbcRequest ? fcxSbcEaRequestGate : undefined,
    retryThrottle: options.retryThrottle ?? isSbcRequest,
    retryUnauthorized: options.retryUnauthorized ?? isSbcRequest,
    resetThrottleOnSuccess: options.resetThrottleOnSuccess,
    onRetry: (event) => {
      const seconds = Math.max(1, Math.round(event.retryDelayMs / 1000));
      const message = event.kind === "throttle"
        ? "EA请求受到限流：" + label + "，共享冷却" + seconds
          + "秒后进行第" + event.nextAttempt + "/" + event.maxAttempts + "次尝试。"
        : "EA请求失败：" + label + "，" + seconds
          + "秒后进行第" + event.nextAttempt + "/" + event.maxAttempts + "次尝试。";
      console.warn("[FCX][EA] retry scheduled", {
        operation: label,
        status: event.status,
        attempt: event.attempt,
        nextAttempt: event.nextAttempt,
        maxAttempts: event.maxAttempts,
        retryDelayMs: event.retryDelayMs,
        kind: event.kind,
      });
      reportOperationStatus(options.scope || "SBC", message, "info");
    },
  });
};
const harvestMoment = new HarvestMomentController(createGmValueAdapter(), GM_xmlhttpRequest);
const scriptRuntimeLogs = new ScriptRuntimeLogBuffer();
const buildRemoteCatalog = async () => {
  const catalog = await sbcSets();
  const setNames = new Map((catalog?.sets || []).map((set) => [Number(set.id), String(set.name || set.id)]));
  const sbcs = [];
  for (const set of catalog?.sets || []) {
    let response = { challenges: [] };
    try {
      response = await getChallenges(set);
    } catch (error) {
      console.warn("[FCX][Remote] challenge catalog unavailable", {
        setId: Number(set.id),
        error,
      });
    }
    const repeatability = getSbcRepeatability(set);
    sbcs.push({
      set_id: Number(set.id),
      name: String(set.name || set.id),
      completed_count: Number(set.timesCompleted || 0),
      repeats_remaining: repeatability.kind === "unlimited" ? -1 : repeatability.remaining,
      challenges: (response?.challenges || []).map((challenge) => ({
        challenge_id: Number(challenge.id),
        name: String(challenge.name || challenge.id),
        requirements: (challenge.constraints || []).slice(0, 64).map((constraint) =>
          String(constraint.description || constraint.name || constraint.requirementKey || "挑战要求")
        ),
        completed: String(challenge.status || "").toUpperCase() === "COMPLETED",
      })),
    });
  }
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    sbcs,
    routines: fcxRoutineStore.list().map((routine) => ({
      routine_id: routine.id,
      name: routine.name,
      mode: routine.mode === "round_robin" ? "round_robin" : "segmented",
      steps: routine.steps.map((step) =>
        step.kind === "pack"
          ? "开包：" + (step.packName || "卡包 #" + step.packId) + " "
            + (step.runs === -1 ? "全部" : "×" + step.runs)
          : (setNames.get(Number(step.setId)) || "SBC #" + step.setId) + " "
            + (step.runs === -1 ? "持续" : "×" + step.runs)
      ),
    })),
  };
};
const fcxRemoteControl = new RemoteControlClient({
  getBackendPort: () => normalizeBackendPort(getSettings(0, 0, "backendPort")),
  getRuntimeState: () => {
    const routine = runtimeState.activeRoutineExecution;
    const routineDefinition = routine
      ? fcxRoutineStore.get(routine.routineId)
      : undefined;
    const routineStep = routineDefinition?.steps?.[Number(routine?.stepIndex || 0)];
    const sbc = runtimeState.activeSbcExecution;
    return {
      eaReady: typeof services !== "undefined" && areEaWebAppServicesReady(services),
      busy: hasBlockingFcxTask(),
      ...(routine ? {
        taskKind: "routine",
        taskName: routineDefinition?.name || routine.routineId,
        stage: routineStep?.kind === "pack"
          ? "正在开包：" + (routineStep.packName || "卡包 #" + routineStep.packId)
          : "正在执行 SBC 步骤 " + (Number(routine.stepIndex || 0) + 1),
        round: Number(routine.cycle || 0) + 1,
        ...(routine.totalCycles > 0 && routineDefinition?.steps?.length ? {
          progress: Math.min(
            100,
            Math.round(
              ((Number(routine.cycle || 0) * routineDefinition.steps.length
                + Number(routine.stepIndex || 0))
                / (routine.totalCycles * routineDefinition.steps.length))
              * 100
            ),
          ),
        } : {}),
      } : sbc ? {
        taskKind: "sbc",
        taskName: "SBC 任务",
        stage: sbc.orchestrating ? "正在执行整组 SBC" : "正在执行挑战",
        ...(sbc.awaitingPriceConfirmation ? { stage: "等待网页确认价格规则" } : {}),
        round: Number(sbc.completedRuns || 0),
        progress: sbc.totalChallenges
          ? Math.round((Number(sbc.currentChallengeIndex || 0) / Number(sbc.totalChallenges)) * 100)
          : 0,
      } : runtimeState.packRunActive ? {
        taskKind: "pack",
        taskName: "卡包处理",
        stage: "正在处理卡包与未分配物品",
      } : runtimeState.academyRunActive ? {
        taskKind: "evolution",
        taskName: "PlayStyle 学院",
        stage: "正在应用球员进化",
      } : {}),
    };
  },
  startSbc: async (payload) => {
    if (hasBlockingFcxTask()) throw new Error("当前 FCX 任务尚未结束");
    resetTaskCancellation();
    const options = {
      ignoreValue: payload.ignore_value,
      requestedRuns: payload.runs,
      submitStrategy: payload.submit_strategy,
      autoOpenRewards: payload.auto_open_packs,
    };
    const execution = createSbcExecutionContext(options);
    if (payload.mode === "set") {
      const result = await solveSbcSet(
        payload.set_id,
        payload.submit_strategy !== "never",
        payload.auto_open_packs,
        options,
        execution
      );
      if (result?.stoppedReason) throw new Error(result.stoppedReason);
      return result;
    }
    const result = await solveSBC(
      payload.set_id,
      payload.challenge_id,
      payload.submit_strategy !== "never",
      null,
      payload.auto_open_packs,
      false,
      options,
      execution
    );
    if (execution.stoppedReason) throw new Error(execution.stoppedReason);
    return result;
  },
  startRoutine: async (payload) => {
    const routine = fcxRoutineStore.get(payload.routine_id);
    if (!routine) throw new Error("脚本中找不到指定的永动机流程");
    return runFcxRoutine(routine);
  },
  stopTask: () => requestTaskCancellation(),
  refreshCatalog: async () => { await refreshSbcCache(); },
  reloadPage: () => window.location.reload(),
  buildCatalog: buildRemoteCatalog,
  isCancellationRequested: () => isTaskCancellationRequested(),
}, GM_xmlhttpRequest);
harvestMoment.setUploader((record) => fcxRemoteControl.uploadHarvest(record));
scriptRuntimeLogs.setUploader((records) => fcxRemoteControl.uploadLogs(records));
class FcxBackendUpgradeRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = "FcxBackendUpgradeRequiredError";
  }
}

const assertMinimumRatingBackend = async (backendPort, input) => {
  let payload;
  try {
    payload = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return;
  }
  if (!requiresMinimumRatingFirst(payload?.sbcData?.constraints || [])) return;

  const healthText = await requestTextWithRetry(
    localBackendUrl(backendPort, "/health"),
    GM_xmlhttpRequest,
    { retries: 0 }
  );
  let health;
  try {
    health = JSON.parse(healthText);
  } catch {
    throw new FcxBackendUpgradeRequiredError(
      "FCX 后端健康检查响应无效，请更新 FCX 后端 EXE。"
    );
  }
  if (!supportsMinimumRatingFirst(health)) {
    throw new FcxBackendUpgradeRequiredError(
      "当前 FCX 后端不支持最低评分优先，请更新 FCX 后端 EXE。"
    );
  }
};

const requestSbcSolution = async (input, timeoutMs) => {
  const backendPort = normalizeBackendPort(getSettings(0, 0, "backendPort"));
  const solveUrl = localBackendUrl(backendPort, "/solve");
  try {
    await assertMinimumRatingBackend(backendPort, input);
    return await makePostRequest(solveUrl, input, timeoutMs);
  } catch (error) {
    if (error instanceof FcxBackendUpgradeRequiredError) throw error;
    const status = error instanceof HttpRequestError ? error.status : Number(error?.status || 0);
    if (!status || error instanceof TypeError) {
      throw new Error("请先启动 FCX 本地后端（127.0.0.1:" + backendPort + "），并确认 EXE 与用户脚本端口一致");
    }
    throw error;
  }
};
${body}
`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const scriptMetadata = createScriptMetadata(mode);
  const userscriptHeader = createUserscriptHeader(scriptMetadata);
  return {
  define: {
    __FCX_SCRIPT_VERSION__: JSON.stringify(scriptMetadata.version),
    __FCX_UPDATE_MANIFEST_URL__: JSON.stringify(
      scriptMetadata.updateManifestURL,
    ),
    __FCX_UPDATE_HOMEPAGE_URL__: JSON.stringify(scriptMetadata.homepageURL),
    __FCX_AUTO_UPDATE_CHECK__: JSON.stringify(
      scriptMetadata.autoUpdateCheck,
    ),
  },
  plugins: [
    orderedRuntime(),
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: scriptMetadata.name,
        namespace: scriptMetadata.namespace,
        version: scriptMetadata.version,
        description: scriptMetadata.description,
        author: scriptMetadata.author,
        license: scriptMetadata.license,
        homepageURL: scriptMetadata.homepageURL,
        icon: scriptMetadata.icon,
        icon64: scriptMetadata.icon,
        match: [
          "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*",
          "https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*",
          "https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app/*",
        ],
        grant: [
          "GM_xmlhttpRequest",
          "GM_addStyle",
          "GM_getValue",
          "GM_setValue",
          "GM_deleteValue",
          "unsafeWindow",
        ],
        connect: scriptMetadata.connectHosts,
      },
      generate: () => userscriptHeader,
      server: {
        open: false,
      },
      build: {
        fileName: scriptMetadata.fileName,
        autoGrant: false,
        metaFileName: false,
      },
    }),
  ],
  build: {
    target: "es2022",
    minify: false,
    sourcemap: false,
    outDir: scriptMetadata.outDir,
    emptyOutDir: mode !== "greasyfork",
  },
  };
});
