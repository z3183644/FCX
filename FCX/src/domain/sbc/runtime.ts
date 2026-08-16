// @ts-nocheck
// FCX compatibility runtime for the EA Web App.

const resolveTaskAutoSubmitId = (options, fallback) => {
  if (options?.submitStrategy === "never") return 0;
  if (options?.submitStrategy === "feasible") return 1;
  if (options?.submitStrategy === "optimal") return 4;
  return Number(fallback);
};

const resolveTaskAutoOpen = (options, fallback) =>
  typeof options?.autoOpenRewards === "boolean"
    ? options.autoOpenRewards
    : fallback === true;

let solveSBC = async (
  sbcId,
  challengeId,
  autoSubmit = false,
  repeat = null,
  autoOpen = false,
  trynext = false,
  runOptions = undefined,
  executionContext = undefined,
  internalOptions = undefined
) => {
  if (
    Number(challengeId) === 0 &&
    trynext &&
    internalOptions?.fromSetOrchestrator !== true &&
    internalOptions?.planOnly !== true
  ) {
    return solveSbcSet(
      sbcId,
      autoSubmit,
      autoOpen,
      runOptions,
      executionContext
    );
  }
  const isNewExecution = !executionContext;
  if (
    isNewExecution &&
    (runtimeState.activeRoutineExecution ||
      runtimeState.packRunActive)
  ) {
    queueFcxNotification([
      "当前FCX任务尚未结束，请稍候。",
      UINotificationType.NEGATIVE,
    ]);
    return;
  }
  if (isNewExecution) resetTaskCancellation();
  const sbcExecution =
    executionContext || createSbcExecutionContext(runOptions);
  if (isNewExecution) runtimeState.concepts = false;
  const normalizedRunOptions = sbcExecution.options;
  sbcExecution.activeCalls += 1;
  runtimeState.activeSbcExecution = sbcExecution;
  if (isNewExecution) holdTaskOverlay();
  try {
    if (isTaskCancellationRequested()) {
      showNotification("SBC Stopped");
      sbcExecution.stoppedReason = "用户结束了SBC任务。";
      return;
    }
    showLoader(true);
    reportOperationStatus("SBC", "正在读取SBC数据");
    const initialExecutionState = normalizeInitialSbcExecutionState(
      sbcId,
      internalOptions?.initialExecutionState
    );
    const executableSbc = initialExecutionState
      ? await resolveExecutableSbcFromState(sbcId, challengeId, initialExecutionState)
      : await resolveExecutableSbc(sbcId, challengeId);
    if (sbcExecution.completedRuns === 0 && sbcExecution.activeCalls === 1) {
      sbcExecution.options.requestedRuns = effectiveRequestedRuns(
        sbcExecution.options.requestedRuns,
        getSbcRepeatability(executableSbc.set)
      );
    }
    let sbcData = await fetchSBCData(executableSbc);
    console.log(
      "Sbc Started",
      sbcData?.sbcName,
      sbcData?.challengeName,
      sbcData
    );
    await ratingCountUI();

    reportOperationStatus("SBC", `正在准备 ${sbcData?.challengeName || "SBC"}`);
    if (sbcData == null) {
      hideLoader();
      showNotification("SBC not available", UINotificationType.NEGATIVE);
      return;
    }
    const candidateRules = resolveCandidateRules(
      Number(sbcId),
      Number(sbcData.challengeId),
      (setId, scopedChallengeId, key) =>
        fcxSettingsStore.getValue(setId, scopedChallengeId, key),
      (setId, scopedChallengeId, key) =>
        fcxSettingsStore.getOwnValue(setId, scopedChallengeId, key)
    );
    let skipPriceRange = false;
    if (
      normalizedRunOptions.ignoreValue &&
      hasActivePriceRange(candidateRules.priceRange)
    ) {
      const numericSetId = Number(sbcId);
      if (!sbcExecution.priceRuleAcknowledgedSetIds.has(numericSetId)) {
        sbcExecution.awaitingPriceConfirmation = true;
        reportOperationStatus("SBC", "等待网页确认价格规则");
        let confirmed = false;
        try {
          confirmed = await confirmIgnoringPriceRules({
            setName: String(sbcData.sbcName || sbcId),
          });
        } finally {
          sbcExecution.awaitingPriceConfirmation = false;
        }
        if (!confirmed) {
          sbcExecution.stoppedReason = "已取消任务：未确认跳过价格限制。";
          reportOperationStatus("SBC", sbcExecution.stoppedReason, "error");
          return;
        }
        sbcExecution.priceRuleAcknowledgedSetIds.add(numericSetId);
      }
      skipPriceRange = true;
    }
    const requiredGroupIds = requiredRarityGroupIds(sbcData.constraints || []);
    const requiredGroupConditions = (sbcData.constraints || [])
      .filter((constraint) =>
        constraint.requirementKey === "PLAYER_RARITY_GROUP" &&
        constraint.scope !== "LOWER" &&
        Number(constraint.count || 0) > 0
      )
      .map((constraint) =>
        [...new Set((constraint.eligibilityValues || []).map(Number).filter(Number.isFinite))]
      );
    if (candidateRules.commonOnly && requiredGroupIds.length > 0) {
      sbcExecution.stoppedReason =
        `“${sbcData.challengeName || "当前挑战"}”要求特殊分组球员，但当前规则启用了“只用普通卡”。`;
      reportOperationStatus("SBC", sbcExecution.stoppedReason, "error");
      queueFcxNotification([
        sbcExecution.stoppedReason,
        UINotificationType.NEGATIVE,
      ]);
      return;
    }
    sbcData.constraints = applyFcxRarityGroupPolicy(
      sbcData.constraints || [],
      candidateRules.allowExtraRequiredRarityGroupPlayers
    );
    await dealWithUnassigned({
      ...readPackRunOptions(),
      ignoreValue: normalizedRunOptions.ignoreValue,
    });
    if (isTaskCancellationRequested()) {
      sbcExecution.stoppedReason = "用户结束了SBC任务。";
      return;
    }
    // await sendUnassignedtoTeam();
    // await swapDuplicates();
    // await sendDuplicatesToStorage();
    // await discardNonPlayerDupes();
    let players = await fetchPlayers();
    let storage = await getStoragePlayers();
    let unassigned = await fetchUnassigned(normalizedRunOptions);
    let PriceItems = normalizedRunOptions.ignoreValue ? {} : getPriceItems();
    if (getSettings(sbcId, sbcData.challengeId, "useConcepts")) {
      if (runtimeState.conceptPlayersCollected) {
        players = players.concat(
          runtimeState.conceptPlayers?.filter(
            (f) =>
              normalizedRunOptions.ignoreValue ||
              !PriceItems[f.definitionId]?.isExtinct
          )
        );
        console.log("conceptPlayers", runtimeState.conceptPlayers, runtimeState.conceptPlayers.length);
      } else {
        showNotification(
          "Still Collecting Concept Players, They will not be used for this solution",
          UINotificationType.NEGATIVE
        );
      }
    }
    showLoader(true);
    let sbcSet = executableSbc.set;

    // storage = storage.concat(unassigned)
    players = players.filter(
      (f) => !storage.map((m) => m.definitionId).includes(f?.definitionId)
    );
    players = players.concat(storage);
    players = players.filter((item) => item != undefined);
    const protectionSnapshot = await capturePlayerProtectionSnapshot();
    const candidateCountBeforeProtection = players.length;
    players = filterProtectedPlayers(players, {
      lockedDefinitionIds: protectionSnapshot.lockedDefinitionIds,
      activeSquadItemIds: protectionSnapshot.activeSquadItemIds,
      protectEvolutions: protectionSnapshot.protectEvolutions,
      protectActiveSquad: protectionSnapshot.protectActiveSquad,
    });
    const reservedItemIds = new Set(
      [...(internalOptions?.excludedItemIds || [])].map(Number)
    );
    if (reservedItemIds.size) {
      players = players.filter(
        (player) => !reservedItemIds.has(Number(player?.id))
      );
    }
    const candidateCountAfterProtection = players.length;
    console.info("[FCX][Protection] candidate filter", {
      before: candidateCountBeforeProtection,
      after: players.length,
      personaId: protectionSnapshot.personaId,
      lockedDefinitions: protectionSnapshot.lockedDefinitionIds.size,
      activeSquadItems: protectionSnapshot.activeSquadItemIds.size,
      protectEvolutions: protectionSnapshot.protectEvolutions,
      protectActiveSquad: protectionSnapshot.protectActiveSquad,
    });
    reportOperationStatus(
      "SBC",
      normalizedRunOptions.ignoreValue
        ? "已忽略球员价值，正在整理候选球员"
        : "正在整理候选球员"
    );
    await fetchPlayerPrices(players, normalizedRunOptions);
    if (isTaskCancellationRequested()) {
      sbcExecution.stoppedReason = "用户结束了SBC任务。";
      return;
    }

    let ratingRange = candidateRules.ratingRange;
    let useDupes = getSettings(sbcId, sbcData.challengeId, "useDupes");

    let duplicateIds = await fetchDuplicateIds();
    let storageIds = storage.map((m) => m.id);
    let chemUtil = new UTSquadChemCalculatorUtils();
    chemUtil.chemService = services.Chemistry;
    chemUtil.teamConfigRepo = repositories.TeamConfig;
    let sbcPlayerIds = services.SBC.repository
      .getSets()
      .filter((s) => s.id === sbcId)
      .reduce(function (e, t) {
        t = t.getChallenges().filter((f) => f.id != sbcData.challengeId);
        return (
          0 < t.length &&
            t.forEach(function (t) {
              t.squad &&
                e.push(
                  t.squad._players
                    .filter((f) => f._item.id > 0)
                    .map((m) => m._item.id)
                );
            }),
          e
        );
      }, [])
      .flat();

    players.forEach((item) => {
      item.isStorage = storageIds.includes(item?.id);
      item.isSbcPlayer = sbcPlayerIds.includes(item?.id);
      item.isDuplicate =
        duplicateIds.includes(item?.id) || unassigned.includes(item?.id);
      item.profile = chemUtil.getChemProfileForPlayer(item);
      item.normalizeClubId = chemUtil.normalizeClubId(item.teamId);
    });
    let excludeLeagues =
      getSettings(sbcId, sbcData.challengeId, "excludeLeagues") || [];
    let excludeNations =
      getSettings(sbcId, sbcData.challengeId, "excludeNations") || [];
    let excludeRarity =
      getSettings(sbcId, sbcData.challengeId, "excludeRarity") || [];
    let excludeTeams =
      getSettings(sbcId, sbcData.challengeId, "excludeTeams") || [];
    let excludeSbc =
      getSettings(sbcId, sbcData.challengeId, "excludeSbc") || false;
    let excludeObjective =
      getSettings(sbcId, sbcData.challengeId, "excludeObjective") || false;
    let excludeTradable =
      getSettings(sbcId, sbcData.challengeId, "excludeTradable") || false;
    let excludeExtinct = normalizedRunOptions.ignoreValue
      ? false
      : getSettings(sbcId, sbcData.challengeId, "excludeExtinct") || false;
    let onlyStorage =
      getSettings(sbcId, sbcData.challengeId, "onlyStorage") || false;
    let excludeSbcSquads =
      getSettings(sbcId, sbcData.challengeId, "excludeSbcSquads") || false;
    const readMarketPrice = (item) => {
      if (normalizedRunOptions.ignoreValue) return null;
      const price = Number(getPrice(item));
      return Number.isFinite(price) && price > 0 ? price : null;
    };
    const buildCandidateFlags = (item) => ({
      loanCount: item.loans,
      sbcPrice: getSBCPrice(
        item,
        sbcId,
        sbcData.challengeId,
        normalizedRunOptions
      ),
      marketPrice: readMarketPrice(item),
      rating: Number(item._rating ?? item.rating),
      ratingRange,
      definitionId: item.definitionId,
      leagueId: item.leagueId,
      nationId: item.nationId,
      teamId: item.teamId,
      rarityLabel: services.Localization.localize(
        "item.raretype" + Number(item._rareflag ?? item.rareflag)
      ),
      isSbcPlayer: Boolean(item?.isSbcPlayer),
      timeLimited: item.isTimeLimited(),
      rewardFromSbc: Boolean(PriceItems[item.definitionId]?.isSbc),
      rewardFromObjective: Boolean(PriceItems[item.definitionId]?.isObjective),
      rareflag: Number(item._rareflag ?? item.rareflag),
      tradeable: item?.isTradeable(),
      extinct: normalizedRunOptions.ignoreValue
        ? false
        : Boolean(PriceItems[item.definitionId]?.isExtinct),
      storage: Boolean(item?.isStorage),
      substitute: sbcData.subs.includes(item.definitionId),
    });
    const candidateExclusions = {
      leagues: excludeLeagues,
      nations: excludeNations,
      teams: excludeTeams,
      rarities: excludeRarity,
      excludeSbcSquads,
      excludeSbc,
      excludeObjective,
      excludeTradable,
      excludeExtinct,
      onlyStorage,
      priceRange: candidateRules.priceRange,
      commonOnly: candidateRules.commonOnly,
      skipPriceRange,
    };
    if (!skipPriceRange && hasActivePriceRange(candidateRules.priceRange)) {
      const missingPrices = players.filter((item) => {
        const flags = buildCandidateFlags(item);
        return flags.marketPrice === null && isBackendCandidate(flags, {
          ...candidateExclusions,
          skipPriceRange: true,
        });
      });
      if (missingPrices.length > 0) {
        sbcExecution.stoppedReason =
          `有 ${missingPrices.length} 名合规候选缺少精确价格，请刷新价格，或开启“忽略球员价值”后确认跳过价格限制。`;
        reportOperationStatus("SBC", sbcExecution.stoppedReason, "error");
        queueFcxNotification([
          sbcExecution.stoppedReason,
          UINotificationType.NEGATIVE,
        ]);
        return;
      }
    }
    let backendPlayersInput = players
      .filter((item) => {
        return isBackendCandidate(
            buildCandidateFlags(item),
            candidateExclusions
          );
      })
      .map((item) => {
        const belongsToRequiredGroup = (groupId) => {
          try {
            if (typeof item.belongsToGroup === "function") {
              return item.belongsToGroup(groupId) === true;
            }
          } catch (error) {
            console.debug("[FCX][SBC] belongsToGroup failed", { groupId, error });
          }
          return Array.isArray(item.groups) && item.groups.map(Number).includes(groupId);
        };
        const relevantGroups = [...new Set(requiredGroupConditions.flatMap((groupIds) => {
          const firstMatch = groupIds.find(belongsToRequiredGroup);
          return firstMatch === undefined ? [] : [firstMatch];
        }))];

        return {
          id: item.id,
          name: item._staticData.name,
          cardType:
            (item.isSpecial()
              ? ""
              : services.Localization.localize(
                  "search.cardLevels.cardLevel" + item.getTier()
                ) + " ") +
            services.Localization.localize("item.raretype" + item.rareflag),
          assetId: item._metaData?.id,
          definitionId: item.definitionId,
          rating: Number(item._rating ?? item.rating),
          teamId: item.teamId,
          leagueId: item.leagueId,
          nationId: item.nationId,
          rarityId: Number(item._rareflag ?? item.rareflag),
          ratingTier: item.getTier(),
          isUntradeable: item.isTradeable(),
          isDuplicate: duplicateIds.includes(item.id),
          isStorage: storageIds.includes(item.id),
          preferredPosition: item.preferredPosition,
          possiblePositions: item.possiblePositions,
          groups: relevantGroups.length ? relevantGroups : [0],
          isFixed: isItemFixed(item),
          concept: item.concept,
          price:
            getSBCPrice(
              item,
              sbcId,
              challengeId,
              normalizedRunOptions
            ) || -1,
          futggPrice: normalizedRunOptions.ignoreValue ? null : getPrice(item),
          maxChem: item.profile.maxChem,
          teamChem: item.profile.rules[0],
          leagueChem: item.profile.rules[1],
          nationChem: item.profile.rules[2],
          normalizeClubId: item.normalizeClubId,
        };
      });

    const candidateCountAfterRules = backendPlayersInput.length;
    const canonicalization = canonicalizeBackendCandidates(
      backendPlayersInput,
      { preferDuplicates: Boolean(useDupes) }
    );
    backendPlayersInput = canonicalization.players;
    const candidatePipelineDiagnostics = buildCandidatePipelineDiagnostics({
      beforeProtection: candidateCountBeforeProtection,
      afterProtection: candidateCountAfterProtection,
      afterRules: candidateCountAfterRules,
      canonicalization,
      constraints: sbcData.constraints || [],
      requiredPlayers: Math.max(
        0,
        11 - Number(sbcData.brickIndices?.length || 0)
      ),
    });
    console.info(
      "[FCX][SBC] candidate pipeline",
      candidatePipelineDiagnostics
    );

    if (normalizedRunOptions.detectSpecialShortage) {
      const shortage = detectTotwShortage(
        sbcData.constraints || [],
        backendPlayersInput,
        Number(sbcData.challengeId)
      );
      if (shortage) {
        sbcExecution.specialShortage = shortage;
        sbcExecution.stoppedReason =
          `周黑或特殊卡候选不足：需要 ${shortage.required} 名，当前只有 ${shortage.available} 名。`;
        reportOperationStatus("SBC", sbcExecution.stoppedReason, "error");
        console.info("[FCX][Routine] detected special-card shortage", shortage);
        return;
      }
    }

    const input = JSON.stringify({
      clubPlayers: backendPlayersInput,
      sbcData: sbcData,
      maxSolveTime: getSettings(sbcId, sbcData.challengeId, "maxSolveTime"),
    });

    count = getSettings(sbcId, sbcData.challengeId, "maxSolveTime");

    clearInterval(runtimeState.countDownInterval);
    runtimeState.countDownInterval = setInterval(countDown, 1000);

    showLoader(true);
    reportOperationStatus("SBC", "正在请求求解方案");
    let solution = await requestSbcSolution(
      input,
      Math.max(1, Number(count) || 60) * 1000 + 15000
    );

    clearInterval(runtimeState.countDownInterval);
    if (isTaskCancellationRequested()) {
      showNotification("SBC Stopped");
      sbcExecution.stoppedReason = "用户结束了SBC任务。";
      return;
    }
    const solveOutcome = parseSolveOutcome(solution);
    if (solveOutcome.kind === "failure") {
      hideLoader();
      console.log("[FCX][SBC] Solver status", solveOutcome.status);
      const ratingWindow = resolveStrictSquadRatingWindow(
        sbcData.constraints || []
      );
      const failureMessage =
        solveOutcome.failureCode === "RATING_OPTIMUM_NOT_PROVEN"
          ? "未能在求解时间内证明最低球队评分，请提高最大求解时间或调整球员范围。"
          : Number(solveOutcome.statusCode) === 3 && ratingWindow
          ? `无法在 ${formatSquadRatingWindow(ratingWindow)} 内完成该 SBC，请调整球员范围、保护或排除设置。`
          : localizeSolverStatus(solveOutcome.statusCode);
      if (Number(solveOutcome.statusCode) === 3) {
        console.warn(
          "[FCX][SBC] INFEASIBLE candidate diagnostics",
          candidatePipelineDiagnostics
        );
      }
      showNotification(
        failureMessage,
        UINotificationType.NEGATIVE
      );
      sbcExecution.stoppedReason = failureMessage;

      return;
    }
    if (solveOutcome.kind === "invalid") {
      console.error("[FCX][SBC] Invalid solver response", {
        reason: solveOutcome.reason,
        response: solution,
      });
      showNotification(solveOutcome.reason, UINotificationType.NEGATIVE);
      sbcExecution.stoppedReason = solveOutcome.reason;
      hideLoader();
      return;
    }

    const ratingValidation = validateSolverSquadRating(
      solveOutcome.players,
      sbcData.constraints || []
    );
    if (ratingValidation.window) {
      const totalCost = solveOutcome.players.reduce(
        (total, player) => total + (Number(player.price) || 0),
        0
      );
      const actualRating = ratingValidation.rating;
      console.info(
        "[FCX][SBC] strict squad rating",
        {
          target: formatSquadRatingWindow(ratingValidation.window),
          actual: actualRating,
          totalCost,
        }
      );
      if (!ratingValidation.ok || actualRating === null) {
        const ratingLabel = actualRating === null
          ? "无法计算"
          : actualRating.toFixed(2);
        const message =
          `求解方案评分 ${ratingLabel} 超出 ${formatSquadRatingWindow(ratingValidation.window)}，本次未应用或提交阵容。`;
        reportOperationStatus("SBC", message, "error");
        queueFcxNotification([message, UINotificationType.NEGATIVE]);
        sbcExecution.stoppedReason = message;
        hideLoader();
        return;
      }
      const proofValidation = validateMinimumRatingProof(
        solveOutcome.ratingOptimization,
        actualRating,
        ratingValidation.window
      );
      if (!proofValidation.ok) {
        const message = proofValidation.reason ||
          "后端未证明当前方案是最低球队评分，本次未应用或提交阵容。";
        reportOperationStatus("SBC", message, "error");
        queueFcxNotification([message, UINotificationType.NEGATIVE]);
        sbcExecution.stoppedReason = message;
        hideLoader();
        return;
      }
      console.info("[FCX][SBC] minimum rating optimization", {
        target: formatSquadRatingWindow(ratingValidation.window),
        ratingStageStatus:
          solveOutcome.ratingOptimization?.rating_stage_status ?? null,
        minimumRating:
          solveOutcome.ratingOptimization?.minimum_rating ?? null,
        costStageStatus:
          solveOutcome.ratingOptimization?.cost_stage_status ?? null,
        costOptimal: solveOutcome.ratingOptimization?.cost_optimal ?? false,
        actual: actualRating,
        totalCost,
      });
      reportOperationStatus(
        "SBC",
        `目标评分 ${formatSquadRatingWindow(ratingValidation.window)}，方案评分 ${actualRating.toFixed(2)}，总成本 ${Math.round(totalCost).toLocaleString()}`,
        "success"
      );
    }

    console.log("[FCX][SBC] Solver status", solveOutcome.status);
    if (!internalOptions?.planOnly) {
      showNotification(
        localizeSolverStatus(solveOutcome.statusCode),
        solveOutcome.statusCode != 4
          ? UINotificationType.NEUTRAL
          : UINotificationType.POSITIVE
      );
    }
    reportOperationStatus(
      "SBC",
      internalOptions?.planOnly ? "当前挑战方案规划完成" : "正在应用求解方案",
      "success"
    );

    window.sbcSet = sbcSet;
    window.challengeId = sbcData.challengeId;

    if (isTaskCancellationRequested()) {
      sbcExecution.stoppedReason = "用户结束了SBC任务。";
      return;
    }

    if (solveOutcome.players.some((item) => item.concept)) {
      runtimeState.concepts = true;
    }
    let _solutionSquad = placeSolverResults({
      formation: sbcData.formation,
      brickIndices: sbcData.brickIndices,
      results: solveOutcome.players,
      findPlayer: (id) => players.find((player) => Number(player.id) === id),
      createBrick: () => new UTItemEntity(),
    });
    for (const definitionId of sbcData.subs) {
      const substitute = players.find(
        (player) => Number(player.definitionId) === Number(definitionId)
      );
      if (!substitute) {
        throw new Error(`替补球员 ${definitionId} 不在候选列表中`);
      }
      _solutionSquad.push(substitute);
    }

    await assertPlayerProtection(
      _solutionSquad,
      "应用阵容前"
    );

    if (internalOptions?.planOnly) {
      const playerItemIds = _solutionSquad
        .map((item) => Number(item?.id))
        .filter((itemId) => Number.isFinite(itemId) && itemId > 0);
      const plannedAutoSubmitId = resolveTaskAutoSubmitId(
        normalizedRunOptions,
        getSettings(sbcId, sbcData.challengeId, "autoSubmit")
      );
      const hasConcept = solveOutcome.players.some((item) => item.concept);
      sbcExecution.attemptedChallengeIds.add(Number(sbcData.challengeId));
      return {
        challengeId: Number(sbcData.challengeId),
        name: sbcData.challengeName,
        playerItemIds,
        payload: {
          solutionSquad: _solutionSquad,
          actualRating: ratingValidation.rating,
          ratingWindow: ratingValidation.window,
          totalCost: solveOutcome.players.reduce(
            (total, player) => total + (Number(player.price) || 0),
            0
          ),
          solveStatusCode: solveOutcome.statusCode,
          setName: sbcData.sbcName,
          hasConcept,
          canAutoSubmit:
            internalOptions.autoSubmitRequested === true &&
            !hasConcept &&
            (plannedAutoSubmitId === 1 ||
              plannedAutoSubmitId === Number(solveOutcome.statusCode)),
        },
      };
    }

    const liveChallenge = executableSbc.challenge;
    const liveSquad = executableSbc.squad;
    if (!liveChallenge || !liveSquad) {
      throw new Error("实时挑战阵容已经失效，请重新执行该SBC");
    }
    let newSbcSquad = new UTSBCSquadOverviewViewController();
    newSbcSquad._set = sbcSet;
    newSbcSquad._challenge = liveChallenge;
    newSbcSquad.initWithSquad(liveSquad);
    let { _squad, _challenge } = newSbcSquad;
    if (!_squad || !_challenge) {
      throw new Error("EA阵容控制器未能绑定当前挑战");
    }
    _squad.removeAllItems();
    _squad.setPlayers(_solutionSquad, true);

    await loadChallenge(_challenge);

    if (isTaskCancellationRequested()) {
      sbcExecution.stoppedReason = "用户结束了SBC任务。";
      return;
    }

    let autoSubmitId = resolveTaskAutoSubmitId(
      normalizedRunOptions,
      getSettings(sbcId, sbcData.challengeId, "autoSubmit")
    );
    let sbcSubmitted = false;
    let submissionAttempted = false;
    if (
      (solveOutcome.statusCode == autoSubmitId || autoSubmitId == 1) &&
      autoSubmit &&
      !runtimeState.concepts
    ) {
      submissionAttempted = true;
      const submissionRewards = getSbcSubmissionRewards(
        _challenge,
        sbcSet,
        sbcData.finalSBC
      );
      await prepareSbcRewardBaselines(sbcExecution, submissionRewards);
      await assertPlayerProtection(
        _solutionSquad,
        "提交阵容前"
      );
      const consumedPlayers = snapshotConsumedPlayers(_solutionSquad, {
        rarityLabel: (rareflag) =>
          String(services.Localization.localize("item.raretype" + rareflag) || rareflag),
      });
      try {
        await sbcSubmit(_challenge, sbcSet);
        removeSubmittedPlayersFromInventorySnapshot(_solutionSquad);
        addSbcSubmission(sbcExecution.packSummary, {
          setId: Number(sbcId),
          challengeId: Number(sbcData.challengeId),
          setName: String(sbcData.sbcName || sbcId),
          challengeName: String(sbcData.challengeName || sbcData.challengeId),
          submittedAt: new Date().toISOString(),
          players: consumedPlayers,
        });
        registerSubmittedSbcRewards(sbcExecution, submissionRewards);
        sbcSubmitted = true;
        reportConfirmedSbcActivity(
          "challenge_submitted",
          sbcId,
          sbcData.sbcName || sbcId
        );
      } catch (error) {
        console.error("Error submitting SBC:", error);
        const submissionMessage = String(error?.message || error || "EA 未返回具体原因");
        reportOperationStatus(
          "SBC",
          `方案已生成，但 EA 提交失败：${submissionMessage}`,
          "error"
        );
        reportLocalClientDiagnostic("sbc_submission_failed", submissionMessage);
        hideLoader();
        sbcSubmitted = false;
      }
    }
    if (!sbcSubmitted && !submissionAttempted && autoSubmit) {
      const skipReason = runtimeState.concepts
        ? "方案包含概念球员"
        : `自动提交策略不接受求解状态 ${solveOutcome.statusCode}`;
      reportOperationStatus("SBC", `方案已生成，但未自动提交：${skipReason}`, "error");
      reportLocalClientDiagnostic("sbc_submission_skipped", skipReason);
    }
    if (sbcSubmitted) {
      if (isTaskCancellationRequested()) {
        sbcExecution.stoppedReason = "用户结束了SBC任务。";
        return;
      }
      if (!normalizedRunOptions.deferRewards && resolveTaskAutoOpen(
        normalizedRunOptions,
        getSettings(sbcId, sbcData.challengeId, "autoOpenPacks")
      )) {
        if (!(await openSbcRewardPlan(sbcExecution))) {
          return;
        }
      }
      if (!normalizedRunOptions.deferRewards && !resolveTaskAutoOpen(
        normalizedRunOptions,
        getSettings(sbcId, sbcData.challengeId, "autoOpenPacks")
      )) {
        goToPacks();
      }
      if (sbcData.finalSBC) {
        sbcExecution.completedRuns += 1;
        reportConfirmedSbcActivity(
          "set_completed",
          sbcId,
          sbcData.sbcName || sbcId
        );
      }
      const requestedLabel =
        sbcExecution.options.requestedRuns === -1
          ? "持续执行"
          : String(sbcExecution.options.requestedRuns);
      if (sbcData.finalSBC) {
        showNotification(
          `SBC进度：已完成 ${sbcExecution.completedRuns} / ${requestedLabel}`,
          UINotificationType.POSITIVE
        );
        if (
          !isTaskCancellationRequested() &&
          shouldContinueSbcTask({
            requestedRuns: sbcExecution.options.requestedRuns,
            completedRuns: sbcExecution.completedRuns,
          })
        ) {
          await solveSBC(
            sbcId,
            0,
            true,
            null,
            autoOpen,
            false,
            normalizedRunOptions,
            sbcExecution
          );
          return;
        }
      }
    } else {
      await assertPlayerProtection(
        _solutionSquad,
        "保存阵容前"
      );
      let showSBC = new UTSBCSquadSplitViewController();
      showSBC.initWithSBCSet(sbcSet, sbcData.challengeId);
      getCurrentViewController()
        .rootController.getRootNavigationController()
        .popViewController();
      getCurrentViewController()
        .rootController.getRootNavigationController()
        .pushViewController(showSBC);
      const desiredItemIds = new Set(
        _solutionSquad.map((item) => Number(item?.id)).filter(Number.isFinite)
      );
      try {
        await executeFcxEaRequest(
          () => services.SBC.saveChallenge(_challenge),
          "保存SBC阵容",
          {
            scope: "SBC",
            verifyAfterFailure: async () => {
              try {
                const loaded = await loadChallenge(_challenge, {
                  resetThrottleOnSuccess: false,
                });
                const candidates = [
                  loaded?.squad,
                  loaded?.response?.squad,
                  _challenge?.squad,
                  _challenge?._squad,
                  _squad,
                ];
                const ids = candidates
                  .map((candidate) => extractActiveSquadEntityItemIds(candidate))
                  .find((candidate) => candidate.length > 0);
                if (!ids) {
                  return { state: "unknown", reason: "保存后的挑战阵容无法读取，为避免覆盖未自动重试" };
                }
                const current = new Set(ids.map(Number));
                const matches = desiredItemIds.size > 0
                  && [...desiredItemIds].every((id) => current.has(id));
                return matches
                  ? { state: "applied", value: { success: true, status: 200 } }
                  : { state: "not_applied" };
              } catch (error) {
                return { state: "unknown", reason: `SBC阵容保存状态核验失败：${error?.message || error}` };
              }
            },
          }
        );
      } catch (error) {
        showNotification("Failed to save squad.", UINotificationType.NEGATIVE);
        throw error;
      }
      hideLoader();
    }
    hideLoader();
  } catch (err) {
    if (isTaskCancellationRequested()) {
      sbcExecution.stoppedReason = "用户结束了SBC任务。";
      console.info("[FCX][SBC] cancelled while waiting for current operation");
      return;
    }
    const rawMessage = String(err?.message || err || "未知错误");
    const publicMessage = /[\u3400-\u9fff]/.test(rawMessage)
      ? rawMessage
      : "SBC任务执行失败，请重新打开该挑战后重试";
    reportOperationStatus(
      "SBC",
      `任务失败：${publicMessage}`,
      "error"
    );
    queueFcxNotification([
      publicMessage,
      UINotificationType.NEGATIVE,
    ]);
    console.error("[FCX][SBC] Error in solveSBC", err);
    reportLocalClientDiagnostic("sbc_runtime_failed", rawMessage);
    sbcExecution.stoppedReason = publicMessage;
    hideLoader();
  } finally {
    sbcExecution.activeCalls = Math.max(0, sbcExecution.activeCalls - 1);
    if (isNewExecution) releaseTaskOverlay();
    if (
      sbcExecution.activeCalls === 0 &&
      runtimeState.activeSbcExecution?.id === sbcExecution.id &&
      !sbcExecution.orchestrating
    ) {
      runtimeState.activeSbcExecution = undefined;
      hideLoader();
      if (
        !sbcExecution.orchestrating &&
        !sbcExecution.options.deferSummary &&
        !sbcExecution.summaryShown &&
        (sbcExecution.packSummary.packsOpened > 0 ||
          sbcExecution.packSummary.picksCompleted > 0 ||
          sbcExecution.packSummary.players.length > 0 ||
          sbcExecution.packSummary.sbcSubmissions.length > 0)
      ) {
        sbcExecution.summaryShown = true;
        if (sbcExecution.stoppedReason) {
          sbcExecution.packSummary.stoppedReason = sbcExecution.stoppedReason;
        }
        showPackTaskSummary(sbcExecution.packSummary, {
          ignoreValue: sbcExecution.options.ignoreValue,
        });
      }
      if (isNewExecution && !sbcExecution.options.deferSummary) {
        if (sbcExecution.stoppedReason) {
          sbcExecution.packSummary.stoppedReason = sbcExecution.stoppedReason;
        }
        void saveTaskHistory({
          type: "sbc",
          title: sbcExecution.packSummary.sbcSubmissions[0]?.setName || "FCX SBC",
          summary: sbcExecution.packSummary,
        });
      }
    }
  }

  //getAppMain().getRootViewController().getPresentedViewController().getCurrentViewController().rootController.getRootNavigationController().pushViewController(currentView);
};

