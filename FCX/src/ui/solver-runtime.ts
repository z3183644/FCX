// @ts-nocheck
// FCX compatibility runtime for the EA Web App.
const resetTaskCancellation = () => {
  runtimeState.cancelRequested = false;
};

const requestTaskCancellation = () => {
  runtimeState.cancelRequested = true;
  if (runtimeState.activeRoutineExecution) {
    runtimeState.activeRoutineExecution.cancelled = true;
    runtimeState.activeRoutineExecution.stopKind = "cancelled";
    runtimeState.activeRoutineExecution.stopReason = "用户结束了永动机滚卡任务。";
  }
};

const hasBlockingFcxTask = () =>
  Boolean(
    runtimeState.activeRoutineExecution ||
      runtimeState.activeSbcExecution ||
      runtimeState.packRunActive ||
      runtimeState.academyRunActive
  );

const settleTaskCancellationIfIdle = () => {
  if (
    runtimeState.cancelRequested === true &&
    runtimeState.taskOverlayHolds === 0 &&
    !hasBlockingFcxTask()
  ) {
    runtimeState.cancelRequested = false;
    console.info("[FCX][Task] 已清理结束任务状态，页面读取已恢复");
  }
};

const isTaskCancellationRequested = () => {
  settleTaskCancellationIfIdle();
  return runtimeState.cancelRequested === true;
};

const createTaskEndOverlayButton = () => {
  mountTaskEndButton(() => {
    requestTaskCancellation();
    clearInterval(runtimeState.countDownInterval);
    reportOperationStatus(
      runtimeState.academyRunActive
        ? "EVO"
        : runtimeState.packRunActive
          ? "Pack"
          : "SBC",
      "正在安全结束当前任务"
    );
  });
};

const holdTaskOverlay = () => {
  const isFirstHold = runtimeState.taskOverlayHolds === 0;
  runtimeState.taskOverlayHolds += 1;
  if (isFirstHold) {
    runtimeState.taskShieldOwned = fcxTaskShield.acquire();
    runtimeState.taskShieldUsesFallback = !runtimeState.taskShieldOwned;
    console.info("[FCX][Overlay] task shield acquired", {
      native: runtimeState.taskShieldOwned,
      holds: runtimeState.taskOverlayHolds,
    });
  }
  showLoader(true);
};

const releaseTaskOverlay = () => {
  if (runtimeState.taskOverlayHolds === 0) return;
  runtimeState.taskOverlayHolds = Math.max(
    0,
    runtimeState.taskOverlayHolds - 1
  );
  if (runtimeState.taskOverlayHolds > 0) {
    showLoader(true);
    return;
  }

  try {
    fcxTaskShield.release();
  } finally {
    runtimeState.taskShieldOwned = false;
    runtimeState.taskShieldUsesFallback = false;
    hideLoader(true);
    settleTaskCancellationIfIdle();
    queueMicrotask(settleTaskCancellationIfIdle);
    console.info("[FCX][Overlay] task shield released");
  }
};

