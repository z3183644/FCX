// @ts-nocheck
// FCX compatibility runtime for the EA Web App.

const readPackRunOptions = () => ({
  autoPick: getSettings(0, 0, "packAutoPick") !== false,
  pickStrategy:
    getSettings(0, 0, "packPickStrategy") === "price" ? "price" : "ovr",
  quickSellDuplicates:
    getSettings(0, 0, "packQuickSellDuplicates") === true,
  quickSellUnder: Math.max(
    0,
    Math.min(
      99,
      Number(
        getSettings(0, 0, "packQuickSellUnder")
          ?? defaultSolverSettings.packQuickSellUnder
      )
    )
  ),
  skipAnimation: getSettings(0, 0, "packSkipAnimation") === true,
});

const savePackRunOptions = (options) => {
  saveSettings(0, 0, "packAutoPick", options.autoPick);
  saveSettings(0, 0, "packPickStrategy", options.pickStrategy);
  saveSettings(
    0,
    0,
    "packQuickSellDuplicates",
    options.quickSellDuplicates
  );
  saveSettings(0, 0, "packQuickSellUnder", options.quickSellUnder);
  saveSettings(0, 0, "packSkipAnimation", options.skipAnimation);
};

const emptyRoutingResult = () => ({
  movedToClub: 0,
  movedToStorage: 0,
  movedToTransferList: 0,
  discarded: 0,
  redeemed: 0,
  playerPicks: 0,
  remaining: 0,
  blockedStorage: 0,
  blockedTransfer: 0,
  blockedOther: 0,
  stopped: false,
});

const mergeRoutingResult = (target, source) => ({
  movedToClub: target.movedToClub + Number(source?.movedToClub || 0),
  movedToStorage: target.movedToStorage + Number(source?.movedToStorage || 0),
  movedToTransferList:
    target.movedToTransferList + Number(source?.movedToTransferList || 0),
  discarded: target.discarded + Number(source?.discarded || 0),
  redeemed: target.redeemed + Number(source?.redeemed || 0),
  playerPicks: target.playerPicks + Number(source?.playerPicks || 0),
  remaining: Number(source?.remaining || 0),
  blockedStorage:
    target.blockedStorage + Number(source?.blockedStorage || 0),
  blockedTransfer:
    target.blockedTransfer + Number(source?.blockedTransfer || 0),
  blockedOther: target.blockedOther + Number(source?.blockedOther || 0),
  stopped: target.stopped || Boolean(source?.stopped),
  stopCode: source?.stopCode || target.stopCode,
  reason: source?.reason || target.reason,
});

const toPackPlayerSummary = (item, source, destination = "unknown") => ({
  instanceId: Number(item?.id || 0),
  definitionId: Number(item?.definitionId || 0),
  name: getPlayerName(item),
  rating: Number(item?.rating || item?._staticData?.rating || 0),
  rarity:
    services.Localization?.localize?.("item.raretype" + item?.rareflag) ||
    String(item?.rareflag || "未知"),
  special: Boolean(item?.isSpecial?.()),
  evolution: isEvolutionPlayer(item),
  tradeable: Boolean(item?.isTradeable?.()),
  duplicate: Number(item?.duplicateId || 0) > 0,
  source,
  destination,
});

const showPackTaskSummary = (summary, options = {}) => {
  if (Number(runtimeState.taskOverlayHolds || 0) > 0) {
    console.info("[FCX][Summary] 父任务仍在运行，已阻止内部子任务提前展示总结", {
      holds: runtimeState.taskOverlayHolds,
      packsOpened: Number(summary?.packsOpened || 0),
      submissions: Number(summary?.sbcSubmissions?.length || 0),
    });
    return false;
  }
  refreshPackDestinationCounts(summary);
  openPackTaskSummaryDialog(summary, {
    getPrice: (definitionId) =>
      options.ignoreValue ? undefined : Number(getPrice({ definitionId })) || undefined,
    requestPrices: async (definitionIds) => {
      if (options.ignoreValue) return;
      const players = summary.players
        .filter((player) => definitionIds.includes(player.definitionId))
        .map((player) => ({
          definitionId: player.definitionId,
          rating: player.rating,
          name: player.name,
          _staticData: { name: player.name, rating: player.rating },
        }));
      await fetchPlayerPrices(players);
    },
    pricesEnabled: options.ignoreValue !== true,
  });
  return true;
};

const waitExactMs = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

const PACK_OPEN_SUCCESS_INTERVAL_MS = 800;

const invokePlayerPickOperation = async (factory, timeoutMs = 0, requestOptions = {}) => {
  const startedAt = Date.now();
  try {
    const raw = await executeFcxEaRequest(factory, requestOptions.label || "处理球员挑选", {
      scope: "Pack",
      timeoutMs: timeoutMs || 15000,
      verifyAfterFailure: requestOptions.verifyAfterFailure,
    });
    return {
      ok: raw?.success !== false,
      status: raw?.status,
      raw,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.status ?? (error?.phase === "timeout" ? "timeout" : "exception"),
      raw: undefined,
      error,
      elapsedMs: Date.now() - startedAt,
    };
  }
};

const readUnassignedRepositoryItems = (response) => {
  const repository = repositories.Item;
  const candidates = [
    repository.getUnassignedItems?.(),
    repository.unassigned?.items,
    response?.response?.items,
    response?.items,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return [...candidate];
  }
  return [];
};

const requestPlayerPickUnassigned = async (attempt) => {
  reportOperationStatus("Pick", `正在读取第 ${attempt} 轮未分配物品`);
  repositories.Store.setDirty();
  repositories.Item.unassigned?.clear?.();
  repositories.Item.unassigned?.reset?.();
  const result = await invokePlayerPickOperation(
    () => services.Item.requestUnassignedItems(),
    PLAYER_PICK_UNASSIGNED_TIMEOUT_MS,
    { label: "读取未分配球员挑选" }
  );
  await waitExactMs(PLAYER_PICK_REPOSITORY_WAIT_MS);
  const items = readUnassignedRepositoryItems(result.raw);
  console.info("[FCX][Pick] 未分配读取完成", {
    attempt,
    elapsedMs: result.elapsedMs,
    success: result.ok,
    status: result.status,
    error: result.error,
    itemCount: items.length,
    pickCount: items.filter((item) => item.isPlayerPickItem?.()).length,
  });
  return { ...result, items };
};

const requestPendingPlayerPick = async () => {
  console.info("[FCX][Pick] 正在检查已打开但尚未确认的挑选");
  const result = await invokePlayerPickOperation(
    () => services.Item.requestPendingPlayerPickItemSelection(),
    15000,
    { label: "读取待确认球员挑选" }
  );
  const payload = result.ok ? normalizePlayerPickPayload(result.raw) : null;
  console.info("[FCX][Pick] 待确认挑选检查完成", {
    elapsedMs: result.elapsedMs,
    success: result.ok,
    status: result.status,
    error: result.error,
    candidateCount: payload?.items?.length || 0,
    availablePicks: payload?.availablePicks || 0,
  });
  return { ...result, payload };
};

const isDuplicatePlayerPickCandidate = (item, index, payload) => {
  const owned = Array.isArray(payload?.ownership) ? payload.ownership[index] : undefined;
  if (owned != null) return Boolean(owned);
  try {
    if (item?.isDuplicate?.() === true) return true;
  } catch (_error) {
    // Fall through to the stable duplicate identifier.
  }
  return Number(item?.duplicateId || 0) > 0;
};

const chooseAutomaticPlayerPickItems = async (payload, options) => {
  const priceMap = new Map();
  if (options.pickStrategy === "price") {
    try {
      await fetchPlayerPrices(payload.items.filter((item) => item.isPlayer?.()));
      for (const item of payload.items) {
        const price = Number(getPrice(item) || 0);
        if (price > 0) priceMap.set(Number(item.definitionId || 0), price);
      }
    } catch (error) {
      console.warn("[FCX][Pick] 价格读取失败，本次自动改按总评选择", error);
    }
  }
  return choosePlayerPickCandidates(
    payload,
    options.pickStrategy,
    (item, index) => ({
      rating: Number(item?.rating || item?._staticData?.rating || 0),
      definitionId: Number(item?.definitionId || 0),
      duplicate: isDuplicatePlayerPickCandidate(item, index, payload),
    }),
    priceMap
  );
};

let playerPickTaskSequence = 0;

const pendingTrackedPlayerPickIds = (rewardPlan) =>
  Object.entries(rewardPlan?.playerPickExpectedById || {})
    .filter(([id, expected]) =>
      Number(rewardPlan.processedPlayerPickById?.[Number(id)] || 0)
        < Number(expected || 0)
    )
    .map(([id]) => Number(id));

const resolveTrackedPlayerPick = (rewardPlan, pick, unassigned) => {
  if (!rewardPlan || !pick) return null;
  const key = playerPickInstanceKey(pick);
  const match = selectNewPlayerPickItems(rewardPlan, unassigned).find(
    (candidate) => candidate.item === pick
      || (key && playerPickInstanceKey(candidate.item) === key)
  );
  if (match) return { ...match, kind: "reward" };
  const definitionId = playerPickDefinitionId(pick);
  if (Number(rewardPlan.playerPickBaselineById?.[definitionId] || 0) > 0) {
    return { definitionId, label: "未分配球员挑选", kind: "historical" };
  }
  if (
    definitionId > 0
    && pendingTrackedPlayerPickIds(rewardPlan).includes(definitionId)
  ) {
    return {
      definitionId,
      label: rewardPlan.playerPickLabelsById?.[definitionId] || "球员挑选奖励",
      kind: "reward",
    };
  }
  return null;
};

const resolvePendingPlayerPickTracking = (rewardPlan) => {
  if (!rewardPlan) return null;
  const baselineIds = Object.entries(rewardPlan.playerPickBaselineById || {})
    .filter(([, count]) => Number(count || 0) > 0)
    .map(([id]) => Number(id));
  if (baselineIds.length === 1) {
    return {
      definitionId: baselineIds[0],
      label: "未分配球员挑选",
      kind: "historical",
    };
  }
  return null;
};

const completePlayerPickTracking = (rewardPlan, tracking) => {
  if (!rewardPlan || !tracking) return;
  if (tracking.kind === "reward") {
    markPlayerPickProcessed(rewardPlan, tracking.definitionId);
  } else if (tracking.kind === "historical") {
    consumeHistoricalPlayerPickBaseline(rewardPlan, {
      definitionId: tracking.definitionId,
    });
  }
};

const recordConfirmedPlayerPick = ({
  payload,
  chosen,
  taskSummary,
  source,
  taskId,
  pickSequence,
}) => {
  let selections = [];
  taskSummary.picksCompleted += 1;
  try {
    selections = confirmedPlayerPickSelections(
      payload,
      chosen,
      (item) => {
        try {
          return Number(item?.duplicateId || 0) > 0 || item?.isDuplicate?.() === true;
        } catch (_error) {
          return Number(item?.duplicateId || 0) > 0;
        }
      }
    );
    addPackPlayers(
      taskSummary,
      selections.map(({ item, duplicate }, candidateIndex) => ({
        ...toPackPlayerSummary(item, source, "unknown"),
        summaryKey: `pick:${taskId}:${pickSequence}:${candidateIndex}:${Number(item?.definitionId || 0)}`,
        duplicate,
      }))
    );
  } catch (error) {
    console.warn("[FCX][Pick] 挑选结果写入总结失败，不影响后续挑选", error);
    selections = chosen.map((item) => ({
      item,
      duplicate: Number(item?.duplicateId || 0) > 0,
    }));
  }
  const harvestItems = selections
    .filter(({ duplicate }) => !duplicate)
    .map(({ item }) => ({
      id: Number(item?.id || 0),
      definitionId: Number(item?.definitionId || 0),
      rating: Number(item?.rating || item?._staticData?.rating || 0),
      duplicateId: 0,
      name: item?.name,
      _staticData: item?._staticData,
      isPlayer: () => true,
    }));
  if (harvestItems.length) {
    Promise.resolve().then(() => {
      try {
        harvestMoment.captureItems(harvestItems, source);
      } catch (error) {
        console.warn("[FCX][Pick] 收菜记录处理失败，不影响后续挑选", error);
      }
    });
  }
  return selections.length;
};