const getSbcSubmissionRewards = (challenge, set, includeSetRewards = false) =>
  classifySbcRewards([
    ...(challenge?.awards || []),
    ...(includeSetRewards ? set?.awards || [] : []),
  ]);

const prepareSbcRewardBaselines = async (execution, rewards) => {
  const rewardPlan = execution.rewardPlan;
  const packIds = [...new Set(
    rewards
      .filter((reward) => reward.kind === "pack")
      .map((reward) => Number(reward.id))
      .filter((id) => !rewardPlan.capturedPackIds[id])
  )];
  if (packIds.length) {
    const response = await getPacks();
    const counts = countPackInventory(response?.packs || []);
    for (const id of packIds) {
      for (const tradeable of [false, true]) {
        const key = packRewardKey(id, tradeable);
        rewardPlan.packBaselineByKey[key] = Number(counts[key] || 0);
      }
      rewardPlan.capturedPackIds[id] = true;
    }
  }

  const playerPickIds = [...new Set(
    rewards
      .filter((reward) => reward.kind === "player_pick")
      .map((reward) => Number(reward.id))
      .filter((id) => !rewardPlan.capturedPlayerPickIds[id])
  )];
  if (playerPickIds.length) {
    const unassigned = await fetchUnassigned();
    const counts = countPlayerPickInventory(unassigned);
    for (const id of playerPickIds) {
      rewardPlan.playerPickBaselineById[id] = Number(counts[id] || 0);
      rewardPlan.playerPickBaselineKeysById[id] = unassigned
        .filter((item) => playerPickDefinitionId(item) === id)
        .map((item) => playerPickInstanceKey(item))
        .filter(Boolean);
      rewardPlan.capturedPlayerPickIds[id] = true;
    }
  }
};