const showLoader = (countdown = false) => {
  ensureTaskOverlayRoot();
  setTaskOverlayFallbackActive(
    runtimeState.taskOverlayHolds > 0 &&
      runtimeState.taskShieldUsesFallback === true
  );
  if (countdown || runtimeState.taskOverlayHolds > 0) {
    createTaskEndOverlayButton();
  } else {
    removeLegacyTaskControls();
    removeTaskEndButton();
  }

  const loaderIcon = document.querySelector(".loaderIcon");
  if (loaderIcon) {
    loaderIcon.style.display = "block";
  }
};
const hideLoader = (force = false) => {
  if (runtimeState.taskOverlayHolds > 0) {
    void force;
    ensureTaskOverlayRoot();
    setTaskOverlayFallbackActive(runtimeState.taskShieldUsesFallback === true);
    createTaskEndOverlayButton();
    if (isTaskCancellationRequested()) {
      reportOperationStatus("SBC", "正在安全结束当前任务");
    }
    return;
  }
  clearOperationStatus();
  removeLegacyTaskControls();
  removeTaskEndButton();
  removeTaskOverlayRoot();

  const loaderIcon = document.querySelector(".loaderIcon");
  if (loaderIcon) {
    loaderIcon.style.removeProperty("display");
  }
  clearInterval(runtimeState.countDownInterval);
};
const showNotification = function (
  message,
  type = UINotificationType.POSITIVE
) {
  const localizedMessage = localizeFcxNotification(message);
  if (localizedMessage !== String(message ?? "")) {
    console.log("[FCX][Notification]", { raw: message, localizedMessage });
  }
  services.Notification.queue([localizedMessage, type]);
};
const queueFcxNotification = function (payload, explicitType = undefined) {
  showNotification(
    Array.isArray(payload) ? payload[0] : payload,
    explicitType ?? payload?.[1] ?? UINotificationType.POSITIVE
  );
};
const getCurrentViewController = () => {
  return getAppMain()
    .getRootViewController()
    .getPresentedViewController()
    .getCurrentViewController();
};
const getControllerInstance = () => {
  return getCurrentViewController().getCurrentController()
    .childViewControllers[0];
};

const requestSbcSets = async (requestOptions = {}) => {
  const response = await executeFcxEaRequest(
    () => services.SBC.requestSets(),
    "读取SBC列表",
    { scope: "SBC", ...requestOptions }
  );
  return response?.data ?? response?.response?.data ?? response?.response;
};

let sbcSets = async function (force = false) {
  return fcxSbcCache.getCatalog(requestSbcSets, force);
};

const requestSbcChallenges = async (set, requestOptions = {}) => {
  const response = await executeFcxEaRequest(
    () => services.SBC.requestChallengesForSet(set),
    `读取SBC ${set?.id ?? "未知"}的挑战`,
    { scope: "SBC", ...requestOptions }
  );
  return response?.data ?? response?.response?.data ?? response?.response;
};

let getChallenges = async function (set, force = false) {
  return fcxSbcCache.getChallenges(
    Number(set.id),
    () => requestSbcChallenges(set),
    force
  );
};

const invalidateSbcCache = (setId = undefined, options = {}) => {
  fcxSbcCache.invalidate(setId, options);
};

const isFreshSbcStateProbe = (requestOptions = {}) =>
  requestOptions.freshState === true || requestOptions.resetThrottleOnSuccess === false;

const refreshSbcCache = async () => {
  invalidateSbcCache(undefined, { catalog: true });
  services.SBC.repository.reset();
  return sbcSets();
};

const mergeSbcCatalogSnapshot = (freshCatalog) => {
  const cached = fcxSbcCache.peekCatalog();
  if (!cached || !freshCatalog) {
    if (freshCatalog) fcxSbcCache.replaceCatalog(freshCatalog);
    return;
  }
  const cachedSets = Array.isArray(cached.sets) ? cached.sets : [];
  const freshSets = Array.isArray(freshCatalog.sets) ? freshCatalog.sets : [];
  const freshById = new Map(freshSets.map((set) => [Number(set.id), set]));
  const mergedSets = cachedSets.map((set) => freshById.get(Number(set.id)) || set);
  for (const set of freshSets) {
    if (!mergedSets.some((candidate) => Number(candidate.id) === Number(set.id))) {
      mergedSets.push(set);
    }
  }
  fcxSbcCache.replaceCatalog({ ...cached, ...freshCatalog, sets: mergedSets });
};

const loadChallengeOnce = async (currentChallenge, requestOptions = {}) => {
  const response = await executeFcxEaRequest(
    () => services.SBC.loadChallenge(currentChallenge),
    `加载挑战 ${currentChallenge?.id ?? "未知"}`,
    { scope: "SBC", ...requestOptions }
  );
  return response?.data ?? response?.response?.data ?? response?.response;
};

let loadChallenge = async function (currentChallenge, requestOptions = {}) {
  if (!currentChallenge) {
    throw new Error("无法加载SBC挑战：挑战实体不存在");
  }
  return loadChallengeOnce(currentChallenge, requestOptions).catch((error) => {
    throw error instanceof Error
      ? error
      : new Error(`加载挑战 ${currentChallenge.id} 失败`);
  });
};