const confirmAutomaticPlayerPick = async ({
  payload,
  options,
  taskSummary,
  source,
  taskId,
  pickSequence,
}) => {
  if (!options.autoPick) {
    return {
      success: false,
      stopped: true,
      reason: "检测到球员挑选；自动球员挑选已关闭，已停在未分配页面。",
      candidates: payload.items,
      availablePicks: payload.availablePicks,
      ownership: payload.ownership,
      confirmationSucceeded: false,
      selectedItems: [],
    };
  }
  const chosen = await chooseAutomaticPlayerPickItems(payload, options);
  if (!chosen.length) {
    return {
      success: false,
      stopped: true,
      reason: "球员挑选没有可选择的球员。",
      candidates: payload.items,
      availablePicks: payload.availablePicks,
      ownership: payload.ownership,
      confirmationSucceeded: false,
      selectedItems: [],
    };
  }
  reportOperationStatus("Pick", `正在确认第 ${pickSequence} 个球员挑选`);
  console.info("[FCX][Pick] 已生成选择", {
    pickSequence,
    candidateCount: payload.items.length,
    availablePicks: payload.availablePicks,
    selected: chosen.map((item) => ({
      definitionId: Number(item?.definitionId || 0),
      rating: Number(item?.rating || item?._staticData?.rating || 0),
    })),
  });
  const confirmation = await invokePlayerPickOperation(
    () => services.Item.confirmPlayerPickItemSelection(chosen),
    15000,
    {
      label: "确认球员挑选",
      verifyAfterFailure: async () => {
        try {
          const pending = await executeFcxEaRequest(
            () => services.Item.requestPendingPlayerPickItemSelection(),
            "核验球员挑选状态",
            { scope: "Pack", ignoreCancellation: true }
          );
          const normalized = normalizePlayerPickPayload(pending);
          if (!normalized?.items?.length) {
            return { state: "applied", value: { success: true, status: 200 } };
          }
          const pendingIds = new Set(normalized.items.map((item) => Number(item?.id || item?.definitionId)));
          const chosenStillPending = chosen.some((item) =>
            pendingIds.has(Number(item?.id || item?.definitionId))
          );
          return chosenStillPending
            ? { state: "not_applied" }
            : { state: "unknown", reason: "球员挑选状态已变化，为避免重复确认未自动重试" };
        } catch (error) {
          return { state: "unknown", reason: `球员挑选状态核验失败：${error?.message || error}` };
        }
      },
    }
  );
  console.info("[FCX][Pick] EA 确认已返回", {
    pickSequence,
    elapsedMs: confirmation.elapsedMs,
    success: confirmation.ok,
    status: confirmation.status,
    error: confirmation.error,
  });
  if (!confirmation.ok) {
    return {
      success: false,
      stopped: true,
      reason: playerPickFailureMessage("confirm", confirmation.status),
      candidates: payload.items,
      availablePicks: payload.availablePicks,
      ownership: payload.ownership,
      confirmationSucceeded: false,
      selectedItems: chosen,
    };
  }
  const selected = recordConfirmedPlayerPick({
    payload,
    chosen,
    taskSummary,
    source,
    taskId,
    pickSequence,
  });
  reportOperationStatus("Pick", `第 ${pickSequence} 个球员挑选已完成`, "success");
  await waitExactMs(PLAYER_PICK_CONFIRM_WAIT_MS);
  return {
    success: true,
    selected,
    stopped: false,
    candidates: payload.items,
    availablePicks: payload.availablePicks,
    ownership: payload.ownership,
    confirmationSucceeded: true,
    selectedItems: chosen,
  };
};

const routePlayerPickResults = async (options, taskSummary) => {
  let aggregate = emptyRoutingResult();
  for (let pass = 1; pass <= PLAYER_PICK_ROUTING_PASSES; pass += 1) {
    if (isTaskCancellationRequested()) {
      aggregate.stopped = true;
      aggregate.reason = "球员挑选任务已取消。";
      return aggregate;
    }
    reportOperationStatus("Pick", `正在分配球员挑选结果（${pass}/${PLAYER_PICK_ROUTING_PASSES}）`);
    const routing = await routeUnassignedItems(options, taskSummary);
    aggregate = mergeRoutingResult(aggregate, routing);
    console.info("[FCX][Pick] 未分配物品分配结果", { pass, ...routing });
    if (routing.stopped || routing.remaining <= 0) return aggregate;
    if (pass < PLAYER_PICK_ROUTING_PASSES) {
      await waitExactMs(PLAYER_PICK_ROUTING_WAIT_MS);
    }
  }
  aggregate.stopped = aggregate.remaining > 0;
  if (aggregate.stopped && !aggregate.reason) {
    aggregate.reason = "仍有物品无法分配，已保留在未分配页面。";
  }
  return aggregate;
};

const runAutomaticPlayerPicks = async ({
  options,
  taskSummary,
  rewardPlan = undefined,
  waitForTrackedRewards = false,
}) => {
  playerPickTaskSequence += 1;
  const taskId = `fcx-pick-${Date.now()}-${playerPickTaskSequence}`;
  let selected = 0;
  let confirmedPicks = 0;
  let stopped = false;
  let reason;
  let rewardWaits = 0;

  const pending = await requestPendingPlayerPick();
  if (pending.payload) {
    if (!options.autoPick) {
      stopped = true;
      reason = "检测到球员挑选；自动球员挑选已关闭，已停在未分配页面。";
    } else {
      const tracking = resolvePendingPlayerPickTracking(rewardPlan);
      const pendingResult = await confirmAutomaticPlayerPick({
        payload: pending.payload,
        options,
        taskSummary,
        source: tracking?.label || "未分配球员挑选",
        taskId,
        pickSequence: confirmedPicks + 1,
      });
      if (!pendingResult.success) {
        stopped = true;
        reason = pendingResult.reason;
      } else {
        confirmedPicks += 1;
        selected += pendingResult.selected;
        completePlayerPickTracking(rewardPlan, tracking);
      }
    }
  } else if (!pending.ok) {
    console.warn("[FCX][Pick] 待读取失败，继续检查未分配物品", {
      status: pending.status,
      error: pending.error,
    });
  }

  let attempt = 1;
  for (; !stopped && attempt <= PLAYER_PICK_MAX_ATTEMPTS; attempt += 1) {
    if (isTaskCancellationRequested()) {
      stopped = true;
      reason = "球员挑选任务已取消。";
      break;
    }
    const unassigned = await requestPlayerPickUnassigned(attempt);
    if (!unassigned.ok) {
      stopped = true;
      reason = playerPickFailureMessage("unassigned", unassigned.status);
      break;
    }
    const pick = unassigned.items.find((item) => item.isPlayerPickItem?.());
    if (!pick) {
      if (
        waitForTrackedRewards
        && hasPendingTrackedPlayerPicks(rewardPlan)
        && rewardWaits < PLAYER_PICK_REWARD_ATTEMPTS
      ) {
        rewardWaits += 1;
        reportOperationStatus(
          "Pick",
          `正在等待本次球员挑选奖励到账（${rewardWaits}/${PLAYER_PICK_REWARD_ATTEMPTS}）`
        );
        await waitExactMs(PLAYER_PICK_REWARD_WAIT_MS);
        continue;
      }
      if (waitForTrackedRewards && hasPendingTrackedPlayerPicks(rewardPlan)) {
        stopped = true;
        reason = "本次球员挑选奖励等待超时，任务已安全停止。";
      }
      break;
    }
    if (!options.autoPick) {
      stopped = true;
      reason = "检测到球员挑选；自动球员挑选已关闭，已停在未分配页面。";
      break;
    }

    const tracking = resolveTrackedPlayerPick(rewardPlan, pick, unassigned.items);
    const source = tracking?.label || "未分配球员挑选";
    reportOperationStatus("Pick", `正在打开第 ${confirmedPicks + 1} 个球员挑选`);
    const pickInstanceId = Number(pick?.id || 0);
    const opened = await invokePlayerPickOperation(
      () => services.Item.redeem(pick),
      15000,
      {
        label: "打开球员挑选",
        verifyAfterFailure: async () => {
          try {
            const pending = await executeFcxEaRequest(
              () => services.Item.requestPendingPlayerPickItemSelection(),
              "核验球员挑选打开状态",
              { scope: "Pack", ignoreCancellation: true }
            );
            if (normalizePlayerPickPayload(pending)?.items?.length) {
              return { state: "applied", value: pending };
            }
            const current = await fetchUnassigned();
            if (current.some((item) => Number(item?.id || 0) === pickInstanceId)) {
              return { state: "not_applied" };
            }
            return { state: "unknown", reason: "球员挑选打开结果无法确认，为避免重复操作未自动重试" };
          } catch (error) {
            return { state: "unknown", reason: `球员挑选状态核验失败：${error?.message || error}` };
          }
        },
      }
    );
    const payload = opened.ok ? normalizePlayerPickPayload(opened.raw) : null;
    console.info("[FCX][Pick] 球员挑选打开结果", {
      attempt,
      elapsedMs: opened.elapsedMs,
      success: opened.ok,
      status: opened.status,
      error: opened.error,
      definitionId: playerPickDefinitionId(pick),
      candidateCount: payload?.items?.length || 0,
      availablePicks: payload?.availablePicks || 0,
      source,
    });
    if (!opened.ok) {
      stopped = true;
      reason = playerPickFailureMessage("open", opened.status);
      break;
    }
    if (!payload) {
      stopped = true;
      reason = "球员挑选打开后没有返回候选球员，任务已安全停止。";
      break;
    }

    const confirmed = await confirmAutomaticPlayerPick({
      payload,
      options,
      taskSummary,
      source,
      taskId,
      pickSequence: confirmedPicks + 1,
    });
    if (!confirmed.success) {
      stopped = true;
      reason = confirmed.reason;
      break;
    }
    confirmedPicks += 1;
    selected += confirmed.selected;
    completePlayerPickTracking(rewardPlan, tracking);
  }

  if (!stopped && attempt > PLAYER_PICK_MAX_ATTEMPTS) {
    stopped = true;
    reason = `单次任务最多尝试 ${PLAYER_PICK_MAX_ATTEMPTS} 轮球员挑选，已安全停止。`;
  }

  let routing = emptyRoutingResult();
  if (confirmedPicks > 0 && !isTaskCancellationRequested()) {
    routing = await routePlayerPickResults(options, taskSummary);
    if (routing.stopped && !reason) {
      stopped = true;
      reason = routing.reason;
    }
  }
  if (stopped && reason) {
    console.warn("[FCX][Pick] 自动球员挑选已停止", {
      confirmedPicks,
      selected,
      reason,
    });
  } else {
    console.info("[FCX][Pick] 自动球员挑选完成", {
      confirmedPicks,
      selected,
    });
  }
  return { selected, confirmedPicks, stopped, reason, routing };
};

const FCX_MANUAL_PICK_BUTTON_ID = "fcx-manual-auto-pick";
let manualPlayerPickObserver;
let manualPlayerPickSyncQueued = false;

const hasUnassignedPlayerPick = () =>
  readUnassignedRepositoryItems().some((item) => item?.isPlayerPickItem?.());

const findUnassignedHeaderActions = () => {
  const unassigned = document.querySelector(".ut-unassigned-view");
  if (!unassigned) return null;
  const scopedHeaders = [...unassigned.querySelectorAll(".ut-section-header-view")];
  const headers = scopedHeaders.length
    ? scopedHeaders
    : [...document.querySelectorAll(".ut-section-header-view")];
  const header = headers.find((candidate) => candidate.querySelector(".ellipsis-btn"));
  const ellipsis = header?.querySelector(".ellipsis-btn");
  return ellipsis?.parentElement || header || null;
};

const runManualAutomaticPlayerPicks = async (button) => {
  if (button.disabled) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "正在挑选…";
  try {
    const options = {
      ...readPackRunOptions(),
      autoPick: true,
    };
    const result = await runPackSelections([], options);
    if (result.stopped && result.reason) {
      queueFcxNotification([result.reason, UINotificationType.NEGATIVE]);
    } else if (Number(result.selected || 0) > 0) {
      queueFcxNotification([
        `自动挑选完成，共选择 ${Number(result.selected)} 名球员。`,
        UINotificationType.POSITIVE,
      ]);
    } else {
      queueFcxNotification([
        "没有可处理的球员挑选。",
        UINotificationType.NEUTRAL,
      ]);
    }
  } catch (error) {
    const reason = String(error?.message || error || "自动挑选失败。");
    console.error("[FCX][Pick] 手动自动挑选失败", error);
    queueFcxNotification([reason, UINotificationType.NEGATIVE]);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
    scheduleManualPlayerPickButtonSync();
  }
};

const syncManualPlayerPickButton = () => {
  const existing = document.getElementById(FCX_MANUAL_PICK_BUTTON_ID);
  const actions = findUnassignedHeaderActions();
  if (!actions || !hasUnassignedPlayerPick()) {
    existing?.remove();
    return;
  }
  if (existing?.parentElement === actions) return;
  existing?.remove();

  const button = document.createElement("button");
  button.id = FCX_MANUAL_PICK_BUTTON_ID;
  button.type = "button";
  button.className = "btn-standard section-header-btn mini fcx-manual-auto-pick";
  button.textContent = "自动挑选";
  button.setAttribute("aria-label", "自动处理全部未分配球员挑选");
  button.addEventListener("click", () => void runManualAutomaticPlayerPicks(button));

  const ellipsis = actions.querySelector(".ellipsis-btn");
  if (ellipsis) actions.insertBefore(button, ellipsis);
  else actions.appendChild(button);
};

const scheduleManualPlayerPickButtonSync = () => {
  if (manualPlayerPickSyncQueued) return;
  manualPlayerPickSyncQueued = true;
  const schedule = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (callback) => setTimeout(callback, 0);
  schedule(() => {
    manualPlayerPickSyncQueued = false;
    syncManualPlayerPickButton();
  });
};

const installManualPlayerPickAction = () => {
  if (manualPlayerPickObserver) return;
  if (!document.body) {
    setTimeout(installManualPlayerPickAction, 250);
    return;
  }
  manualPlayerPickObserver = new MutationObserver(scheduleManualPlayerPickButtonSync);
  manualPlayerPickObserver.observe(document.body, { childList: true, subtree: true });
  scheduleManualPlayerPickButtonSync();
};

const hasPendingTrackedPlayerPicks = (rewardPlan) =>
  Object.entries(rewardPlan.playerPickExpectedById || {}).some(
    ([id, expected]) =>
      Number(rewardPlan.processedPlayerPickById?.[Number(id)] || 0)
        < Number(expected || 0)
  );

const processTrackedSbcPlayerPicks = async (execution, options) => {
  const waitForTrackedRewards = hasPendingTrackedPlayerPicks(execution.rewardPlan);
  const result = await runAutomaticPlayerPicks({
    options,
    taskSummary: execution.packSummary,
    rewardPlan: execution.rewardPlan,
    waitForTrackedRewards,
  });
  execution.lastUnassignedRouting = result.routing;
  if (result.stopped) execution.stoppedReason = result.reason;
  return !result.stopped;
};