const registerSubmittedSbcRewards = (execution, rewards) => {
  recordExpectedRewards(execution.rewardPlan, rewards);
  if (execution.rewardPlan.unsupportedRewards.length) {
    console.info("[FCX][SBC] unsupported rewards left to EA", {
      rewards: [...execution.rewardPlan.unsupportedRewards],
    });
  }
};

const confirmSetRoundCompletion = async (setId, previousTimesCompleted) => {
  let latest;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await wait(900);
    latest = await readFreshSbcExecutionState(setId, { freshState: true });
    const timesCompleted = Number(latest.set?.timesCompleted || 0);
    const noUnfinishedChallenges = latest.challenges.every(
      (challenge) => challenge.status === "COMPLETED"
    );
    if (
      timesCompleted > previousTimesCompleted ||
      latest.set?.isComplete?.() === true ||
      noUnfinishedChallenges
    ) {
      return latest;
    }
  }
  throw new Error("EA尚未确认整组SBC完成，已停止后续轮次。");
};

const submitPlannedSbcChallenge = async (
  setId,
  planned,
  execution,
  autoSubmit,
  includeSetRewards = false
) => {
  if (isTaskCancellationRequested()) {
    return {
      challengeId: planned.challengeId,
      submitted: false,
      reason: "用户结束了SBC任务。",
    };
  }
  const live = await resolveExecutableSbc(setId, planned.challengeId);
  const autoSubmitId = resolveTaskAutoSubmitId(
    execution.options,
    getSettings(setId, planned.challengeId, "autoSubmit")
  );
  const solveStatusCode = Number(planned.payload?.solveStatusCode);
  if (
    !autoSubmit ||
    planned.payload?.hasConcept ||
    !(autoSubmitId === 1 || autoSubmitId === solveStatusCode)
  ) {
    return {
      challengeId: planned.challengeId,
      submitted: false,
      reason: planned.payload?.hasConcept
        ? `${planned.name} 使用了概念球员，不能自动提交。`
        : `${planned.name} 的自动提交策略不允许提交当前方案。`,
    };
  }

  const controller = new UTSBCSquadOverviewViewController();
  controller._set = live.set;
  controller._challenge = live.challenge;
  controller.initWithSquad(live.squad);
  if (!controller._squad || !controller._challenge) {
    throw new Error(`${planned.name} 无法绑定最新挑战阵容。`);
  }
  const rewards = getSbcSubmissionRewards(
    live.challenge,
    live.set,
    includeSetRewards
  );
  await prepareSbcRewardBaselines(execution, rewards);
  await assertPlayerProtection(
    planned.payload.solutionSquad,
    "整组应用阵容前"
  );
  controller._squad.removeAllItems();
  controller._squad.setPlayers(planned.payload.solutionSquad, true);
  await loadChallenge(controller._challenge);
  if (isTaskCancellationRequested()) {
    return {
      challengeId: planned.challengeId,
      submitted: false,
      reason: "用户结束了SBC任务。",
    };
  }
  await assertPlayerProtection(
    planned.payload.solutionSquad,
    "整组提交阵容前"
  );
  const consumedPlayers = snapshotConsumedPlayers(planned.payload.solutionSquad, {
    rarityLabel: (rareflag) =>
      String(services.Localization.localize("item.raretype" + rareflag) || rareflag),
  });
  await sbcSubmit(controller._challenge, live.set);
  reportConfirmedSbcActivity(
    "challenge_submitted",
    setId,
    live.set?.name || planned.payload?.setName || setId
  );
  removeSubmittedPlayersFromInventorySnapshot(planned.payload.solutionSquad);
  addSbcSubmission(execution.packSummary, {
    setId: Number(setId),
    challengeId: Number(planned.challengeId),
    setName: String(live.set?.name || planned.payload?.setName || setId),
    challengeName: String(planned.name || planned.challengeId),
    submittedAt: new Date().toISOString(),
    players: consumedPlayers,
  });
  registerSubmittedSbcRewards(execution, rewards);
  execution.submittedChallengeIds.add(planned.challengeId);
  invalidateSbcCache(setId);
  return { challengeId: planned.challengeId, submitted: true };
};