const getSetChallenges = (set) => {
  try {
    const challenges = set?.getChallenges?.();
    return Array.isArray(challenges) ? challenges : [];
  } catch (error) {
    console.warn("[FCX][SBC] 无法读取集合内部挑战", error);
    return [];
  }
};

const getChallengeResponseItems = (response) =>
  Array.isArray(response?.challenges) ? response.challenges : [];

const readFreshSbcExecutionState = async (sbcId, requestOptions = {}) => {
  const numericSetId = Number(sbcId);
  if (!Number.isSafeInteger(numericSetId) || numericSetId <= 0) {
    throw new Error("SBC集合编号无效，请重新选择SBC");
  }
  const freshProbe = isFreshSbcStateProbe(requestOptions);
  const cachedCatalog = fcxSbcCache.peekCatalog();
  const catalog = freshProbe || !cachedCatalog
    ? await requestSbcSets(requestOptions)
    : cachedCatalog;
  const repositorySets = services.SBC.repository.getSets?.() || [];
  const sbcSet =
    catalog?.sets?.find((set) => Number(set.id) === numericSetId) ||
    repositorySets.find((set) => Number(set.id) === numericSetId);
  if (!sbcSet) {
    throw new Error(`SBC集合 ${numericSetId} 当前不可用，请刷新自动SBC页面`);
  }
  const response = freshProbe
    ? await requestSbcChallenges(sbcSet, requestOptions)
    : await getChallenges(sbcSet);
  if (freshProbe || !cachedCatalog) mergeSbcCatalogSnapshot(catalog);
  const challenges = getChallengeResponseItems(response);
  if (freshProbe) fcxSbcCache.replaceChallenges(numericSetId, { ...response, challenges });
  return {
    set: sbcSet,
    challenges,
  };
};

const normalizeInitialSbcExecutionState = (sbcId, initialState) => {
  if (!initialState) return undefined;
  const numericSetId = Number(sbcId);
  if (Number(initialState.set?.id) !== numericSetId) {
    throw new Error(
      `永动机目标校验异常：配置SBC ${numericSetId}，实际读取SBC ${initialState.set?.id ?? "未知"}`
    );
  }
  return {
    set: initialState.set,
    challenges: Array.isArray(initialState.challenges) ? initialState.challenges : [],
  };
};

const resolveExecutableSbcFromState = async (sbcId, challengeId, freshState) => {
  const numericSetId = Number(sbcId);
  const sbcSet = freshState.set;
  const responseChallenges = freshState.challenges;
  const uncompletedChallenges = responseChallenges.filter(
    (challenge) => challenge.status !== "COMPLETED"
  );
  const numericChallengeId = Number(challengeId);
  const resolvedChallengeId =
    numericChallengeId === 0
      ? Number(uncompletedChallenges.at(-1)?.id)
      : numericChallengeId;
  if (!Number.isFinite(resolvedChallengeId)) {
    throw new Error("该SBC没有可执行的未完成挑战");
  }

  let challenge = responseChallenges.find(
    (item) => Number(item.id) === resolvedChallengeId
  );
  if (!challenge) throw new Error(`当前集合中找不到挑战 ${resolvedChallengeId}`);
  if (challenge.status === "COMPLETED") throw new Error(`挑战 ${resolvedChallengeId} 已经完成`);

  const loadedChallenge = await loadChallenge(challenge);
  const refreshedAttachedChallenges = getSetChallenges(sbcSet);
  challenge =
    refreshedAttachedChallenges.find(
      (item) => Number(item.id) === resolvedChallengeId && item.squad
    ) ||
    (Number(loadedChallenge?.id) === resolvedChallengeId && loadedChallenge?.squad
      ? loadedChallenge
      : challenge);
  if (!challenge?.squad) {
    throw new Error(`挑战 ${resolvedChallengeId} 的阵容数据尚未加载，请重试`);
  }

  console.log("[FCX][SBC] executable entity check", {
    setId: numericSetId,
    challengeId: resolvedChallengeId,
    attachedChallengeIds: refreshedAttachedChallenges.map((item) => item.id),
    responseChallengeIds: responseChallenges.map((item) => item.id),
    hasSquad: Boolean(challenge.squad),
  });
  return {
    setId: numericSetId,
    challengeId: resolvedChallengeId,
    set: sbcSet,
    challenge,
    squad: challenge.squad,
    challenges: responseChallenges,
  };
};