const processPackItems = async (
  options,
  taskSummary,
  { allowPlayerPicks = true, pendingPlayerPickDetected = false } = {}
) => {
  let aggregate = emptyRoutingResult();
  const initial = await routeUnassignedItems(options, taskSummary);
  aggregate = mergeRoutingResult(aggregate, initial);
  if (
    initial.stopped
    || (!initial.playerPicks && !pendingPlayerPickDetected)
    || !allowPlayerPicks
  ) {
    return { routing: aggregate, selected: 0 };
  }

  reportOperationStatus("Pack", "正在处理球员挑选");
  const pickResult = await runAutomaticPlayerPicks({ options, taskSummary });
  aggregate = mergeRoutingResult(aggregate, pickResult.routing);
  if (pickResult.stopped) {
    aggregate.stopped = true;
    aggregate.reason = pickResult.reason;
  }
  return { routing: aggregate, selected: pickResult.selected };
};

const processOpenedPackItems = async (pack, packPlayers, options, taskSummary) => {
  if (!packPlayers?.items) throw new Error("卡包没有返回物品列表");
  const source = services.Localization.localize(pack.packName);
  harvestMoment.captureItems(packPlayers.items, source || "卡包");
  addPackPlayers(
    taskSummary,
    packPlayers.items
      .filter((item) => item.isPlayer?.())
      .map((item) => toPackPlayerSummary(item, source))
  );
  if (
    !options.skipAnimation &&
    packPlayers.items.some(
      (item) => item.rating >= getSettings(0, 0, "animateWalkouts")
    )
  ) {
    await showPack(pack, packPlayers);
  }
  return packPlayers;
};

const packInventoryKeyMatches = (candidate, pack) =>
  Boolean(candidate?.isMyPack)
  && Number(candidate?.id) === Number(pack?.id)
  && Boolean(candidate?.tradeable) === Boolean(pack?.tradeable);

const openPackWithUnassignedRecovery = async (
  pack,
  options,
  taskSummary,
  label,
  allowPlayerPicks
) => {
  const openOnce = (requestLabel) => {
    console.info("[FCX][Pack] 正在发送开包写请求", {
      packId: Number(pack?.id || pack?.packId || 0),
      tradable: Boolean(pack?.tradeable),
      label: requestLabel,
    });
    return executeFcxEaRequest(
      () => pack.open(),
      requestLabel,
      {
        scope: "Pack",
        maxAttempts: 1,
        retryThrottle: false,
        retryUnauthorized: false,
      }
    );
  };
  try {
    return await openOnce(label);
  } catch (error) {
    if (eaResponseStatus(error) !== 471) throw error;
    console.warn("[FCX][Pack] unassigned items block pack opening; routing before one retry", {
      packId: Number(pack?.id || pack?.packId || 0),
      tradable: Boolean(pack?.tradeable),
    });
    reportOperationStatus("Pack", "未分配物品阻止开包，正在安置后重试一次", "info");
    const processed = await processPackItems(options, taskSummary, {
      allowPlayerPicks,
    });
    const routing = processed.routing;
    if (routing.stopped || routing.remaining > 0) {
      throw new Error(
        routing.reason || "未分配物品仍未处理完，已停止重试开包。"
      );
    }
    return openOnce(`${label}（安置未分配后重试）`);
  }
};

const openPackInstance = async (
  pack,
  options,
  taskSummary,
  allowPlayerPicks = true
) => {
  repositories.Store.setDirty();
  let response;
  let openedPack = pack;
  if (pack.isMyPack) {
    response = await openPackWithUnassignedRecovery(
      pack,
      options,
      taskSummary,
      "打开卡包",
      allowPlayerPicks
    );
  } else {
    const purchaseResponse = await executeFcxEaRequest(
      () => pack.purchase(GameCurrency.COINS),
      "购买卡包",
      {
        scope: "Pack",
        maxAttempts: 1,
        retryThrottle: false,
        retryUnauthorized: false,
      }
    );
    if (purchaseResponse?.response?.items) {
      response = purchaseResponse;
    } else {
      const purchasedInventory = await getPacks({
        label: "读取已购买卡包",
      });
      const ownedMatches = (purchasedInventory?.packs || []).filter(
        (candidate) => packInventoryKeyMatches(candidate, pack)
      );
      openedPack = ownedMatches[0];
      if (!openedPack) {
        throw new Error("购买请求已完成，但没有找到可打开的已购卡包。");
      }
      response = await openPackWithUnassignedRecovery(
        openedPack,
        options,
        taskSummary,
        "打开已购买卡包",
        allowPlayerPicks
      );
    }
  }
  const packPlayers = await processOpenedPackItems(openedPack, response?.response, options, taskSummary);
  return {
    packPlayers,
    pendingPlayerPick: false,
  };
};

const expandPackWorkQueue = expandPackSelections;

const readStorageCapacitySnapshot = async () => {
  const items = await getStoragePlayers();
  const pile = ItemPile.STORAGE ?? ItemPile.SBC_STORAGE ?? 10;
  const fallbackCapacity = Math.max(100, items.length);
  const capacity = Number(
    repositories.Item.getPileSize?.(pile) ?? fallbackCapacity
  );
  return {
    count: items.length,
    capacity,
    available: Math.max(0, capacity - items.length),
  };
};

const resolveExecutionStorageFallback = (execution) =>
  execution?.options?.storageFallback
  || fcxStorageOverflowFallbackStore.get();

const createStorageOverflowRecovery = (execution) => {
  const recover = async ({
    routing,
    options,
    taskSummary,
  }) => {
    const config = resolveExecutionStorageFallback(execution);
    if (!config?.enabled) {
      return {
        success: false,
        reason:
          routing?.reason
          || "SBC仓库已满；未启用自动清仓，任务已安全停止。",
      };
    }
    if (!Number(config.setId)) {
      return {
        success: false,
        reason: "自动清仓配置无效，请重新选择清仓 SBC。",
      };
    }

    let currentRouting = routing || emptyRoutingResult();
    const rewardSelections = [];
    let latestRewardPlan;

    while (currentRouting?.stopCode === "storage_full") {
      if (isTaskCancellationRequested()) {
        return { success: false, routing: currentRouting, reason: "用户结束了任务。" };
      }

      const catalog = await refreshSbcCache();
      const cleanupSet = catalog?.sets?.find(
        (candidate) => Number(candidate.id) === Number(config.setId)
      );
      if (!cleanupSet) {
        return {
          success: false,
          routing: currentRouting,
          reason: "选择的清仓 SBC 当前不可用或已经过期。",
        };
      }

      const repeatability = getSbcRepeatability(cleanupSet);
      const cleanupMode = String(cleanupSet.repeatabilityMode || "").toUpperCase();
      console.info("[FCX][Pack] storage cleanup availability", {
        setId: Number(config.setId),
        repeatabilityMode: String(cleanupSet.repeatabilityMode || ""),
        timesCompleted: Number(cleanupSet.timesCompleted || 0),
        repeatability,
        configuredRuns: Number(config.runs || 1),
      });
      if (
        cleanupMode === "NON_REPEATABLE"
        && Number(cleanupSet.timesCompleted || 0) > 0
      ) {
        return {
          success: false,
          routing: currentRouting,
          reason: `${cleanupSet.name} 的可用次数已经耗尽。`,
        };
      }
      if (repeatability.kind === "finite" && repeatability.remaining <= 0) {
        return {
          success: false,
          routing: currentRouting,
          reason: `${cleanupSet.name} 当前没有可执行次数。`,
        };
      }

      const rawConfiguredRuns = Math.trunc(Number(config.runs));
      const configuredRuns = rawConfiguredRuns === -1
        ? -1
        : Math.min(100, Math.max(1, rawConfiguredRuns || 1));
      const cleanupRuns = repeatability.kind === "finite"
        ? configuredRuns === -1
          ? repeatability.remaining
          : Math.min(configuredRuns, repeatability.remaining)
        : repeatability.kind === "unknown"
          ? 1
          : configuredRuns;
      if (cleanupRuns !== -1 && cleanupRuns <= 0) {
        return {
          success: false,
          routing: currentRouting,
          reason: `${cleanupSet.name} 当前没有可执行次数。`,
        };
      }

      execution.storageRecoveryCount = incrementStorageRecoveryCount(
        execution.storageRecoveryCount
      );
      const recoveryRound = execution.storageRecoveryCount;
      const cleanupRunsLabel = cleanupRuns === -1
        ? "持续执行"
        : `${cleanupRuns} 次`;
      reportOperationStatus(
        "Pack",
        `SBC仓库已满，正在执行第 ${recoveryRound} 轮清仓 · ${cleanupSet.name} · ${cleanupRunsLabel}`
      );

      const before = await readStorageCapacitySnapshot();
      const cleanupOptions = {
        ...execution.options,
        ignoreValue: execution.options.ignoreValue === true,
        requestedRuns: cleanupRuns,
        deferRewards: true,
        deferSummary: true,
        detectSpecialShortage: false,
        autoOpenRewards: false,
        storageFallback: { enabled: false, setId: 0, runs: 1 },
      };
      const cleanupExecution = createSbcExecutionContext(cleanupOptions);
      let cleanupSummaryMerged = false;
      const mergeCleanupSummary = () => {
        if (cleanupSummaryMerged) return;
        cleanupSummaryMerged = true;
        mergePackTaskSummary(taskSummary, cleanupExecution.packSummary);
      };
      const previousExecution = runtimeState.activeSbcExecution;
      let cleanupResult;
      try {
        cleanupResult = await solveSbcSet(
          Number(config.setId),
          true,
          false,
          cleanupOptions,
          cleanupExecution,
          { suppressFinalUi: true }
        );
      } finally {
        runtimeState.activeSbcExecution = previousExecution;
      }

      const completedCleanupRuns = Number(cleanupResult?.completedRuns || 0);
      const completedConfiguredRuns = cleanupRuns === -1
        ? completedCleanupRuns > 0
        : completedCleanupRuns === cleanupRuns;
      if (isTaskCancellationRequested() || completedCleanupRuns <= 0) {
        mergeCleanupSummary();
        return {
          success: false,
          routing: currentRouting,
          reason:
            cleanupExecution.stoppedReason
            || `${cleanupSet.name} 未能完整完成${cleanupRuns === -1 ? "持续执行任务" : ` ${cleanupRuns} 次`}，自动清仓已停止。`,
        };
      }
      if (!completedConfiguredRuns) {
        console.warn("[FCX][Pack] storage cleanup completed partially", {
          recoveryRound,
          setId: Number(config.setId),
          requestedRuns: cleanupRuns,
          completedRuns: completedCleanupRuns,
          stoppedReason: cleanupExecution.stoppedReason,
        });
        reportOperationStatus(
          "Pack",
          `清仓计划执行 ${cleanupRuns} 次，实际完成 ${completedCleanupRuns} 次；正在检查是否已释放仓库位置`
        );
      }

      invalidateSbcCache(config.setId);
      await fetchPlayers();
      const after = await readStorageCapacitySnapshot();
      console.info("[FCX][Pack] storage cleanup progress", {
        recoveryRound,
        setId: Number(config.setId),
        requestedRuns: cleanupRuns,
        completedRuns: completedCleanupRuns,
        before,
        after,
      });
      if (!storageProgressMade(before, after)) {
        mergeCleanupSummary();
        return {
          success: false,
          routing: currentRouting,
          reason: "清仓 SBC 未释放仓库位置，任务已安全停止。",
        };
      }

      latestRewardPlan = cleanupExecution.rewardPlan;
      console.info("[FCX][Pack] storage cleanup reward plan", {
        recoveryRound,
        setId: Number(config.setId),
        packExpected: { ...cleanupExecution.rewardPlan.expectedById },
        playerPickExpected: {
          ...cleanupExecution.rewardPlan.playerPickExpectedById,
        },
        unsupported: [...cleanupExecution.rewardPlan.unsupportedRewards],
      });
      const picksHandled = await processTrackedSbcPlayerPicks(
        cleanupExecution,
        options
      );
      console.info("[FCX][Pack] storage cleanup player picks", {
        recoveryRound,
        setId: Number(config.setId),
        handled: picksHandled,
        expected: { ...cleanupExecution.rewardPlan.playerPickExpectedById },
        processed: { ...cleanupExecution.rewardPlan.processedPlayerPickById },
        routingStopCode: cleanupExecution.lastUnassignedRouting?.stopCode,
        reason: picksHandled ? undefined : cleanupExecution.stoppedReason,
      });
      if (!picksHandled) {
        const pickRouting = cleanupExecution.lastUnassignedRouting;
        if (pickRouting?.stopCode !== "storage_full") {
          mergeCleanupSummary();
          return {
            success: false,
            routing: pickRouting || currentRouting,
            reason:
              options.autoPick === false
                ? "清仓SBC产生球员挑选，但自动挑选已关闭，请手动处理。"
                : cleanupExecution.stoppedReason
                  || "清仓 SBC 的球员挑选奖励处理失败。",
          };
        }
      }

      const selections = Object.keys(cleanupExecution.rewardPlan.expectedById).length
        ? await waitForSbcRewardSelections(cleanupExecution.rewardPlan)
        : [];
      const pendingPacks = Object.entries(
        cleanupExecution.rewardPlan.expectedById
      ).some(([rawId, expected]) => {
        const id = Number(rawId);
        const processed = Object.entries(
          cleanupExecution.rewardPlan.processedPackByKey
        )
          .filter(([key]) => Number(key.split(":", 1)[0]) === id)
          .reduce((sum, [, count]) => sum + Number(count || 0), 0);
        return processed < Number(expected);
      });
      if (pendingPacks && !selections.length) {
        mergeCleanupSummary();
        return {
          success: false,
          routing: cleanupExecution.lastUnassignedRouting || currentRouting,
          reason: "清仓 SBC 已完成，但奖励卡包尚未到账。",
        };
      }
      console.info("[FCX][Pack] storage cleanup reward packs", {
        recoveryRound,
        setId: Number(config.setId),
        pending: pendingPacks,
        selections: selections.map((selection) => ({
          id: Number(selection.id || 0),
          tradable: Boolean(selection.tradable),
          quantity: Number(selection.quantity || 0),
        })),
      });
      rewardSelections.push(
        ...selections.map((selection) => ({
          ...selection,
          rewardPlan: cleanupExecution.rewardPlan,
        }))
      );
      mergeCleanupSummary();

      reportOperationStatus("Pack", "清仓已释放位置，正在安置未分配物品");
      const rerouted = await routeUnassignedItems(options, taskSummary);
      console.info("[FCX][Pack] storage cleanup routing", {
        recoveryRound,
        setId: Number(config.setId),
        remaining: Number(rerouted.remaining || 0),
        stopCode: rerouted.stopCode,
        stopped: Boolean(rerouted.stopped),
        reason: rerouted.reason,
      });
      currentRouting = rerouted;
      if (!rerouted.stopped && rerouted.remaining <= 0) {
        reportOperationStatus(
          "Pack",
          rewardSelections.length
            ? "未分配物品已安置，接下来立即开启清仓奖励"
            : "未分配物品已安置，正在继续原任务",
          "success"
        );
        return {
          success: true,
          routing: rerouted,
          selections: rewardSelections,
          rewardPlan: latestRewardPlan,
        };
      }
      if (rerouted.stopCode !== "storage_full") {
        return {
          success: false,
          routing: rerouted,
          reason:
            rerouted.reason
            || "清仓后仍有物品无法分配，任务已安全停止。",
        };
      }
      reportOperationStatus(
        "Pack",
        `第 ${recoveryRound} 轮清仓已释放位置，但仍有不可交易重复球员未安置，正在继续清仓`
      );
    }

    return {
      success: false,
      routing: currentRouting,
      reason: currentRouting?.reason || "当前未分配物品不属于SBC仓库爆仓。",
    };
  };
  return recover;
};