const waitForSbcRewardSelections = async (rewardPlan) => {
  if (isTaskCancellationRequested()) return [];

  reportOperationStatus("Pack", "正在等待本次奖励卡包到账");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (isTaskCancellationRequested()) return [];
    repositories.Store.setDirty();
    const response = await getPacks();
    const selections = selectNewRewardPacks(
      rewardPlan,
      response?.packs || []
    );
    const pendingCount = Object.entries(rewardPlan.expectedById).reduce(
      (total, [rawId, expected]) => {
        const id = Number(rawId);
        const processed = Object.entries(rewardPlan.processedPackByKey)
          .filter(([key]) => Number(key.split(":", 1)[0]) === id)
          .reduce((sum, [, count]) => sum + Number(count || 0), 0);
        return total + Math.max(0, Number(expected) - processed);
      },
      0
    );
    const selectedCount = selections.reduce(
      (total, selection) => total + Number(selection.quantity || 0),
      0
    );
    if (pendingCount === 0 || selectedCount >= pendingCount) return selections;
    if (attempt < 7) await wait(1500);
  }
  return [];
};

const openSbcRewardPlan = async (execution) => {
  const rewardPlan = execution.rewardPlan;
  if (!hasPendingTrackedRewards(rewardPlan)) return true;
  const options = readPackRunOptions();
  const onStorageFull = createStorageOverflowRecovery(execution);

  if (!(await processTrackedSbcPlayerPicks(execution, options))) {
    const blocking = await routeUnassignedItems(
      options,
      execution.packSummary
    );
    const recovery =
      blocking.stopCode === "storage_full"
        ? await onStorageFull({
            phase: "player_pick",
            routing: blocking,
            options,
            taskSummary: execution.packSummary,
          })
        : null;
    if (!recovery?.success) {
      execution.stoppedReason =
        recovery?.reason
        || execution.stoppedReason
        || blocking.reason;
    }
    if (execution.stoppedReason && !recovery?.success) {
      queueFcxNotification([
        execution.stoppedReason,
        UINotificationType.NEUTRAL,
      ]);
      return false;
    }
    if (recovery?.selections?.length) {
      await goToPacks();
      const recoveryPacks = await runPackSelections(
        recovery.selections,
        options,
        undefined,
        {
          showSummary: false,
          internal: true,
          allowPlayerPicks: true,
          onStorageFull,
        }
      );
      mergePackTaskSummary(execution.packSummary, recoveryPacks.summary);
      if (recoveryPacks.stopped || recoveryPacks.cancelled) {
        execution.stoppedReason =
          recoveryPacks.reason || "清仓奖励处理未完成。";
        return false;
      }
    }
    execution.stoppedReason = undefined;
  }

  const pendingPacks = Object.entries(rewardPlan.expectedById).some(
    ([rawId, expected]) => {
      const id = Number(rawId);
      const processed = Object.entries(rewardPlan.processedPackByKey)
        .filter(([key]) => Number(key.split(":", 1)[0]) === id)
        .reduce((sum, [, count]) => sum + Number(count || 0), 0);
      return processed < Number(expected);
    }
  );
  if (!pendingPacks) return true;

  const selections = await waitForSbcRewardSelections(rewardPlan);
  if (!selections.length) {
    execution.stoppedReason =
      "本次奖励卡包尚未到账，未打开仓库中已有的同名卡包。";
    queueFcxNotification([
      execution.stoppedReason,
      UINotificationType.NEUTRAL,
    ]);
    return false;
  }
  const remainingUnassigned = await fetchUnassigned();
  if (remainingUnassigned.some((item) => isPlayerPickItemLike(item))) {
    execution.stoppedReason =
      "本次球员挑选已处理，但仍有历史挑选未分配；为避免误选，奖励卡包暂未开启。";
    queueFcxNotification([
      execution.stoppedReason,
      UINotificationType.NEUTRAL,
    ]);
    await goToUnassignedView();
    return false;
  }
  await goToPacks();
  if (isTaskCancellationRequested()) return false;
  const result = await runPackSelections(
    selections,
    options,
    (progress) => {
      reportOperationStatus(
        "Pack",
        `正在开启第 ${Math.min(progress.opened + 1, progress.total)} / ${progress.total} 个奖励包 · ${progress.name}`
      );
    },
    {
      showSummary: false,
      internal: true,
      allowPlayerPicks: true,
      onStorageFull,
    }
  );
  mergePackTaskSummary(execution.packSummary, result.summary);
  if (result.stopped || result.cancelled) {
    execution.stoppedReason =
      result.reason || "奖励包处理未完成，SBC任务已停止。";
    return false;
  }
  markRewardPacksProcessed(rewardPlan, selections);
  return true;
};