const resolveExecutableSbc = async (sbcId, challengeId = 0) => {
  const numericSetId = Number(sbcId);
  const freshState = await readFreshSbcExecutionState(numericSetId, { freshState: true });
  return resolveExecutableSbcFromState(numericSetId, challengeId, freshState);
};

const readSbcChallengeRequirements = (challenge) =>
  (challenge?.eligibilityRequirements || []).flatMap((eligibility) => {
    const collection = eligibility?.kvPairs?._collection || {};
    const key = Object.keys(collection)[0];
    if (key === undefined) return [];
    const rawScope = eligibility.scope;
    const scope =
      rawScope === "GREATER" || rawScope === "LOWER" || rawScope === "EXACT"
        ? rawScope
        : SBCEligibilityScope[rawScope];
    const mappedKey = SBCEligibilityKey[key] || key;
    const rawValues = collection[key];
    return [{
      scope,
      count: Number(eligibility.count) || 0,
      requirementKey: mappedKey,
      eligibilityValues: Array.isArray(rawValues) ? rawValues : [rawValues],
    }];
  });

let fetchSBCData = async (executableSbc) => {
  const sbcSet = executableSbc.set;
  const _challenge = executableSbc.challenge;
  const challenges = executableSbc.challenges;
  let awards = [];

  let uncompletedChallenges = challenges.filter(
    (f) => f.status != "COMPLETED"
  );
  if (uncompletedChallenges.length == 0) {
    showNotification("SBC not available", UINotificationType.NEGATIVE);
    createSBCTab();
    return null;
  }
  if (uncompletedChallenges.length == 1) {
    awards = sbcSet.awards
      .filter((f) => f.isPack || f.isItem)
      .map((m) => m.value);
  }

  const challengeRequirements = readSbcChallengeRequirements(_challenge);

  // Add SBC and challenge names to the loader display
  return {
    constraints: challengeRequirements,
    formation: _challenge.squad._formation.generalPositions.map((m, i) =>
      _challenge.squad.simpleBrickIndices.includes(i) ? -1 : m
    ),
    challengeId: _challenge.id,
    setId: _challenge.setId,
    brickIndices: _challenge.squad.simpleBrickIndices,
    finalSBC: uncompletedChallenges.length == 1,
    currentSolution: _challenge.squad._players
      .map((m) => m._item._metaData?.id)
      .slice(0, 11),
    subs: _challenge.squad._players
      .map((m) => readPlayerDefinitionId(m._item))
      .slice(11, 99)
      .filter((f) => f > 0),
    awards: _challenge.awards
      .filter((f) => f.type == "pack")
      .map((m) => m.value)
      .concat(awards),
    setAward: sbcSet.awards,
    sbcName: sbcSet.name,
    challengeName: _challenge.name,
  };
};
const removeRatingCountUI = () => {
  document.getElementById("rating-count-ui")?.remove();
  document.getElementById("rating-count-anim-style")?.remove();
};