const formatPackOpenFailure = (packName, error) => {
  const status = Number(eaResponseStatus(error) || 0);
  const target = packName || "当前卡包";
  if (status > 0) {
    return `开启“${target}”失败：EA返回${status}。为避免重复开包，本次未自动重试。`;
  }
  return `开启“${target}”失败：${error?.message || error || "未知错误"}。为避免重复开包，本次未自动重试。`;
};

const runPackSelections = async (
  selections,
  options = readPackRunOptions(),
  onProgress = undefined,
  taskOptions = {}
) => {
  const taskSummary = taskOptions.summary || createPackTaskSummary();
  if (runtimeState.packRunActive) {
    return {
      opened: 0,
      selected: 0,
      cancelled: false,
      stopped: true,
      reason: "已有卡包任务正在运行。",
      routing: emptyRoutingResult(),
      summary: taskSummary,
    };
  }
  if (
    taskOptions.internal !== true &&
    (runtimeState.activeRoutineExecution ||
      runtimeState.activeSbcExecution)
  ) {
    const reason = "当前FCX任务尚未结束，请稍候。";
    queueFcxNotification([reason, UINotificationType.NEGATIVE]);
    return {
      opened: 0,
      selected: 0,
      cancelled: false,
      stopped: true,
      reason,
      routing: emptyRoutingResult(),
      summary: taskSummary,
    };
  }
  if (taskOptions.internal !== true) resetTaskCancellation();
  if (isTaskCancellationRequested()) {
    return {
      opened: 0,
      selected: 0,
      cancelled: true,
      stopped: true,
      reason: "卡包任务已取消。",
      routing: emptyRoutingResult(),
      summary: taskSummary,
    };
  }
  const ownsTaskOverlay = taskOptions.internal !== true;
  if (ownsTaskOverlay) holdTaskOverlay();
  runtimeState.packRunActive = true;
  let opened = 0;
  let selected = 0;
  let routing = emptyRoutingResult();
  let reason;
  const queue = expandPackWorkQueue(selections);
  try {
    showLoader(true);
    reportOperationStatus("Pack", "正在检查未分配物品");
    const allowPlayerPicks = taskOptions.allowPlayerPicks !== false;
    const initial = await processPackItems(options, taskSummary, {
      allowPlayerPicks,
    });
    routing = initial.routing;
    selected += initial.selected;
    if (routing.stopped || routing.remaining > 0) {
      const recovery =
        routing.stopCode === "storage_full"
        && typeof taskOptions.onStorageFull === "function"
          ? await taskOptions.onStorageFull({
              phase: "before_pack",
              routing,
              options,
              taskSummary,
            })
          : null;
      if (recovery?.success) {
        routing = recovery.routing || emptyRoutingResult();
        queue.unshift(
          ...expandPackWorkQueue(
            recovery.selections || [],
            recovery.rewardPlan
          )
        );
      } else {
        reason =
          recovery?.reason || routing.reason || "请先处理未分配物品。";
        queueFcxNotification([reason, UINotificationType.NEGATIVE]);
        goToUnassignedView();
        return {
          opened,
          selected,
          cancelled: false,
          stopped: true,
          reason,
          routing,
          summary: taskSummary,
        };
      }
    }

    reportOperationStatus("Pack", `已准备 ${queue.length} 个卡包`);
    let cursor = 0;
    while (cursor < queue.length) {
      if (isTaskCancellationRequested()) {
        reason = "卡包任务已取消。";
        break;
      }
      const work = queue[cursor];
      const currentPacks = await getPacks();
      const matchingPacks = currentPacks.packs.filter(
        (candidate) =>
          Number(candidate.id) === Number(work.id) &&
          Boolean(candidate.tradeable) === Boolean(work.tradable) &&
          (work.owned === false
            ? !Boolean(candidate.isMyPack)
            : Boolean(candidate.isMyPack))
      );
      const pack = matchingPacks[0];
      if (!pack) {
        console.warn("[FCX][Pack] 卡包实体已失效，跳过当前队列项", {
          packId: Number(work.id),
          tradable: Boolean(work.tradable),
          queueIndex: cursor,
        });
        cursor += 1;
        continue;
      }
      const localizedPackName = services.Localization.localize(pack.packName);
      reportOperationStatus(
        "Pack",
        `正在开启第 ${opened + 1} / ${queue.length} 个卡包 · ${localizedPackName}`
      );
      onProgress?.({ opened, total: queue.length, name: localizedPackName });
      let openResult;
      try {
        openResult = await openPackInstance(
          pack,
          options,
          taskSummary,
          allowPlayerPicks
        );
      } catch (error) {
        const status = Number(eaResponseStatus(error) || 0);
        if (status === 404) {
          console.warn("[FCX][Pack] EA确认卡包实体已失效，跳过当前队列项", {
            packId: Number(work.id),
            tradable: Boolean(work.tradable),
            queueIndex: cursor,
          });
          cursor += 1;
          continue;
        }
        reason = formatPackOpenFailure(localizedPackName, error);
        console.error("[FCX][Pack] 开包写请求失败，当前批次已结束", {
          packId: Number(work.id),
          tradable: Boolean(work.tradable),
          queueIndex: cursor,
          status,
          reason,
          error,
        });
        break;
      }
      opened += 1;
      cursor += 1;
      taskSummary.packsOpened += 1;
      if (work.rewardPlan) {
        markRewardPacksProcessed(work.rewardPlan, [{
          id: work.id,
          tradable: work.tradable,
          quantity: 1,
        }]);
      }
      reportOperationStatus("Pack", "正在处理球员挑选与分配物品");
      const processed = await processPackItems(options, taskSummary, {
        allowPlayerPicks,
        pendingPlayerPickDetected: openResult?.pendingPlayerPick,
      });
      routing = processed.routing;
      selected += processed.selected;
      onProgress?.({ opened, total: queue.length, name: localizedPackName });
      if (routing.stopped || routing.remaining > 0) {
        const recovery =
          routing.stopCode === "storage_full"
          && typeof taskOptions.onStorageFull === "function"
            ? await taskOptions.onStorageFull({
                phase: "after_pack",
                routing,
                options,
                taskSummary,
              })
            : null;
        if (recovery?.success) {
          routing = recovery.routing || emptyRoutingResult();
          const inserted = insertImmediatePackSelections(
            queue,
            cursor,
            recovery.selections || [],
            recovery.rewardPlan
          );
          if (inserted > 0) {
            reportOperationStatus(
              "Pack",
              `已插入 ${inserted} 个清仓奖励包，优先处理后再继续原任务`
            );
          }
          await waitExactMs(PACK_OPEN_SUCCESS_INTERVAL_MS);
          continue;
        }
        reason =
          recovery?.reason
          || routing.reason
          || "仍有未分配物品，任务已停止。";
        goToUnassignedView();
        break;
      }
      await waitExactMs(PACK_OPEN_SUCCESS_INTERVAL_MS);
    }
    const cancelled = isTaskCancellationRequested();
    if (cancelled && !reason) reason = "卡包任务已取消。";
    const stopped = Boolean(reason) || routing.stopped;
    if (reason) {
      queueFcxNotification([
        reason,
        cancelled
          ? UINotificationType.NEUTRAL
          : UINotificationType.NEGATIVE,
      ]);
    } else {
      reportOperationStatus("Pack", "卡包任务已完成", "success");
      queueFcxNotification([
        `已打开 ${opened} 个卡包并完成物品分配。`,
        UINotificationType.POSITIVE,
      ]);
    }
    return { opened, selected, cancelled, stopped, reason, routing, summary: taskSummary };
  } catch (error) {
    reason = `卡包任务失败：${error?.message || error}`;
    console.error(reason, { error });
    queueFcxNotification([reason, UINotificationType.NEGATIVE]);
    goToUnassignedView();
    return {
      opened,
      selected,
      cancelled: isTaskCancellationRequested(),
      stopped: true,
      reason,
      routing,
      summary: taskSummary,
    };
  } finally {
    if (reason) taskSummary.stoppedReason = reason;
    refreshPackDestinationCounts(taskSummary);
    if (taskOptions.internal !== true) {
      void saveTaskHistory({
        type: "pack",
        title: "FCX开包",
        summary: taskSummary,
      });
    }
    runtimeState.packRunActive = false;
    if (ownsTaskOverlay) releaseTaskOverlay();
    else hideLoader();
    createSBCTab();
    if (
      taskOptions.showSummary !== false
      && (
        taskSummary.packsOpened > 0
        || taskSummary.picksCompleted > 0
        || taskSummary.players.length > 0
        || taskSummary.sbcSubmissions.length > 0
      )
    ) {
      showPackTaskSummary(taskSummary);
    }
  }
};

let openPack = async (pack, repeat = 0, allPacks = false) => {
  const packs = await getPacks();
  const available = packs.packs.filter(
    (candidate) =>
      candidate.isMyPack || candidate?.prices?._collection?.COINS?.amount < 101
  );
  let selections;
  if (allPacks) {
    const grouped = new Map();
    for (const candidate of available) {
      const key = `${candidate.id}:${Boolean(candidate.tradeable)}:${Boolean(candidate.isMyPack)}`;
      const current = grouped.get(key);
      grouped.set(key, {
        id: candidate.id,
        tradable: Boolean(candidate.tradeable),
        owned: Boolean(candidate.isMyPack),
        quantity: (current?.quantity || 0) + 1,
      });
    }
    selections = [...grouped.values()];
  } else if (pack) {
    selections = [
      {
        id: pack.id,
        tradable: Boolean(pack.tradeable),
        owned: Boolean(pack.isMyPack),
        quantity: repeat > 0 ? repeat : 1,
      },
    ];
  } else {
    return {
      opened: 0,
      selected: 0,
      cancelled: false,
      stopped: true,
      reason: "没有可打开的卡包。",
      routing: emptyRoutingResult(),
      summary: createPackTaskSummary(),
    };
  }
  return runPackSelections(selections, readPackRunOptions());
};
let showPack = async (pack, packPlayers) => {
  return new Promise((resolve, reject) => {
    let c = new UTStoreViewController();
    var o = null,
      n = packPlayers.items.filter(function (e) {
        return e.isPlayer();
      });
    if (0 < n.length) {
      var r = new UTItemUtils(),
        s = n.sort(function (t, e) {
          return getSBCPrice(e) - getSBCPrice(t);
        });
      o = s[0];
    } else
      packPlayers.items.forEach(function (e) {
        (!o || o.discardValue < e.discardValue) && (o = e);
      });

    if (o && o.rating >= getSettings(0, 0, "animateWalkouts")) {
      var a = new UTPackAnimationViewController();
      a.initWithPackData(o, pack.assetId),
        a.setAnimationCallback(
          function () {
            this.dismissViewController(!1, function () {
              a.dealloc();
              resolve();
            }),
              repositories.Store.setDirty();
          }.bind(c)
        ),
        (a.modalDisplayStyle = "fullscreen"),
        c.presentViewController(a, !0);
      return;
    }

    resolve();
  });
};
const FCX_PACK_OPEN_BUTTON_CLASS = "fcx-native-pack-open";
const FCX_PACK_OPEN_STYLE_ID = "fcx-native-pack-open-style";
const FCX_PACK_ACTION_HOOK_VERSION = 3;
const FCX_PACK_MOUNT_RETRY_DELAYS_MS = [0, 60, 180, 420];
const FCX_PACK_HOOK_RETRY_MS = 500;
const FCX_PACK_HOOK_RETRY_LIMIT_MS = 30000;
let nativePackMountGeneration = 0;
let nativePackLastStoreView = null;
let nativePackLastPacks = [];
let nativePackPageObserver;
let nativePackButtonSyncQueued = false;
let nativePackHookStartedAt = 0;
let nativePackHookRetryTimer;
let nativePackHookInstalled = false;
const nativePackDiagnosticKeys = new Set();