let solveSbcSet = async (
  sbcId,
  autoSubmit = true,
  autoOpen = true,
  runOptions = undefined,
  executionContext = undefined,
  lifecycleOptions = undefined
) => {
  const isNewExecution = !executionContext;
  const suppressFinalUi = lifecycleOptions?.suppressFinalUi === true;
  if (
    isNewExecution &&
    (runtimeState.activeRoutineExecution ||
      runtimeState.packRunActive)
  ) {
    queueFcxNotification([
      "当前FCX任务尚未结束，请稍候。",
      UINotificationType.NEGATIVE,
    ]);
    return;
  }
  if (isNewExecution) resetTaskCancellation();
  const execution =
    executionContext || createSbcExecutionContext(runOptions);
  execution.mode = "set";
  execution.orchestrating = true;
  execution.options = normalizeSbcRunOptions(runOptions || execution.options);
  execution.specialShortage = undefined;
  runtimeState.activeSbcExecution = execution;
  runtimeState.concepts = false;
  if (isNewExecution) holdTaskOverlay();
  try {
    showLoader(true);
    let nextState = normalizeInitialSbcExecutionState(
      sbcId,
      lifecycleOptions?.initialExecutionState
    ) || await readFreshSbcExecutionState(sbcId, { freshState: true });
    execution.options.requestedRuns = effectiveRequestedRuns(
      execution.options.requestedRuns,
      getSbcRepeatability(nextState.set)
    );
    if (execution.options.requestedRuns === 0) {
      execution.stoppedReason = "该SBC当前没有可执行的未完成挑战。";
      reportOperationStatus("SBC", execution.stoppedReason, "warning");
      if (isNewExecution) {
        queueFcxNotification([
          execution.stoppedReason,
          UINotificationType.NEUTRAL,
        ]);
      }
    }

    while (
      shouldContinueSbcTask({
        requestedRuns: execution.options.requestedRuns,
        completedRuns: execution.completedRuns,
      })
    ) {
      if (isTaskCancellationRequested()) {
        execution.stoppedReason = "用户结束了SBC任务。";
        break;
      }
      const state = nextState || await readFreshSbcExecutionState(sbcId, { freshState: true });
      nextState = undefined;
      const previousTimesCompleted = Number(state.set?.timesCompleted || 0);
      const unfinished = state.challenges
        .filter((challenge) => challenge.status !== "COMPLETED")
        .sort((left, right) => Number(left.priority) - Number(right.priority));
      if (!unfinished.length) {
        execution.stoppedReason = execution.completedRuns > 0
          ? "当前没有可执行的下一轮挑战，本步骤已结束。"
          : "该SBC当前没有可执行的未完成挑战。";
        reportOperationStatus("SBC", execution.stoppedReason, "warning");
        if (isNewExecution) {
          queueFcxNotification([
            execution.stoppedReason,
            UINotificationType.NEUTRAL,
          ]);
        }
        break;
      }
      if (autoSubmit) observeSubmissionCount(unfinished.length);

      execution.totalChallenges = unfinished.length;
      execution.currentChallengeIndex = 0;
      execution.stoppedReason = undefined;
      execution.attemptedChallengeIds.clear();
      execution.submittedChallengeIds.clear();
      reportOperationStatus(
        "SBC",
        `正在规划整组阵容 · ${unfinished.length} 个挑战`
      );
      const result = await executeSbcSetPlan({
        setId: Number(sbcId),
        setName: state.set.name,
        challengeIds: unfinished.map((challenge) => Number(challenge.id)),
        isCancelled: () => isTaskCancellationRequested(),
        planChallenge: async (challengeId, excludedItemIds) => {
          execution.currentChallengeIndex += 1;
          const challenge = unfinished.find(
            (item) => Number(item.id) === Number(challengeId)
          );
          reportOperationStatus(
            "SBC",
            `正在规划 ${execution.currentChallengeIndex} / ${unfinished.length} · ${challenge?.name || challengeId}`
          );
          runtimeState.activeSbcExecution = execution;
          const planned = await solveSBC(
            sbcId,
            challengeId,
            false,
            null,
            false,
            false,
            execution.options,
            execution,
            {
              planOnly: true,
              fromSetOrchestrator: true,
              autoSubmitRequested: autoSubmit,
              excludedItemIds,
              initialExecutionState: state,
            }
          );
          if (!planned) {
            throw new Error(
              execution.stoppedReason || `${challenge?.name || challengeId} 无法生成可提交方案。`
            );
          }
          if (!planned.payload?.canAutoSubmit) {
            throw new Error(
              planned.payload?.hasConcept
                ? `${planned.name} 使用了概念球员，整组不会提交。`
                : `${planned.name} 的自动提交策略不允许提交当前方案。`
            );
          }
          return planned;
        },
        submitChallenge: async (planned, index, total) => {
          reportOperationStatus(
            "SBC",
            `正在提交 ${index} / ${total} · ${planned.name}`
          );
          return submitPlannedSbcChallenge(
            sbcId,
            planned,
            execution,
            autoSubmit,
            index === total
          );
        },
        ...(execution.options.wholeSetPreview
          ? {
              reviewPlan: (plan, excludedItemIds) => {
                reportOperationStatus("SBC", "等待确认整组提交预览");
                return reviewWholeSbcSetPlan(plan, excludedItemIds, {
                  ignoreValue: execution.options.ignoreValue,
                });
              },
            }
          : {}),
      });

      if (result.stoppedReason) {
        execution.stoppedReason = result.stoppedReason;
        if (!isTaskCancellationRequested()) {
          queueFcxNotification([
            `整组SBC已停止：${result.stoppedReason}`,
            UINotificationType.NEGATIVE,
          ]);
        }
        break;
      }
      if (result.submitted.length !== unfinished.length) {
        execution.stoppedReason = "整组SBC没有完整提交。";
        break;
      }

      invalidateSbcCache(sbcId);
      nextState = await confirmSetRoundCompletion(
        sbcId,
        previousTimesCompleted
      );
      reportConfirmedSbcActivity(
        "set_completed",
        sbcId,
        state.set.name || sbcId
      );
      execution.completedRuns += 1;
      const requestedLabel =
        execution.options.requestedRuns === -1
          ? "持续执行"
          : String(execution.options.requestedRuns);
      queueFcxNotification([
        `整组SBC进度：已完成 ${execution.completedRuns} / ${requestedLabel}`,
        UINotificationType.POSITIVE,
      ]);
      const shouldProcessRoundRewards =
        !execution.options.deferRewards &&
        autoOpen &&
        resolveTaskAutoOpen(
          execution.options,
          getSettings(sbcId, 0, "autoOpenPacks")
        );
      if (shouldProcessRoundRewards && !(await openSbcRewardPlan(execution))) {
        break;
      }
    }

    const shouldOpenRewards =
      !isTaskCancellationRequested() &&
      !execution.options.deferRewards &&
      autoOpen &&
      resolveTaskAutoOpen(
        execution.options,
        getSettings(sbcId, 0, "autoOpenPacks")
      ) &&
      execution.completedRuns > 0;
    if (shouldOpenRewards) {
      await openSbcRewardPlan(execution);
    } else if (
      !isTaskCancellationRequested() &&
      !execution.options.deferRewards &&
      execution.completedRuns > 0
    ) {
      await goToPacks();
    }
  } catch (error) {
    if (isTaskCancellationRequested()) {
      execution.stoppedReason = "用户结束了SBC任务。";
      console.info("[FCX][SBC] set cancelled while current operation finished");
      return execution;
    }
    const rawMessage = String(error?.message || error || "未知错误");
    execution.stoppedReason = /[\u3400-\u9fff]/.test(rawMessage)
      ? rawMessage
      : "整组SBC执行失败，请重新打开该SBC后重试。";
    console.error("[FCX][SBC] Error in solveSbcSet", error);
    queueFcxNotification([
      execution.stoppedReason,
      UINotificationType.NEGATIVE,
    ]);
  } finally {
    execution.orchestrating = false;
    if (
      execution.stoppedReason &&
      !/用户(?:结束|取消)/.test(execution.stoppedReason)
    ) {
      reportLocalClientDiagnostic("sbc_set_stopped", execution.stoppedReason);
    }
    if (!suppressFinalUi) {
      runtimeState.activeSbcExecution = undefined;
      if (isNewExecution) releaseTaskOverlay();
      else hideLoader();
    }
    if (
      !suppressFinalUi &&
      !execution.options.deferSummary &&
      !execution.summaryShown &&
      (execution.packSummary.packsOpened > 0 ||
        execution.packSummary.picksCompleted > 0 ||
        execution.packSummary.players.length > 0 ||
        execution.packSummary.sbcSubmissions.length > 0)
    ) {
      execution.summaryShown = true;
      if (execution.stoppedReason) {
        execution.packSummary.stoppedReason = execution.stoppedReason;
      }
      showPackTaskSummary(execution.packSummary, {
        ignoreValue: execution.options.ignoreValue,
      });
    }
    if (isNewExecution && !execution.options.deferSummary) {
      if (execution.stoppedReason) {
        execution.packSummary.stoppedReason = execution.stoppedReason;
      }
      void saveTaskHistory({
        type: execution.mode === "set" ? "set" : "sbc",
        title: execution.packSummary.sbcSubmissions[0]?.setName || "FCX SBC",
        summary: execution.packSummary,
      });
    }
    if (!suppressFinalUi) createSBCTab();
  }
  return execution;
};