const ratingCountUI = async () => {
  if (!getSettings(0, 0, "ratingUI")) {
    removeRatingCountUI();
    return;
  }
  // fetch current club players and storage players
  const clubPlayers = await fetchPlayers();
  const storagePlayers = await getStoragePlayers();

  // helper to count by rating bins
  const countByRating = (arr) => {
    return countPlayersByRating(arr);
  };

  const clubCounts = countByRating(
    clubPlayers.filter((item) => item.loans < 0)
  );
  const storageCounts = countByRating(storagePlayers);
  const allRatings = Array.from(
    new Set([...Object.keys(clubCounts), ...Object.keys(storageCounts)])
  )
    // remove the "total" key from sorting
    .filter((key) => key !== "total")
    // sort by numeric value (strip leading "<" if present)
    .sort((a, b) => {
      const parseKey = (x) => {
        if (typeof x === "string" && x.startsWith("<")) {
          return parseInt(x.substring(1), 10);
        }
        return Number(x);
      };
      return parseKey(b) - parseKey(a);
    });
  // put "total" at the end
  allRatings.push("total");
  // inject CSS for plus/minus flash
  if (!document.getElementById("rating-count-anim-style")) {
    const style = document.createElement("style");
    style.id = "rating-count-anim-style";
    style.textContent = `
          .delta-plus   { animation: plusAnim   3s; }
          .delta-minus  { animation: minusAnim  3s; }
          @keyframes plusAnim  { from { background: #4caf50; } to { background: transparent; } }
          @keyframes minusAnim { from { background: #f44336; } to { background: transparent; } }
        `;
    document.head.appendChild(style);
  }
  // override the default 0.6s animation so cells stay highlighted for 3 seconds
  const animStyle = document.getElementById("rating-count-anim-style");
  if (animStyle) {
    animStyle.textContent = `
          .delta-plus   { animation: plusAnim   3s forwards; }
          .delta-minus  { animation: minusAnim  3s forwards; }
          @keyframes plusAnim  { from { background: #4caf50; } to { background: transparent; } }
          @keyframes minusAnim { from { background: #f44336; } to { background: transparent; } }
        `;
  }
  // create container if missing
  let container = document.getElementById("rating-count-ui");
  if (!container) {
    container = document.createElement("div");
    container.id = "rating-count-ui";
    container.style.cssText = `
          position: fixed; bottom: 0; left: 6.5rem;  right: 6.5rem;
          background: rgba(0,0,0,0.8); color: #fff;
          font-size: 12px; padding: 8px; z-index: 9999;
          overflow-x: auto; white-space: nowrap;
        `;
    const header = [
      '<th data-rating="type">类型</th>',
      ...allRatings.map(
        (rating) =>
          `<th data-rating="${rating}">${rating === "total" ? "总计" : rating}</th>`
      ),
    ].join("");
    const clubRow = ["俱乐部", ...allRatings.map((r) => clubCounts[r] || 0)]
      .map((x) => `<td>${x}</td>`)
      .join("");
    const storageRow = [
      "仓库",
      ...allRatings.map((r) => storageCounts[r] || 0),
    ]
      .map((x) => `<td>${x}</td>`)
      .join("");
    container.innerHTML = `
          <button type="button" class="fcx-overlay-close" aria-label="关闭俱乐部和仓库统计">×</button>
          <table style="width:100%;border-collapse:collapse;text-align:center">
            <thead><tr>${header}</tr></thead>
            <tbody>
              <tr>${clubRow}</tr>
              <tr>${storageRow}</tr>
            </tbody>
          </table>
        `;
    container.querySelector(".fcx-overlay-close")?.addEventListener("click", () => {
      saveSettings(0, 0, "ratingUI", false);
      removeRatingCountUI();
    });
    const target = document.querySelector(
      "section.ut-navigation-container-view"
    );
    if (target) {
      target.appendChild(container);
    } else {
      console.warn("ut-navigation-container-view not found");
    }
    return;
  }

  // update existing table cells with animations
  const table = container.querySelector("table");
  if (!table) return;
  const ths = Array.from(table.querySelectorAll("thead th")).map(
    (e) => e.dataset.rating || e.textContent
  );
  const bodyRows = table.tBodies[0].rows;
  const clubRow = bodyRows[0];
  const storageRow = bodyRows[1];

  allRatings.forEach((r) => {
    const col = ths.indexOf(r.toString());
    if (col > -1) {
      // Removed offset: column index now matches the cell index directly
      const clubCell = clubRow.cells[col];
      const storageCell = storageRow.cells[col];
      const oldClub = parseInt(clubCell.textContent) || 0;
      const newClub = clubCounts[r] || 0;
      if (newClub !== oldClub) {
        clubCell.textContent = newClub;
        clubCell.classList.add(
          newClub > oldClub ? "delta-plus" : "delta-minus"
        );
        setTimeout(
          () => clubCell.classList.remove("delta-plus", "delta-minus"),
          3000
        );
      }
      const oldSto = parseInt(storageCell.textContent) || 0;
      const newSto = storageCounts[r] || 0;
      if (newSto !== oldSto) {
        storageCell.textContent = newSto;
        storageCell.classList.add(
          newSto > oldSto ? "delta-plus" : "delta-minus"
        );
        setTimeout(
          () => storageCell.classList.remove("delta-plus", "delta-minus"),
          3000
        );
      }
    }
  });
};