const nativePackKey = (pack) => `${Number(pack?.id || 0)}:${Boolean(pack?.tradeable)}`;

const logNativePackDiagnosticOnce = (level, key, message, details = {}) => {
  if (nativePackDiagnosticKeys.has(key)) return;
  nativePackDiagnosticKeys.add(key);
  const logger = console[level] || console.info;
  logger.call(console, message, details);
};

const readCollectionValues = (collection) => {
  if (Array.isArray(collection)) return collection;
  try {
    const values = collection?.values?.();
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
};

const readNativeOwnedPacks = () => {
  if (typeof repositories !== "undefined") {
    try {
      const packs = readCollectionValues(repositories?.Store?.getPacks?.("mypacks"));
      if (packs.length > 0) return { packs, source: "repository.getPacks" };
    } catch (_error) {
      // Continue with the repository collection and captured render data.
    }
    try {
      const packs = readCollectionValues(repositories?.Store?.myPacks);
      if (packs.length > 0) return { packs, source: "repository.myPacks" };
    } catch (_error) {
      // Continue with the last setPacks payload.
    }
  }
  return {
    packs: nativePackLastPacks.filter((pack) => pack?.isMyPack),
    source: "setPacks",
  };
};

const nativePackControllerRoots = () => {
  const roots = [];
  try {
    if (typeof getCurrentViewController === "function") {
      roots.push(getCurrentViewController());
    }
  } catch (_error) {
    // The current controller can disappear during navigation.
  }
  try {
    if (typeof getAppMain === "function") {
      roots.push(getAppMain()?.getRootViewController?.());
    }
  } catch (_error) {
    // The app root is not ready yet.
  }
  return roots.filter(Boolean);
};

const discoverNativePackStoreView = () => {
  const result = findNativePackStoreView(nativePackControllerRoots());
  if (result.view) {
    nativePackLastStoreView = result.view;
    logNativePackDiagnosticOnce("info", "controller-fallback-found", "[FCX][Pack] 已通过控制器树取得卡包视图", {
      scanned: result.scanned,
      packViews: result.view.storePacks?.length || 0,
    });
  }
  return result;
};

const currentNativePackStoreView = () => {
  if (
    nativePackLastStoreView?.storePacks?.some((packView) =>
      Boolean(resolveNativePackRoot(packView)?.isConnected)
    )
  ) {
    return { view: nativePackLastStoreView, scanned: 0 };
  }
  return discoverNativePackStoreView();
};

const ensureNativeFcxPackButtonStyle = () => {
  if (document.getElementById(FCX_PACK_OPEN_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FCX_PACK_OPEN_STYLE_ID;
  style.textContent = `
.${FCX_PACK_OPEN_BUTTON_CLASS} {
  flex: 1 1 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 0 !important;
  min-height: 44px !important;
  margin: 0 !important;
  padding: 7px 12px !important;
  border: 2px solid #39d6a3 !important;
  border-radius: 24px !important;
  background: #39d6a3 !important;
  box-shadow: 0 2px 9px rgba(57, 214, 163, .28) !important;
  color: #071a13 !important;
  font: 800 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif !important;
  cursor: pointer !important;
  opacity: 1 !important;
  visibility: visible !important;
}
.${FCX_PACK_OPEN_BUTTON_CLASS}:hover,
.${FCX_PACK_OPEN_BUTTON_CLASS}:focus-visible {
  background: #5ce2b5 !important;
  border-color: #5ce2b5 !important;
  outline: none !important;
}
.${FCX_PACK_OPEN_BUTTON_CLASS}:disabled {
  cursor: wait !important;
  opacity: .65 !important;
}`;
  (document.head || document.documentElement).appendChild(style);
};

const mountNativeFcxPackButtons = (storeView, packs) => {
  ensureNativeFcxPackButtonStyle();
  const ownedPacks = [];
  const seen = new Set();
  for (const pack of Array.isArray(packs) ? packs : []) {
    if (!pack?.isMyPack) continue;
    const key = nativePackKey(pack);
    if (seen.has(key)) continue;
    seen.add(key);
    ownedPacks.push(pack);
  }

  const diagnostics = {
    ownedPacks: ownedPacks.length,
    packViews: storeView?.storePacks?.length || 0,
    matchedViews: 0,
    mounted: 0,
    existing: 0,
    missingView: 0,
    missingRoot: 0,
    missingFooter: 0,
    tradabilityMismatch: 0,
  };

  for (const pack of ownedPacks) {
    const match = inspectNativeOwnedPackView(storeView || {}, pack);
    if (!match.root) {
      if (match.reason === "root_not_found") diagnostics.missingRoot += 1;
      else if (match.reason === "tradability_mismatch") diagnostics.tradabilityMismatch += 1;
      else diagnostics.missingView += 1;
      continue;
    }
    diagnostics.matchedViews += 1;
    const footer = findNativePackFooter(match);
    if (!footer) {
      diagnostics.missingFooter += 1;
      continue;
    }
    if (footer.querySelector(`.${FCX_PACK_OPEN_BUTTON_CLASS}`)) {
      diagnostics.existing += 1;
      continue;
    }

    footer.style.display = "flex";
    footer.style.gap = "8px";
    footer.style.alignItems = "stretch";
    const nativeButton = footer.querySelector("button");
    if (nativeButton) nativeButton.style.flex = "1";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `${FCX_PACK_OPEN_BUTTON_CLASS} btn-standard`;
    button.textContent = "FCX开包";
    button.setAttribute("aria-label", "使用FCX打开当前卡包");
    button.style.flex = "1 1 0";
    button.style.minWidth = "0";
    button.style.margin = "0";
    const descriptor = {
      id: Number(pack?.id || 0),
      tradeable: Boolean(pack?.tradeable),
    };
    button.dataset.packId = String(descriptor.id);
    button.dataset.tradable = String(descriptor.tradeable);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      if (hasBlockingFcxTask()) {
        queueFcxNotification([
          "当前FCX任务尚未结束，请稍候。",
          UINotificationType.NEGATIVE,
        ]);
        return;
      }
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "正在开包…";
      try {
        const latest = readNativeOwnedPacks().packs.find(
          (candidate) => nativePackKey(candidate) === nativePackKey(descriptor)
        );
        await openPack(latest || descriptor, 1, false);
      } catch (error) {
        const reason = String(error?.message || error || "FCX开包失败。");
        console.error("[FCX][Pack] 单包开启失败", {
          packId: Number(pack?.id || 0),
          tradable: Boolean(pack?.tradeable),
          error,
        });
        queueFcxNotification([reason, UINotificationType.NEGATIVE]);
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = originalText;
        }
        scheduleNativePackButtonSync();
      }
    });
    footer.appendChild(button);
    diagnostics.mounted += 1;
  }
  return {
    ...diagnostics,
    complete: diagnostics.ownedPacks === diagnostics.mounted + diagnostics.existing,
  };
};

const scheduleNativeFcxPackButtonMount = (storeView, packs) => {
  nativePackLastStoreView = storeView;
  nativePackLastPacks = Array.isArray(packs) ? packs : [];
  nativePackMountGeneration += 1;
  const generation = nativePackMountGeneration;

  const attempt = (index) => {
    if (generation !== nativePackMountGeneration) return;
    let diagnostics;
    try {
      diagnostics = mountNativeFcxPackButtons(storeView, nativePackLastPacks);
    } catch (error) {
      console.warn("[FCX][Pack] 卡包按钮挂载异常", { attempt: index + 1, error });
    }
    if (diagnostics?.complete) return;
    if (index >= FCX_PACK_MOUNT_RETRY_DELAYS_MS.length - 1) {
      console.warn("[FCX][Pack] 卡包按钮挂载未完成", diagnostics || {
        reason: "mount_exception",
      });
      return;
    }
    const delay = FCX_PACK_MOUNT_RETRY_DELAYS_MS[index + 1]
      - FCX_PACK_MOUNT_RETRY_DELAYS_MS[index];
    setTimeout(() => attempt(index + 1), delay);
  };

  attempt(0);
};

const syncNativePackButtons = () => {
  const storeViewResult = currentNativePackStoreView();
  const owned = readNativeOwnedPacks();
  if (!storeViewResult.view) {
    logNativePackDiagnosticOnce("warn", "store-view-missing", "[FCX][Pack] 当前页面未找到可靠的卡包视图", {
      scanned: storeViewResult.scanned,
      ownedPacks: owned.packs.length,
    });
    return;
  }
  if (owned.packs.length === 0) {
    logNativePackDiagnosticOnce("info", "owned-packs-empty", "[FCX][Pack] 当前没有可挂载的已拥有卡包", {
      source: owned.source,
      packViews: storeViewResult.view.storePacks?.length || 0,
    });
    return;
  }
  scheduleNativeFcxPackButtonMount(storeViewResult.view, owned.packs);
};

const scheduleNativePackButtonSync = () => {
  if (nativePackButtonSyncQueued) return;
  nativePackButtonSyncQueued = true;
  const schedule = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (callback) => setTimeout(callback, 0);
  schedule(() => {
    nativePackButtonSyncQueued = false;
    syncNativePackButtons();
  });
};

const mutationContainsNativePackFooter = (mutation) => {
  const nodes = [...(mutation?.addedNodes || [])];
  return nodes.some((node) => {
    if (node?.nodeType !== 1) return false;
    return node.matches?.(".ut-store-pack-details-view--footer")
      || Boolean(node.querySelector?.(".ut-store-pack-details-view--footer"));
  });
};

const installNativePackPageObserver = () => {
  if (nativePackPageObserver) return;
  if (!document.body) {
    setTimeout(installNativePackPageObserver, 250);
    return;
  }
  nativePackPageObserver = new MutationObserver((mutations) => {
    if (!mutations.some(mutationContainsNativePackFooter)) return;
    scheduleNativePackButtonSync();
  });
  nativePackPageObserver.observe(document.body, { childList: true, subtree: true });
  logNativePackDiagnosticOnce("info", "observer-installed", "[FCX][Pack] 卡包页面观察器已启动");
  scheduleNativePackButtonSync();
};

const resolveNativePackRuntimeWindow = () => {
  let pageWindow;
  try {
    pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : undefined;
  } catch (_error) {
    pageWindow = undefined;
  }
  return {
    runtimeWindow: resolveNativePackPageWindow(window, pageWindow),
    unsafeWindowAvailable: Boolean(pageWindow),
  };
};

const tryInstallNativePackHook = () => {
  const { runtimeWindow, unsafeWindowAvailable } = resolveNativePackRuntimeWindow();
  const StoreView = runtimeWindow?.UTStoreView;
  const prototype = StoreView?.prototype;
  if (!prototype || typeof prototype.setPacks !== "function") {
    return false;
  }
  if (prototype.setPacks.__fcxPackActionsVersion === FCX_PACK_ACTION_HOOK_VERSION) {
    nativePackHookInstalled = true;
    return true;
  }
  if (prototype.setPacks.__fcxPackActionsInstalled && prototype.setPacks.__fcxOriginal) {
    prototype.setPacks = prototype.setPacks.__fcxOriginal;
  }
  const originalSetPacks = prototype.setPacks;
  const setPacksWithFcxActions = function (packs, ...args) {
    const result = originalSetPacks.call(this, packs, ...args);
    nativePackLastStoreView = this;
    nativePackLastPacks = Array.isArray(packs) ? packs : [];
    scheduleNativeFcxPackButtonMount(this, packs);
    return result;
  };
  setPacksWithFcxActions.__fcxPackActionsInstalled = true;
  setPacksWithFcxActions.__fcxPackActionsVersion = FCX_PACK_ACTION_HOOK_VERSION;
  setPacksWithFcxActions.__fcxOriginal = originalSetPacks;
  prototype.setPacks = setPacksWithFcxActions;
  nativePackHookInstalled = true;
  console.info("[FCX][Pack] 卡包按钮挂载已安装", {
    hookVersion: FCX_PACK_ACTION_HOOK_VERSION,
    unsafeWindowAvailable,
    pageWindowSelected: runtimeWindow !== window,
  });
  return true;
};

const packOverRide = () => {
  if (!nativePackHookStartedAt) {
    nativePackHookStartedAt = Date.now();
    const environment = resolveNativePackRuntimeWindow();
    console.info("[FCX][Pack] 正在初始化卡包按钮", {
      unsafeWindowAvailable: environment.unsafeWindowAvailable,
      pageWindowSelected: environment.runtimeWindow !== window,
      sandboxHasStoreView: Boolean(window?.UTStoreView),
      pageHasStoreView: Boolean(environment.runtimeWindow?.UTStoreView),
    });
  }
  installNativePackPageObserver();
  if (tryInstallNativePackHook()) {
    if (nativePackHookRetryTimer) clearTimeout(nativePackHookRetryTimer);
    nativePackHookRetryTimer = undefined;
    return true;
  }
  const elapsedMs = Date.now() - nativePackHookStartedAt;
  if (elapsedMs >= FCX_PACK_HOOK_RETRY_LIMIT_MS) {
    const environment = resolveNativePackRuntimeWindow();
    logNativePackDiagnosticOnce("warn", "hook-timeout", "[FCX][Pack] 30秒内未发现EA卡包视图构造器，已启用控制器树后备", {
      hookInstalled: nativePackHookInstalled,
      unsafeWindowAvailable: environment.unsafeWindowAvailable,
      pageWindowSelected: environment.runtimeWindow !== window,
      sandboxHasStoreView: Boolean(window?.UTStoreView),
      pageHasStoreView: Boolean(environment.runtimeWindow?.UTStoreView),
    });
    scheduleNativePackButtonSync();
    return false;
  }
  if (!nativePackHookRetryTimer) {
    nativePackHookRetryTimer = setTimeout(() => {
      nativePackHookRetryTimer = undefined;
      packOverRide();
    }, FCX_PACK_HOOK_RETRY_MS);
  }
  return false;
};
const packItemOverride = () => {
  const storeListView = UTStoreRevealModalListView.prototype.render;

  UTStoreRevealModalListView.prototype.render = function (...args) {
    storeListView.call(this, ...args);
  };
};
const playerSlotOverride = () => {
  const playerSlot = UTSquadPitchView.prototype.setSlots;

  UTSquadPitchView.prototype.setSlots = async function (...args) {
    const result = playerSlot.call(this, ...args);
    const slots = this.getSlotViews();
    const squadSlots = [];
    slots.forEach((slot, index) => {
      const item = args[0][index];
      squadSlots.push({
        item: item._item,
        rootElement: slot.getRootElement(),
      });
    });

    appendSlotPrice(squadSlots);
    return result;
  };
};

const appendSlotPrice = async (squadSlots) => {
  if (!squadSlots.length) {
    return;
  }
  const players = [];
  for (const { item } of squadSlots) {
    players.push(item);
  }

  const prices = await fetchPlayerPrices(players);
  let total = 0;
  const duplicateIds = await fetchDuplicateIds();
  let PriceItems = getPriceItems();
  for (const { rootElement, item } of squadSlots) {
    if (duplicateIds.includes(item.id)) {
      rootElement.style.opacity = "0.4";
    }

    const element = rootElement;
    appendPriceToSlot(element, item);

    total += getPrice(item);
  }
  appendSquadTotal(total);
};
const appendSquadTotal = (total) => {
  if (getSettings(0, 0, "showPrices")) {
    // Check if any element with class "squadTotal" exists
    if (document.querySelector(".squadTotal")) {
      // Update textContent of all elements with class "squadTotal"
      document.querySelectorAll(".squadTotal").forEach(function (el) {
        el.textContent = total.toLocaleString();
      });
    } else {
      // Create the new element from HTML string
      var html = `<div class="rating chemistry-inline">
                <span class="ut-squad-summary-label">Squad Price</span>
                <div>
                  <span class="ratingValue squadTotal currency-coins">${total.toLocaleString()}</span>
                </div>
              </div>`;
      var tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      var newElem = tempDiv.firstElementChild;

      // Find the element with class "chemistry"
      var chemistryElem = document.querySelector(".chemistry");
      if (chemistryElem && chemistryElem.parentNode) {
        // Insert newElem immediately after the chemistry element
        chemistryElem.parentNode.insertBefore(
          newElem,
          chemistryElem.nextSibling
        );
      }
    }
  }
};
const appendPriceToSlot = async (rootElement, item) => {
  let priceElement = await getPriceDiv(item);
  if (priceElement) {
    rootElement.prepend(priceElement);
  }
};

const getUserPlatform = () => {
  if (services.User.getUser().getSelectedPersona().isPC) {
    return "pc";
  }
  return "ps";
};
const favTagOverride = () => {
  const favTag = UTSBCFavoriteButtonControl.prototype.watchSBCSet;

  UTSBCFavoriteButtonControl.prototype.watchSBCSet = function () {
    const result = favTag.call(this);
    createSBCTab();
    return result;
  };
};

let autoSbcPageRoot = null;
let autoSbcRenderVersion = 0;
let autoSbcRefreshPending = true;

const mountAutoSbcPage = (root) => {
  fcxAutoSbcSessionSnapshot.invalidate();
  autoSbcPageRoot = root;
  autoSbcRefreshPending = true;
  createSBCTab();
};

const unmountAutoSbcPage = (root) => {
  if (!root || autoSbcPageRoot === root) {
    fcxAutoSbcSessionSnapshot.invalidate();
    autoSbcPageRoot = null;
    autoSbcRenderVersion += 1;
  }
};

const createNavButton = (id, content, callback, style = {}) => {
  const button = document.createElement("button");
  button.classList.add("ut-tab-bar-item");
  button.id = id;
  const defaultStyles = {
    width: "100%",
    background: "#1e1f1f",
    marginTop: "0px",
  };

  const combinedStyles = { ...defaultStyles, ...style };
  Object.keys(combinedStyles).forEach((key) => {
    button.style[key] = combinedStyles[key];
  });
  button.innerHTML = content;
  button.addEventListener("click", () => {
    callback();
  });
  return button;
};

const createDiv = (id, style) => {
  const div = document.createElement("div");
  div.id = id;
  Object.keys(style).forEach((key) => {
    div.style[key] = style[key];
  });
  return div;
};

const loadAutoSbcPackGroups = async () => {
  const packs = await getPacks();
  const available = (packs?.packs || []).filter(
    (pack) => pack.isMyPack || pack?.prices?._collection?.COINS?.amount < 101
  );
  return [...available.reduce((map, pack) => {
    const key = `${pack.id}:${Boolean(pack.tradeable)}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      return map;
    }
    const name = services.Localization.localize(pack.packName);
    map.set(key, {
      id: pack.id,
      packId: Number(pack.id),
      tradable: Boolean(pack.tradeable),
      count: 1,
      name,
      packName: name || `卡包 #${Number(pack.id)}`,
      description: services.Localization.localize(pack.packDesc),
    });
    return map;
  }, new Map()).values()];
};

const createPackList = (groups) => {
  const total = groups.reduce((sum, group) => sum + Number(group.count || 0), 0);
  return createNavButton(
    "navPacks",
    `<span>${uiText.autoSbc.packs}<br>${total}</span>`,
    () => openPackSelectionModal(groups),
    { background: "none" }
  );
};

const createModalButton = (label, className = "") => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `fcx-button ${className}`.trim();
  button.textContent = label;
  return button;
};

const createToggleOption = (label, checked, warning = false) => {
  const row = document.createElement("label");
  row.className = `fcx-option-card${warning ? " fcx-option-card--warning" : ""}`;
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  row.append(text, input);
  return { row, input };
};

const openPackSelectionModal = (groups) => {
  const content = document.createElement("div");
  const list = document.createElement("div");
  list.className = "fcx-modal-grid";
  const rowControls = [];

  const selectAllRow = document.createElement("label");
  selectAllRow.className = "fcx-choice-row";
  const selectAllLabel = document.createElement("strong");
  selectAllLabel.textContent = uiText.autoSbc.selectAll;
  const selectAll = document.createElement("input");
  selectAll.type = "checkbox";
  selectAllRow.append(selectAllLabel, selectAll);
  content.appendChild(selectAllRow);

  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "auto-sbc-empty";
    empty.textContent = uiText.autoSbc.noPacks;
    content.appendChild(empty);
  }

  for (const group of groups) {
    const row = document.createElement("label");
    row.className = "fcx-choice-row";
    const main = document.createElement("span");
    main.className = "fcx-choice-main";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const copy = document.createElement("span");
    copy.className = "fcx-choice-copy";
    const title = document.createElement("span");
    title.className = "fcx-choice-title";
    title.textContent = group.name;
    const meta = document.createElement("span");
    meta.className = "fcx-choice-meta";
    meta.textContent = `${group.tradable ? uiText.autoSbc.tradable : uiText.autoSbc.untradeable} · ${group.count} 个`;
    copy.append(title, meta);
    main.append(checkbox, copy);
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(group.count);
    quantity.value = String(group.count);
    quantity.setAttribute("aria-label", `${group.name} ${uiText.autoSbc.packQuantity}`);
    row.append(main, quantity);
    list.appendChild(row);
    rowControls.push({ group, checkbox, quantity });
  }
  content.appendChild(list);

  selectAll.addEventListener("change", () => {
    rowControls.forEach(({ checkbox }) => {
      checkbox.checked = selectAll.checked;
    });
  });

  const saved = readPackRunOptions();
  const optionsGrid = document.createElement("div");
  optionsGrid.className = "fcx-option-grid";
  const autoPick = createToggleOption(uiText.autoSbc.autoPick, saved.autoPick);
  const skipAnimation = createToggleOption(
    uiText.autoSbc.skipAnimation,
    saved.skipAnimation
  );
  const quickSell = createToggleOption(
    uiText.autoSbc.quickSellDuplicates,
    saved.quickSellDuplicates,
    true
  );

  const strategyRow = document.createElement("label");
  strategyRow.className = "fcx-option-card";
  const strategyLabel = document.createElement("span");
  strategyLabel.textContent = uiText.autoSbc.pickStrategy;
  const strategy = document.createElement("select");
  strategy.innerHTML = `<option value="ovr">${uiText.autoSbc.pickByRating}</option><option value="price">${uiText.autoSbc.pickByPrice}</option>`;
  strategy.value = saved.pickStrategy;
  strategyRow.append(strategyLabel, strategy);

  const thresholdRow = document.createElement("label");
  thresholdRow.className = "fcx-option-card fcx-option-card--warning";
  const thresholdLabel = document.createElement("span");
  thresholdLabel.textContent = uiText.autoSbc.quickSellThreshold;
  const threshold = document.createElement("input");
  threshold.type = "number";
  threshold.min = "0";
  threshold.max = "99";
  threshold.value = String(saved.quickSellUnder);
  thresholdRow.append(thresholdLabel, threshold);

  const warning = document.createElement("p");
  warning.className = "fcx-warning-copy";
  warning.textContent = uiText.autoSbc.quickSellWarning;
  optionsGrid.append(
    autoPick.row,
    strategyRow,
    skipAnimation.row,
    quickSell.row,
    thresholdRow
  );
  content.append(optionsGrid, warning);

  const modal = openFcxModal({
    id: "fcx-pack-modal",
    title: uiText.autoSbc.packDialogTitle,
    description: uiText.autoSbc.packDialogDescription,
    content,
  });
  const status = document.createElement("p");
  status.className = "fcx-modal-status";
  status.textContent = uiText.autoSbc.packProgressIdle;
  const closeButton = createModalButton(uiText.autoSbc.close);
  const openButton = createModalButton(
    uiText.autoSbc.openSelected,
    "fcx-button--primary"
  );
  openButton.disabled = !groups.length;
  modal.footer.append(status, closeButton, openButton);

  closeButton.addEventListener("click", modal.close);
  openButton.addEventListener("click", async () => {
    const selections = rowControls
      .filter(({ checkbox }) => checkbox.checked)
      .map(({ group, quantity }) => ({
        id: group.id,
        tradable: group.tradable,
        quantity: Math.max(
          1,
          Math.min(group.count, Number(quantity.value) || 1)
        ),
      }));
    if (!selections.length) {
      status.textContent = "请至少选择一种卡包。";
      return;
    }
    if (hasBlockingFcxTask()) {
      status.textContent = "当前FCX任务尚未结束，请稍候。";
      return;
    }
    const options = {
      autoPick: autoPick.input.checked,
      pickStrategy: strategy.value === "price" ? "price" : "ovr",
      quickSellDuplicates: quickSell.input.checked,
      quickSellUnder: Math.max(0, Math.min(99, Number(threshold.value) || 75)),
      skipAnimation: skipAnimation.input.checked,
    };
    savePackRunOptions(options);
    openButton.disabled = true;
    modal.close();
    await runPackSelections(selections, options);
  });
};

const createCategoryPicker = async (sets = undefined) => {
  sets = sets || (await sbcSets());
  if (sets === undefined) {
    console.log("createCategoryPicker: sets are undefined");
    return null;
  }
  // Only keep categories that contain at least one incomplete set
  const incompleteSetIds = (sets.sets || [])
    .filter((s) => !s.isComplete())
    .map((s) => s.id);
  const filteredCategories = (sets.categories || []).filter(
    (cat) =>
      Array.isArray(cat.setIds) &&
      cat.setIds.some((id) => incompleteSetIds.includes(id))
  );
  // Fallback to original categories if filtering results in none (avoids empty UI)
  let categories = filteredCategories.length
    ? filteredCategories.map((c) => c.name)
    : (sets.categories || []).map((c) => c.name);

  // Add a "Daily" category if it doesn't already exist
  if (!categories.includes("Daily")) {
    // Find all SBCs with "daily" in their name (case insensitive)
    let dailySbcs = sets.sets.filter((set) =>
      set.name.toLowerCase().includes("daily")
    );

    // If we found any daily SBCs, add a Daily category
    if (dailySbcs.length > 0) {
      // Create a new "Daily" category with the set IDs of matching SBCs
      sets.categories.push({
        name: "Daily",
        setIds: dailySbcs.map((sbc) => sbc.id),
      });

      // Update the categories list for the dropdown
      categories.push("Daily");
    }
  }
  return createNavButton(
    "navCategory",
    `${uiText.autoSbc.selectSbcCategory}<br>${getSettings(0, 0, "sbcType")}`,
    () => openCategoryModal(categories),
    { background: "none" }
  );
};

const openCategoryModal = (categories) => {
  const content = document.createElement("div");
  content.className = "fcx-modal-grid";
  const current = getSettings(0, 0, "sbcType");
  const radios = [];
  categories.forEach((category, index) => {
    const row = document.createElement("label");
    row.className = "fcx-choice-row";
    const label = document.createElement("span");
    label.className = "fcx-choice-title";
    label.textContent = category;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "fcx-sbc-category";
    input.value = category;
    input.checked = category === current || (!categories.includes(current) && index === 0);
    row.append(label, input);
    content.appendChild(row);
    radios.push(input);
  });
  const modal = openFcxModal({
    id: "fcx-category-modal",
    title: uiText.autoSbc.categoryDialogTitle,
    description: uiText.autoSbc.categoryDialogDescription,
    content,
  });
  const closeButton = createModalButton(uiText.autoSbc.close);
  const saveButton = createModalButton(
    uiText.autoSbc.saveCategory,
    "fcx-button--primary"
  );
  saveButton.disabled = !categories.length;
  modal.footer.append(closeButton, saveButton);
  closeButton.addEventListener("click", modal.close);
  saveButton.addEventListener("click", () => {
    const selected = radios.find((radio) => radio.checked)?.value;
    if (!selected) return;
    saveSettings(0, 0, "sbcType", selected);
    queueFcxNotification([
      `${uiText.autoSbc.updatingCategory} ${selected}`,
      UINotificationType.POSITIVE,
    ]);
    modal.close();
    createSBCTab();
  });
};