const resolveEaHomeRoot = (view) => {
  const candidate = view?.getRootElement?.()
    ?? view?.__root
    ?? view?._rootElement
    ?? view?._root
    ?? view?.root;
  return candidate?.nodeType === 1 ? candidate : undefined;
};

const markEaHomeReady = (view) => {
  runtimeState.eaHomeRoot = resolveEaHomeRoot(view);
  runtimeState.eaHomeReadyAt = Date.now();
  console.info("[FCX][Routine] EA首页已完成初始化", {
    connected: runtimeState.eaHomeRoot?.isConnected === true,
  });
  queueMicrotask(() => {
    if (typeof resumePendingRoutineRecovery === "function") {
      void resumePendingRoutineRecovery();
    }
  });
};

const futHomeOverride = async () => {
  const homeHubInit = UTHomeHubView.prototype.init;
  UTHomeHubView.prototype.init = function (...args) {
    const result = homeHubInit.apply(this, args);
    createSBCTab();
    if (getSettings(0, 0, "collectConcepts")) {
      void getConceptPlayers().then((conceptPlayers) => {
        runtimeState.conceptPlayers = conceptPlayers;
      });
    }
    requestAnimationFrame(() => markEaHomeReady(this));
    return result;
  };
};

let count;

function countDown() {
  count = Math.max(0, count - 1);
}
let getSBCPrice = (
  item,
  sbcId = 0,
  challengeId = 0,
  runOptions = undefined
) => {
  if (isItemFixed(item)) {
    return 1;
  }
  const ignoreValue =
    runOptions?.ignoreValue === true ||
    runtimeState.activeSbcExecution?.options?.ignoreValue === true;
  const marketPrice = ignoreValue ? null : getPrice(item);
  const ratingReferencePrice = ignoreValue
    ? null
    : getPrice({ definitionId: item.rating + "_CBR" });
  const basePrice = Math.max(marketPrice, ratingReferencePrice, 100);
  if (marketPrice == -1) {
    return basePrice * 1.5;
  }
  if (!ignoreValue && item.concept) {
    return getSettings(0, 0, "conceptPremium") * basePrice;
  }
  const cardType =
    (item.isSpecial()
      ? ""
      : services.Localization.localize(
          "search.cardLevels.cardLevel" + item.getTier()
        ) + " ") +
    services.Localization.localize("item.raretype" + item.rareflag);
  if (!ignoreValue && cardType.includes("volution")) {
    return getSettings(0, 0, "evoPremium") * basePrice;
  }
  return calculateSbcPrice(
    {
      marketPrice,
      ratingReferencePrice,
      rating: item.rating,
      fixed: false,
      concept: false,
      evolution: false,
      duplicate:
        getSettings(sbcId, challengeId, "useDupes") === true &&
        item.duplicateId > 0,
      storage:
        getSettings(sbcId, challengeId, "useDupes") === true &&
        Boolean(item?.isStorage),
      tradeable: item.isTradeable(),
    },
    {
      duplicateDiscount: getSettings(sbcId, challengeId, "duplicateDiscount"),
      untradeableDiscount: getSettings(
        sbcId,
        challengeId,
        "untradeableDiscount"
      ),
      conceptPremium: getSettings(0, 0, "conceptPremium"),
      evoPremium: getSettings(0, 0, "evoPremium"),
    }
  );
};