const createSBCButtons = async (sets = undefined) => {
  sets = sets || (await sbcSets());
  if (sets === undefined) {
    console.log("createSBCButtons: sets are undefined");
    return null;
  }

  let sbcSetIds;
  if (getSettings(0, 0, "sbcType") === "Daily") {
    // Find all SBCs with "daily" in their name (case insensitive)
    sbcSetIds = sets.sets
      .filter((set) => set.name.toLowerCase().includes("daily"))
      .map((set) => set.id);
  } else {
    // Use the normal category method for other types
    sbcSetIds =
      sets.categories.filter((f) => f.name == getSettings(0, 0, "sbcType"))[0]
        ?.setIds || [];
  }

  let allSbcSets = sets.sets
    .filter((f) => sbcSetIds.includes(f.id) && !f.isComplete())
    .reverse();
  if (getSettings(0, 0, "sbcType") === "Favourites") {
    allSbcSets = allSbcSets.sort((a, b) => b.timesCompleted - a.timesCompleted);
  }
  let sbcTiles = [];
  allSbcSets.forEach((set) => {
    var t = new UTSBCSetTileView();
    t.init(), (t.title = set.name), t.setData(set), t.render();
    let pb = t._progressBar;
    let sbcDiv = document.createElement("div");
    var img = document.createElement("img");
    img.setAttribute("src", t._setImage.src);
    img.width = img.height = "64";
    sbcDiv.appendChild(img);
    if (!t.data.isSingleChallenge) {
      sbcDiv.appendChild(pb.getRootElement());
    }
    var label = document.createElement("span");
    label.innerHTML = set.name;
    sbcDiv.appendChild(label);
    const status = document.createElement("small");
    status.className = "fcx-sbc-catalog-status";
    status.textContent = getSbcCatalogStatus(set).label;
    sbcDiv.appendChild(status);

    //     console.log(set)

    sbcTiles.push(
      createNavButton(
        `navSBC${set.id}`,
        sbcDiv.outerHTML,
        () => openSbcDetailsModal(set, t._setImage.src, sets.sets),
        { background: "none" }
      )
    );
  });
  return sbcTiles;
};

const openSbcDetailsModal = async (set, imageUrl, availableSets = []) => {
  const challengeResponse = await getChallenges(set);
  const challenges = [...(challengeResponse?.challenges || [])].sort(
    (left, right) => left.priority - right.priority
  );
  let selectedChallenge = challenges.find(
    (challenge) => challenge.status !== "COMPLETED"
  );
  const repeatability = getSbcRepeatability(set);
  const remainingLabel =
    repeatability.kind === "unlimited"
      ? "无限"
      : repeatability.kind === "finite"
        ? String(repeatability.remaining)
        : "无法读取";
  const showSetAction = challenges.length > 1 && !set.isSingleChallenge;
  const supportsSpecialFallback = challenges.some((challenge) =>
    hasSupportedSpecialRequirement(readSbcChallengeRequirements(challenge))
  );

  const content = document.createElement("div");
  const completed = challenges.filter(
    (challenge) => challenge.status === "COMPLETED"
  ).length;
  const summary = document.createElement("div");
  summary.className = "fcx-sbc-summary";
  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = "";
  const summaryCopy = document.createElement("div");
  const summaryTitle = document.createElement("strong");
  summaryTitle.textContent = set.name;
  const summaryMeta = document.createElement("p");
  summaryMeta.className = "fcx-choice-meta";
  summaryMeta.textContent = `${completed} / ${challenges.length} ${uiText.autoSbc.completed} · 已完成 ${set.timesCompleted || 0} 次 · 剩余可重复次数 ${remainingLabel}`;
  summaryCopy.append(summaryTitle, summaryMeta);
  summary.append(image, summaryCopy);

  const layout = document.createElement("div");
  layout.className = "fcx-sbc-layout";
  const challengeList = document.createElement("div");
  challengeList.className = "fcx-challenge-list";
  const requirementsPanel = document.createElement("div");
  requirementsPanel.className = "fcx-requirements-panel";
  const requirementTitle = document.createElement("strong");
  requirementTitle.textContent = uiText.autoSbc.challengeRequirements;
  requirementsPanel.appendChild(requirementTitle);
  const challengeButtons = [];
  const candidateRulesHost = document.createElement("div");
  let candidateRulesEditor = null;
  let candidateRulesRestoreRequested = false;
  const readModalRules = () => resolveCandidateRules(
    Number(set.id),
    Number(selectedChallenge?.id || 0),
    (setId, challengeId, key) => fcxSettingsStore.getValue(setId, challengeId, key),
    (setId, challengeId, key) => fcxSettingsStore.getOwnValue(setId, challengeId, key)
  );
  const renderCandidateRules = () => {
    candidateRulesRestoreRequested = false;
    candidateRulesEditor = createCandidateRulesEditor({
      value: readModalRules(),
      onChange: () => {},
      onRestore: () => {
        candidateRulesRestoreRequested = true;
        return resolveCandidateRules(
          Number(set.id),
          Number(selectedChallenge?.id || 0),
          (setId, challengeId, key) =>
            fcxSettingsStore.getValue(setId, challengeId, key),
          (setId, challengeId, key) =>
            Number(setId) === Number(set.id)
              ? undefined
              : fcxSettingsStore.getOwnValue(setId, challengeId, key)
        );
      },
    });
    candidateRulesHost.replaceChildren(candidateRulesEditor.element);
  };

  const renderRequirements = (challenge) => {
    requirementsPanel.replaceChildren(requirementTitle);
    if (!challenge) {
      const hint = document.createElement("p");
      hint.className = "fcx-choice-meta";
      hint.textContent = uiText.autoSbc.selectChallengeHint;
      requirementsPanel.appendChild(hint);
      return;
    }
    const view = new UTSBCChallengeRequirementsView();
    view.renderChallengeRequirements(challenge, true);
    requirementsPanel.appendChild(view.getRootElement());
  };

  challenges.forEach((challenge) => {
    const isComplete = challenge.status === "COMPLETED";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fcx-challenge-row";
    button.disabled = isComplete;
    button.setAttribute(
      "aria-pressed",
      String(selectedChallenge?.id === challenge.id)
    );
    const name = document.createElement("span");
    name.className = "fcx-choice-title";
    name.textContent = challenge.name;
    const status = document.createElement("span");
    status.className = "fcx-choice-meta";
    status.textContent = isComplete
      ? uiText.autoSbc.completed
      : uiText.autoSbc.incomplete;
    button.append(name, status);
    button.addEventListener("click", () => {
      selectedChallenge = challenge;
      challengeButtons.forEach(({ element, challenge: candidate }) => {
        element.setAttribute(
          "aria-pressed",
          String(candidate.id === challenge.id)
        );
      });
      renderRequirements(challenge);
      renderCandidateRules();
    });
    challengeButtons.push({ element: button, challenge });
    challengeList.appendChild(button);
  });
  renderRequirements(selectedChallenge);
  renderCandidateRules();
  layout.append(challengeList, requirementsPanel);
  const ignoreValueRow = document.createElement("label");
  ignoreValueRow.className = "fcx-sbc-run-option";
  const ignoreValueCopy = document.createElement("span");
  const ignoreValueTitle = document.createElement("strong");
  ignoreValueTitle.textContent = uiText.autoSbc.ignoreValue;
  const ignoreValueHelp = document.createElement("small");
  ignoreValueHelp.textContent = uiText.autoSbc.ignoreValueHelp;
  ignoreValueCopy.append(ignoreValueTitle, ignoreValueHelp);
  const ignoreValueSwitch = document.createElement("span");
  ignoreValueSwitch.className = "fcx-switch";
  const ignoreValueInput = document.createElement("input");
  ignoreValueInput.type = "checkbox";
  ignoreValueInput.checked = true;
  ignoreValueInput.setAttribute("aria-label", uiText.autoSbc.ignoreValue);
  const ignoreValueTrack = document.createElement("span");
  ignoreValueTrack.className = "fcx-switch__track";
  ignoreValueSwitch.append(ignoreValueInput, ignoreValueTrack);
  ignoreValueRow.append(ignoreValueCopy, ignoreValueSwitch);

  const savedFallback = fcxSpecialFallbackStore.get();
  const createFallbackSection = () => {
    const section = document.createElement("section");
    section.className = "fcx-sbc-fallback";
    const header = document.createElement("div");
    header.className = "fcx-sbc-fallback__header";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = "缺周黑自动补给";
    const help = document.createElement("small");
    help.textContent = "候选池缺少所需周黑或特殊卡时，先完成补给、开包并重试一次。";
    copy.append(title, help);
    const toggle = createFcxSwitchControl(document, {
      label: "启用缺周黑自动补给",
      checked: savedFallback.enabled,
    });
    const enabled = toggle.input;
    header.append(copy, toggle.element);

    const controls = document.createElement("div");
    controls.className = "fcx-sbc-fallback__controls";
    const selectLabel = document.createElement("label");
    selectLabel.innerHTML = "<span>补给 SBC</span>";
    const select = document.createElement("select");
    const choices = availableSets.filter(
      (candidate) => Number(candidate.id) !== Number(set.id)
    );
    const selectedChoiceExists = choices.some(
      (candidate) => Number(candidate.id) === Number(savedFallback.setId)
    );
    if (!selectedChoiceExists) {
      const option = document.createElement("option");
      option.value = String(savedFallback.setId);
      option.textContent = `84+ TOTW 升级（配置 ID ${savedFallback.setId}）`;
      select.appendChild(option);
    }
    for (const candidate of choices) {
      const option = document.createElement("option");
      option.value = String(candidate.id);
      option.textContent = candidate.name;
      select.appendChild(option);
    }
    select.value = String(savedFallback.setId);
    selectLabel.appendChild(select);

    const runsLabel = document.createElement("label");
    runsLabel.innerHTML = "<span>每次补给次数</span>";
    const runs = document.createElement("input");
    runs.type = "number";
    runs.min = "1";
    runs.step = "1";
    runs.value = String(savedFallback.runs);
    runsLabel.appendChild(runs);
    controls.append(selectLabel, runsLabel);
    section.append(header, controls);

    const read = () => {
      const saved = fcxSpecialFallbackStore.save({
        enabled: enabled.checked,
        setId: Number(select.value) || 1017,
        runs: Math.max(1, Math.trunc(Number(runs.value) || 1)),
      });
      runs.value = String(saved.runs);
      select.disabled = !saved.enabled;
      runs.disabled = !saved.enabled;
      section.classList.toggle("is-disabled", !saved.enabled);
      return saved;
    };
    enabled.addEventListener("change", read);
    select.addEventListener("change", read);
    runs.addEventListener("change", read);
    read();
    return { element: section, read };
  };
  const fallbackUi = supportsSpecialFallback ? createFallbackSection() : null;

  const createStorageFallbackSection = () => {
    const section = document.createElement("section");
    section.className = "fcx-sbc-fallback";
    const header = document.createElement("div");
    header.className = "fcx-sbc-fallback__header";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = "仓库满自动清仓";
    const help = document.createElement("small");
    help.textContent =
      "开包遇到SBC仓库已满时，按设置次数完成清仓SBC、安置未分配并继续原任务；输入 -1 持续执行。";
    copy.append(title, help);
    const saved = fcxStorageOverflowFallbackStore.get();
    const toggle = createFcxSwitchControl(document, {
      label: "启用仓库满自动清仓",
      checked: saved.enabled,
    });
    header.append(copy, toggle.element);

    const controls = document.createElement("div");
    controls.className = "fcx-sbc-fallback__controls";
    const selectLabel = document.createElement("label");
    selectLabel.innerHTML = "<span>清仓 SBC</span>";
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "0";
    placeholder.textContent = "请选择清仓 SBC";
    select.appendChild(placeholder);
    for (const candidate of availableSets) {
      const option = document.createElement("option");
      option.value = String(candidate.id);
      option.textContent = candidate.name;
      select.appendChild(option);
    }
    select.value = String(saved.setId || 0);
    selectLabel.appendChild(select);
    const runsLabel = document.createElement("label");
    runsLabel.innerHTML = "<span>每次清仓次数</span>";
    const runs = document.createElement("input");
    runs.type = "number";
    runs.min = "-1";
    runs.max = "100";
    runs.step = "1";
    runs.value = String(saved.runs || 1);
    runs.setAttribute("aria-label", "每次爆仓后执行清仓SBC的次数");
    runs.title = "输入 1–100；-1 表示持续执行";
    runsLabel.appendChild(runs);
    controls.append(selectLabel, runsLabel);
    section.append(header, controls);

    const persist = () => {
      const setId = Number(select.value) || 0;
      const selectedSet = availableSets.find(
        (candidate) => Number(candidate.id) === setId
      );
      const selectedRepeatability = selectedSet
        ? getSbcRepeatability(selectedSet)
        : null;
      const unavailable =
        !selectedSet
        || (
          selectedRepeatability?.kind === "finite"
          && selectedRepeatability.remaining <= 0
        );
      if (toggle.input.checked && (!setId || unavailable)) {
        toggle.input.checked = false;
        queueFcxNotification([
          "请先选择一个当前可用的清仓 SBC。",
          UINotificationType.NEGATIVE,
        ]);
      }
      const value = fcxStorageOverflowFallbackStore.save({
        enabled: toggle.input.checked,
        setId,
        runs: Math.trunc(Number(runs.value)) === -1
          ? -1
          : Math.min(100, Math.max(1, Math.trunc(Number(runs.value)) || 1)),
      });
      runs.value = String(value.runs);
      section.classList.toggle("is-disabled", !value.enabled);
      return value;
    };
    toggle.input.addEventListener("change", persist);
    select.addEventListener("change", persist);
    runs.addEventListener("change", persist);
    section.classList.toggle("is-disabled", !saved.enabled);
    return { element: section, read: persist };
  };
  const storageFallbackUi = createStorageFallbackSection();

  const runCountRow = document.createElement("label");
  runCountRow.className = "fcx-sbc-run-count";
  const runCountCopy = document.createElement("span");
  const runCountTitle = document.createElement("strong");
  runCountTitle.textContent = showSetAction ? "整组执行数量" : "执行数量";
  const runCountHelp = document.createElement("small");
  runCountHelp.textContent = "输入 -1 持续执行；有限次数SBC会在可用次数耗尽时停止。";
  runCountCopy.append(runCountTitle, runCountHelp);
  const runCountInput = document.createElement("input");
  runCountInput.type = "number";
  runCountInput.min = "-1";
  runCountInput.step = "1";
  runCountInput.value = "1";
  runCountInput.setAttribute("aria-label", runCountTitle.textContent);
  if (repeatability.kind === "finite") {
    runCountInput.max = String(Math.max(1, repeatability.remaining));
  } else if (repeatability.kind === "unknown") {
    runCountInput.max = "1";
  }
  runCountInput.addEventListener("change", () => {
    let value = Math.trunc(Number(runCountInput.value));
    if (value !== -1 && value < 1) value = 1;
    runCountInput.value = String(
      effectiveRequestedRuns(value, repeatability)
    );
  });
  runCountRow.append(runCountCopy, runCountInput);
  content.append(summary, layout, candidateRulesHost, ignoreValueRow);
  if (fallbackUi) content.append(fallbackUi.element);
  content.append(storageFallbackUi.element);
  content.append(runCountRow);

  const modal = openFcxModal({
    id: "fcx-sbc-details-modal",
    title: set.name,
    description: uiText.autoSbc.sbcDialogDescription,
    content,
  });
  const closeButton = createModalButton(uiText.autoSbc.close);
  const saveSetRulesButton = createModalButton("保存");
  const challengeButton = createModalButton(
    uiText.autoSbc.startChallenge,
    "fcx-button--primary"
  );
  challengeButton.disabled = !selectedChallenge;
  const setButton = showSetAction
    ? createModalButton(uiText.autoSbc.startSet)
    : null;
  const noRemainingRuns =
    repeatability.kind === "finite" && repeatability.remaining <= 0;
  challengeButton.disabled = !selectedChallenge || noRemainingRuns;
  if (setButton) setButton.disabled = noRemainingRuns;
  modal.footer.append(closeButton, saveSetRulesButton);
  if (setButton) modal.footer.append(setButton);
  modal.footer.append(challengeButton);
  closeButton.addEventListener("click", modal.close);
  const validateFallback = () => {
    const fallback = fallbackUi?.read() || { ...savedFallback, enabled: false };
    if (!fallback.enabled) return fallback;
    if (Number(fallback.setId) === Number(set.id)) {
      queueFcxNotification([
        "周黑补给 SBC 不能与当前目标 SBC 相同。",
        UINotificationType.NEGATIVE,
      ]);
      return null;
    }
    const fallbackSet = availableSets.find(
      (candidate) => Number(candidate.id) === Number(fallback.setId)
    );
    const fallbackRepeatability = fallbackSet
      ? getSbcRepeatability(fallbackSet)
      : null;
    if (
      !fallbackSet ||
      (fallbackRepeatability?.kind === "finite" &&
        fallbackRepeatability.remaining <= 0)
    ) {
      queueFcxNotification([
        "选择的周黑补给 SBC 当前不可用，请重新选择。",
        UINotificationType.NEGATIVE,
      ]);
      return null;
    }
    return fallback;
  };
  const saveCandidateRuleEdits = (scopeChallengeId) => {
    if (!candidateRulesEditor) return;
    const value = candidateRulesEditor.getValue();
    const keys = [
      "ratingRange",
      "priceRange",
      "squadRatingOvershoot",
      "commonOnly",
      "allowExtraRequiredRarityGroupPlayers",
      "specialFuelRulesEnabled",
      "specialFuelRatingRange",
      "specialFuelPriceRange",
      "specialFuelOnlyStorage",
      "specialFuelStorageRulesEnabled",
      "specialFuelStorageRatingRange",
    ];
    if (candidateRulesRestoreRequested) {
      for (const key of keys) {
        fcxSettingsStore.deleteValue(set.id, scopeChallengeId, key);
      }
    }
    for (const key of candidateRulesEditor.changedKeys()) {
      fcxSettingsStore.saveValue(set.id, scopeChallengeId, key, value[key]);
    }
    candidateRulesRestoreRequested = false;
  };
  const standaloneSaveChallengeId = () => candidateRuleStandaloneSaveChallengeId(
    showSetAction,
    selectedChallenge?.id
  );
  const showSetRulesSavedDialog = () => {
    const content = document.createElement("p");
    content.className = "fcx-modal-description";
    content.textContent = showSetAction
      ? "当前 SBC 的整组规则已保存。"
      : "当前 SBC 的规则已保存。";
    const savedModal = openFcxModal({
      id: "fcx-sbc-rules-saved-modal",
      title: "已保存",
      content,
    });
    savedModal.panel.classList.add("fcx-modal-panel--confirmation");
    const confirmButton = createModalButton("确定", "fcx-button--primary");
    confirmButton.addEventListener("click", savedModal.close);
    savedModal.footer.append(confirmButton);
    confirmButton.focus();
  };
  saveSetRulesButton.addEventListener("click", () => {
    try {
      saveCandidateRuleEdits(standaloneSaveChallengeId());
      showSetRulesSavedDialog();
    } catch (error) {
      queueFcxNotification([
        `整组规则保存失败：${error?.message || error}`,
        UINotificationType.NEGATIVE,
      ]);
    }
  });
  challengeButton.addEventListener("click", () => {
    if (!selectedChallenge) return;
    if (hasBlockingFcxTask()) {
      queueFcxNotification([
        "当前FCX任务尚未结束，请稍候。",
        UINotificationType.NEGATIVE,
      ]);
      return;
    }
    const fallback = validateFallback();
    if (!fallback) return;
    saveCandidateRuleEdits(Number(selectedChallenge.id));
    modal.close();
    queueFcxNotification([
      `${set.name} ${uiText.autoSbc.started}`,
      UINotificationType.POSITIVE,
    ]);
    const requestedRuns = showSetAction
      ? 1
      : effectiveRequestedRuns(Number(runCountInput.value), repeatability);
    if (fallback.enabled) {
      runSbcWithTotwFallback({
        set,
        challengeId: selectedChallenge.id,
        mode: "challenge",
        requestedRuns: requestedRuns,
        ignoreValue: ignoreValueInput.checked,
        autoOpen: true,
        fallback,
        wholeSetPreview: true,
      });
    } else {
      solveSBC(set.id, selectedChallenge.id, true, null, false, false, {
        ignoreValue: ignoreValueInput.checked,
        requestedRuns,
      });
    }
  });
  setButton?.addEventListener("click", () => {
    if (hasBlockingFcxTask()) {
      queueFcxNotification([
        "当前FCX任务尚未结束，请稍候。",
        UINotificationType.NEGATIVE,
      ]);
      return;
    }
    const fallback = validateFallback();
    if (!fallback) return;
    saveCandidateRuleEdits(0);
    modal.close();
    queueFcxNotification([
      `${set.name} ${uiText.autoSbc.started}`,
      UINotificationType.POSITIVE,
    ]);
    const requestedRuns = effectiveRequestedRuns(
      Number(runCountInput.value),
      repeatability
    );
    if (fallback.enabled) {
      runSbcWithTotwFallback({
        set,
        challengeId: 0,
        mode: "set",
        requestedRuns: requestedRuns,
        ignoreValue: ignoreValueInput.checked,
        autoOpen: true,
        fallback,
      });
    } else {
      solveSBC(set.id, 0, true, null, true, true, {
        ignoreValue: ignoreValueInput.checked,
        requestedRuns,
        wholeSetPreview: true,
      });
    }
  });
};

let createSBCTab = async (force = false) => {
  autoSbcRefreshPending = true;
  fcxAutoSbcSessionSnapshot.invalidate();
  document.querySelectorAll(".sbc-auto").forEach((el) => el.remove());

  if (!getSettings(0, 0, "showSbcTab")) {
    autoSbcPageRoot?.replaceChildren();
    return;
  }

  const renderRoot = autoSbcPageRoot;
  if (!renderRoot || !renderRoot.isConnected) {
    return;
  }

  const renderVersion = ++autoSbcRenderVersion;
  const syncStatus = renderRoot.parentElement?.querySelector(
    ".auto-sbc-sync-status"
  );
  if (syncStatus) syncStatus.textContent = uiText.autoSbc.syncing;
  renderRoot.setAttribute("aria-busy", "true");
  renderRoot.innerHTML = `<div class="auto-sbc-loading">${uiText.autoSbc.loading}</div>`;

  try {
    const nav = document.createElement("nav");
    nav.id = "sbcToolbar";
    nav.classList.add("auto-sbc-toolbar");
    nav.setAttribute("aria-label", uiText.navigation.autoSbc);

    const sbcData = force ? await refreshSbcCache() : await sbcSets();
    const packGroups = await loadAutoSbcPackGroups();
    const submitSnapshot = getSubmissionSnapshot();
    const routineBtn = createNavButton(
      "btnRoutineRoll",
      /* html */ `
        <div class="auto-sbc-action-copy">
          <strong>永动机滚卡</strong>
          <span>小时 ${submitSnapshot.hour}/${submitSnapshot.hourLimit} · 今日 ${submitSnapshot.day}/${submitSnapshot.dayLimit}</span>
        </div>
      `,
      () => openRoutineCenter(),
      { background: "none", color: "#fff" }
    );
    routineBtn.classList.add("auto-sbc-action--routine");

    const harvestBtn = createNavButton(
      "btnHarvestMoment",
      /* html */ `
        <div class="auto-sbc-action-copy">
          <strong>收菜时刻</strong>
          <span>${harvestMoment.getActionSummary()}</span>
        </div>
      `,
      () => harvestMoment.openDialog(),
      { background: "none", color: "#fff" }
    );
    harvestBtn.classList.add("auto-sbc-action--harvest");
    const historyBtn = createNavButton(
      "btnTaskHistory",
      `<div class="auto-sbc-action-copy"><strong>任务历史</strong><span>最近100条 · 本机保存</span></div>`,
      () => openTaskHistory(),
      { background: "none", color: "#fff" }
    );
    historyBtn.classList.add("auto-sbc-action--history");

    const actionsSection = document.createElement("section");
    actionsSection.classList.add("auto-sbc-section");
    const actionsTitle = document.createElement("h2");
    actionsTitle.classList.add("auto-sbc-section-title");
    actionsTitle.textContent = uiText.autoSbc.actionsTitle;
    const actionGrid = document.createElement("div");
    actionGrid.classList.add("auto-sbc-action-grid");
    actionGrid.append(routineBtn, harvestBtn, historyBtn);

    const packList = createPackList(packGroups);
    if (packList) actionGrid.appendChild(packList);

    const categoryPicker = await createCategoryPicker(sbcData);
    if (categoryPicker) actionGrid.appendChild(categoryPicker);

    actionsSection.appendChild(actionsTitle);
    actionsSection.appendChild(actionGrid);
    nav.appendChild(actionsSection);

    const sbcSection = document.createElement("section");
    sbcSection.classList.add("auto-sbc-section");
    const sbcTitle = document.createElement("h2");
    sbcTitle.classList.add("auto-sbc-section-title");
    sbcTitle.textContent = uiText.autoSbc.sbcListTitle;
    const sbcDiv = document.createElement("div");
    sbcDiv.classList.add("auto-sbc-set-grid");
    const sbcTiles = (await createSBCButtons(sbcData)) || [];
    if (sbcTiles.length) {
      sbcTiles.forEach((tile) => sbcDiv.appendChild(tile));
    } else {
      sbcDiv.innerHTML = `<div class="auto-sbc-empty">${uiText.autoSbc.emptySbcs}</div>`;
    }
    sbcSection.appendChild(sbcTitle);
    sbcSection.appendChild(sbcDiv);
    nav.appendChild(sbcSection);

    if (
      renderVersion !== autoSbcRenderVersion ||
      renderRoot !== autoSbcPageRoot ||
      !renderRoot.isConnected
    ) {
      return;
    }
    fcxAutoSbcSessionSnapshot.set(renderVersion, sbcData, packGroups);
    renderRoot.replaceChildren(nav);
    renderRoot.setAttribute("aria-busy", "false");
    if (syncStatus) syncStatus.textContent = uiText.autoSbc.synced;
    autoSbcRefreshPending = false;
    return true;
  } catch (error) {
    if (
      renderVersion === autoSbcRenderVersion &&
      renderRoot === autoSbcPageRoot &&
      renderRoot.isConnected
    ) {
      fcxAutoSbcSessionSnapshot.invalidate();
      renderRoot.innerHTML = `<div class="auto-sbc-error">${uiText.autoSbc.loadFailed}</div>`;
      renderRoot.setAttribute("aria-busy", "false");
      if (syncStatus) syncStatus.textContent = uiText.autoSbc.syncFailed;
    }
    console.error("Failed to render Auto SBC page", error);
    return false;
  }
};
