// @ts-nocheck
// FCX compatibility runtime for the EA Web App.

let goToPacks = async () => {
  await dealWithUnassigned();
  let ulist = await fetchUnassigned();

  if (ulist.length > 0) {
    goToUnassignedView();
    return;
  }
  repositories.Store.setDirty();
  let n = new UTStorePackViewController();
  n.init();
  getCurrentViewController()
    .rootController.getRootNavigationController()
    .popViewController();
  getCurrentViewController()
    .rootController.getRootNavigationController()
    .pushViewController(n);
};
let goToUnassignedView = async () => {
  repositories.Item.unassigned.clear();
  repositories.Item.unassigned.reset();
  const rootController = getCurrentViewController().rootController;
  hideLoader();
  showLoader();
  try {
    const response = await executeFcxEaRequest(
      () => services.Item.requestUnassignedItems(),
      "读取未分配物品",
      { scope: "Pack", timeoutMs: PLAYER_PICK_UNASSIGNED_TIMEOUT_MS }
    );
    const navigation = rootController.getRootNavigationController();
    if (navigation) {
      const controller = isPhone()
        ? new UTUnassignedItemsViewController()
        : new UTUnassignedItemsSplitViewController();
      const items = response?.response?.items;
      Array.isArray(items)
        ? controller.initWithItems(items.sort((left, right) => getSBCPrice(right) - getSBCPrice(left)))
        : controller.init();
      services.Item.clearTransferMarketCache();
      navigation.popToRootViewController();
      navigation.pushViewController(controller);
    }
  } finally {
    hideLoader();
  }
};
let getPacks = async (requestOptions = {}) => {
  repositories.Store.setDirty();
  const response = await executeFcxEaRequest(
    () => services.Store.getPacks("ALL", true, true),
    requestOptions.label || "读取卡包列表",
    {
      scope: "Pack",
      maxAttempts: requestOptions.maxAttempts,
      timeoutMs: requestOptions.timeoutMs,
      ignoreCancellation: requestOptions.ignoreCancellation,
    }
  );
  return response?.response ?? response?.data ?? response;
};

const sbcSubmitChallengeOverride = () => {
  const sbcSubmit = PopupQueueViewController.prototype.closeActivePopup;
  PopupQueueViewController.prototype.closeActivePopup = function () {
    sbcSubmit.call(this);
    createSBCTab();
  };
};
const unassignedItemsOverride = () => {
  const popupDisplay = PopupQueueViewController.prototype.displayPopup;
  PopupQueueViewController.prototype.displayPopup = function (e) {
    popupDisplay.call(this, e);
    if (
      hasBlockingFcxTask() &&
      this.queue[0] instanceof UTGameRewardsViewController
    ) {
      this.closeActivePopup();
      goToUnassignedView();
    }
  };

  const unassignedItems = UTSectionedItemListView.prototype.render;
  UTSectionedItemListView.prototype.render = function (...args) {
    let players = [];
    for (const { data } of this.listRows) {
      players.push(data);
    }
    const result = unassignedItems.call(this, ...args);
    void fetchPlayerPrices(players).then(() => {
      if (this.__root?.isConnected) unassignedItems.call(this, ...args);
    });
    return result;
  };
};
let sbcSubmit = async function (challenge, sbcSet, i) {
  if (isTaskCancellationRequested()) {
    throw new Error("用户结束了SBC任务。");
  }
  observeSubmissionCount(1);
  services.Chemistry.resetCustomProfiles();
  await executeFcxEaRequest(
    () => services.Chemistry.requestChemistryProfiles(),
    "读取化学数据",
    { scope: "SBC" }
  );
  services.SBC.getCachedSBCSquads().map(function (squad) {
    squad.updateChemistry();
    squad.update(squad);
  });
  const beforeSetCompletions = Number(sbcSet?.timesCompleted || 0);
  const challengeId = Number(challenge?.id || 0);
  const submitChallenge = (label) => executeFcxEaRequest(
      () => services.SBC.submitChallenge(
        challenge,
        sbcSet,
        true,
        services.Chemistry.isFeatureEnabled()
      ),
      label,
      {
        scope: "SBC",
        maxAttempts: 4,
        retryDelayScheduleMs: [1000, 2000, 4000],
        retryStatuses: [401, 403],
        verifyAfterFailure: async () => {
          try {
            const fresh = await readFreshSbcExecutionState(Number(sbcSet?.id), {
              resetThrottleOnSuccess: false,
            });
            const freshChallenge = fresh.challenges.find(
              (item) => Number(item?.id) === challengeId
            );
            const completed = String(freshChallenge?.status || "").toUpperCase() === "COMPLETED";
            const setAdvanced = Number(fresh.set?.timesCompleted || 0) > beforeSetCompletions;
            if (completed || setAdvanced) {
              return { state: "applied", value: { success: true, status: 200 } };
            }
            if (freshChallenge) return { state: "not_applied" };
            return { state: "unknown", reason: "SBC提交结果无法确认，为避免重复提交未自动重试" };
          } catch (error) {
            return { state: "unknown", reason: `SBC提交状态核验失败：${error?.message || error}` };
          }
        },
      }
    );
  try {
    let response;
    try {
      response = await submitChallenge("提交SBC");
    } catch (error) {
      if (eaResponseStatus(error) !== 446) throw error;
      console.warn("[FCX][SBC] chemistry profile expired; refreshing before one retry", {
        setId: Number(sbcSet?.id || 0),
        challengeId,
      });
      reportOperationStatus("SBC", "EA化学配置已更新，正在刷新后重试提交", "info");
      services.Chemistry.resetCustomProfiles();
      await executeFcxEaRequest(
        () => services.Chemistry.requestChemistryProfiles(),
        "刷新化学数据",
        { scope: "SBC" }
      );
      services.SBC.getCachedSBCSquads().forEach((squad) => {
        squad.updateChemistry();
        squad.update(squad);
      });
      response = await submitChallenge("提交SBC（刷新化学后重试）");
    }
    recordSuccessfulSubmission();
    showNotification("SBC Submitted", UINotificationType.POSITIVE);
    invalidateSbcCache(sbcSet?.id);
    createSBCTab();
    return response;
  } catch (error) {
    showNotification("Failed to submit", UINotificationType.NEGATIVE);
    hideLoader();
    throw error;
  }
};

const sbcViewOverride = () => {
  const squadDetailPanelView = UTSBCSquadDetailPanelView.prototype.init;
  UTSBCSquadDetailPanelView.prototype.init = function (...args) {
    const response = squadDetailPanelView.call(this, ...args);

    const button = createButton("idSolveSbc", "FCX求解", async function () {
      const { _challenge } = getControllerInstance();
      const content = document.createElement("div");
      content.className = "fcx-native-solve-dialog";
      const ignoreValue = createFcxSwitchControl(document, {
        label: "忽略球员价值",
        checked: true,
      });
      const readNativeCandidateRules = () => resolveCandidateRules(
        Number(_challenge?.setId || 0),
        Number(_challenge?.id || 0),
        (setId, challengeId, key) => fcxSettingsStore.getValue(setId, challengeId, key),
        (setId, challengeId, key) => fcxSettingsStore.getOwnValue(setId, challengeId, key)
      );
      const candidateRulesEditor = createCandidateRulesEditor({
        value: readNativeCandidateRules(),
        onRestore: () => {
          for (const key of [
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
          ]) {
            fcxSettingsStore.deleteValue(_challenge.setId, _challenge.id, key);
          }
          queueFcxNotification(["已恢复当前挑战的 FCX 推荐规则", UINotificationType.POSITIVE]);
          return readNativeCandidateRules();
        },
      });
      const help = document.createElement("p");
      help.className = "fcx-choice-meta";
      help.textContent =
        "开启后不会读取或使用市场价格，适合球员数量较多的俱乐部。本次只填入当前挑战，不会自动提交或开包。";
      content.append(candidateRulesEditor.element, ignoreValue.element, help);
      const modal = openFcxModal({
        id: "fcx-native-sbc-solve-modal",
        title: "FCX求解",
        description: _challenge?.name || "求解当前SBC挑战",
        content,
      });
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "fcx-button";
      cancel.textContent = "取消";
      cancel.addEventListener("click", modal.close);
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "fcx-button fcx-button--primary";
      confirm.textContent = "开始求解";
      confirm.addEventListener("click", () => {
        if (hasBlockingFcxTask()) {
          queueFcxNotification([
            "当前FCX任务尚未结束，请稍候。",
            UINotificationType.NEGATIVE,
          ]);
          return;
        }
        const candidateRules = candidateRulesEditor.getValue();
        for (const key of candidateRulesEditor.changedKeys()) {
          fcxSettingsStore.saveValue(_challenge.setId, _challenge.id, key, candidateRules[key]);
        }
        modal.close();
        void solveSBC(
          _challenge.setId,
          _challenge.id,
          false,
          null,
          false,
          false,
          { ignoreValue: ignoreValue.input.checked, requestedRuns: 1 }
        );
      });
      modal.footer.append(cancel, confirm);
    });
    insertAfter(button, this._btnExchange.__root);

    const sleep = (ms) =>
      new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
    const runCountdown = async (ms, target, labelPrefix = "Next buy in") => {
      let remaining = Math.max(0, ms);
      while (remaining > 0) {
        if (target) {
          const seconds = Math.ceil(remaining / 1000);
          target.textContent = `${labelPrefix} ${seconds}s`;
        }
        const step = Math.min(1000, remaining);
        await sleep(step);
        remaining -= step;
      }
      if (target) {
        target.textContent = "";
      }
    };
    const formatPlayerName = (item) =>
      item?._staticData?.name ||
      item?._staticData?.commonName ||
      item?._staticData?.lastName ||
      item?.name ||
      item?.definitionId ||
      "Unknown";

    const getCurrentConceptItems = () => {
      const controller = getControllerInstance();
      const { _squad } = controller || {};
      const squadPlayers = Array.isArray(_squad?._players)
        ? _squad._players
        : [];
      return squadPlayers
        .map((slot) => slot?._item)
        .filter((item) => item && item.concept);
    };

    const quickBuySquadButton = createButton(
      "idQuickBuySquad",
      "Quick Buy Squad",
      async () => {
        if (quickBuySquadButton.dataset.running === "true") {
          return;
        }
        quickBuySquadButton.dataset.running = "true";
        quickBuySquadButton.setAttribute("disabled", "disabled");
        quickBuySquadButton.classList.add("disabled");

        const {
          container: statusContainer,
          content: statusContent,
          footer: timerFooter,
        } = ensureStatusContainer();
        statusContainer.style.display = "flex";
        statusContent.innerHTML = "";
        timerFooter.textContent = "";

        const titleBlock = document.createElement("div");
        titleBlock.textContent = "Quick Buy Squad";
        titleBlock.style.fontWeight = "bold";
        titleBlock.style.marginBottom = "0.35rem";
        statusContent.appendChild(titleBlock);

        const conceptItems = getCurrentConceptItems();
     

        if (!conceptItems.length) {
          showNotification(
            "No concept players found in the current squad.",
            UINotificationType.NEGATIVE
          );
          delete quickBuySquadButton.dataset.running;
          quickBuySquadButton.removeAttribute("disabled");
          quickBuySquadButton.classList.remove("disabled");
          return;
        }

        let successCount = 0;

        try {
          const headerRow = document.createElement("div");
          headerRow.className = "quick-buy-squad-row quick-buy-squad-header";
          headerRow.style.display = "grid";
          headerRow.style.gridTemplateColumns = "2fr 1fr 1fr";
          headerRow.style.gap = "0.5rem";
          headerRow.style.fontWeight = "bold";
          headerRow.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";

          const headerLabels = ["Player", "Expected", "Status"];
          headerLabels.forEach((label) => {
            const span = document.createElement("span");
            span.textContent = label;
            headerRow.appendChild(span);
          });
          statusContent.appendChild(headerRow);

          const rowData = conceptItems.map((conceptItem) => {
            const name = formatPlayerName(conceptItem);
            const rawExpectedPrice = getPrice(conceptItem);
            const expectedPrice =
              typeof rawExpectedPrice === "number" &&
              Number.isFinite(rawExpectedPrice) &&
              rawExpectedPrice > 0
                ? rawExpectedPrice
                : NaN;
            const expectedLabel = Number.isFinite(expectedPrice)
              ? expectedPrice.toLocaleString()
              : "N/A";

            const row = document.createElement("div");
            row.className = "quick-buy-squad-row";
            row.style.display = "grid";
            row.style.gridTemplateColumns = "2fr 1fr 1fr";
            row.style.gap = "0.5rem";
            row.style.alignItems = "center";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = name;

            const priceSpan = document.createElement("span");
            priceSpan.textContent = expectedLabel;

            const statusSpan = document.createElement("span");
            statusSpan.textContent = "Queued";

            row.append(nameSpan, priceSpan, statusSpan);
            statusContent.appendChild(row);

            return {
              conceptItem,
              expectedPrice,
              expectedLabel,
              statusSpan,
            };
          });

          statusContent.scrollTop = statusContent.scrollHeight;

          for (let i = 0; i < rowData.length; i++) {
            const { conceptItem, expectedPrice, expectedLabel, statusSpan } =
              rowData[i];

            statusSpan.textContent = "Buying...";
            statusSpan.style.color = "";

            const result = await tryQuickBuy(
              { quickBuyButton: { __root: quickBuySquadButton } },
              conceptItem,
              { suppressNotifications: true }
            );

            if (result?.success) {
              successCount += 1;
              const label = result?.priceLabel || expectedLabel;
              statusSpan.textContent = label ? `Success @ ${label}` : "Success";
              statusSpan.style.color = "#07f468";
            } else {
              let reasonLabel = "Failed";
              if (result?.reason === "noCachedPrice") {
                reasonLabel = "Missing cached price";
              } else if (result?.reason === "noListing") {
                reasonLabel = "No active listing";
              } else if (result?.reason === "priceAboveBaseline") {
                const baselineLabel =
                  result?.baselineLabel ||
                  (Number.isFinite(result?.baseline)
                    ? result.baseline.toLocaleString()
                    : "unknown");
                const priceLabel = result?.priceLabel || expectedLabel;
                reasonLabel =
                  priceLabel && baselineLabel
                    ? `Skipped ${priceLabel} > ${baselineLabel}`
                    : "Skipped (price too high)";
              } else if (result?.reason === "bidFailed") {
                reasonLabel = "Bid rejected";
              } else if (result?.reason === "error") {
                reasonLabel = "Error";
              }
              statusSpan.textContent = reasonLabel;
              statusSpan.style.color = "#f40727";
            }

            if (i < rowData.length - 1) {
              const delay = 2000 + Math.floor(Math.random() * 3000);
              await runCountdown(delay, timerFooter, "Next buy in");
            } else {
              timerFooter.textContent = "";
            }
          }

          const total = conceptItems.length;
          const summaryMessage = `Quick buy squad complete: ${successCount}/${total} players purchased`;
          const summaryType =
            successCount === total
              ? UINotificationType.POSITIVE
              : UINotificationType.NEGATIVE;
          showNotification(summaryMessage, summaryType);
        } catch (error) {
          console.error("Quick buy squad error", error);
          showNotification(
            "Quick buy squad encountered an error",
            UINotificationType.NEGATIVE
          );
        } finally {
          await runCountdown(5000, timerFooter, "Closing in");
          statusContainer.style.display = "none";
          statusContent.innerHTML = "";
          timerFooter.textContent = "";
          delete quickBuySquadButton.dataset.running;
          quickBuySquadButton.removeAttribute("disabled");
          quickBuySquadButton.classList.remove("disabled");
        }
      }
    );
    

     
   
    insertAfter(quickBuySquadButton, button);
    

    const ensureStatusContainer = () => {
      const statusContainerId = "quick-buy-squad-status";
      let container = document.getElementById(statusContainerId);
      if (!container) {
        container = document.createElement("div");
        container.id = statusContainerId;
        container.className = "quick-buy-squad-status";
        container.style.padding = "0.75rem";
        container.style.background = "rgba(17, 24, 39, 0.9)";
        container.style.border = "1px solid rgba(255, 255, 255, 0.15)";
        container.style.borderRadius = "10px";
        container.style.display = "none";
        container.style.flexDirection = "column";
        container.style.gap = "0.35rem";
        container.style.maxHeight = "90vh";
        container.style.overflow = "hidden";
        container.style.position = "fixed";
        container.style.bottom = "1.5rem";
        container.style.right = "2rem";
        container.style.zIndex = "9999";
        container.style.minWidth = "320px";
        container.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.45)";
        container.style.boxSizing = "border-box";

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.textContent = "×";
        closeButton.setAttribute("aria-label", "Close quick buy status");
        closeButton.style.position = "absolute";
        closeButton.style.top = "0.35rem";
        closeButton.style.right = "0.5rem";
        closeButton.style.background = "transparent";
        closeButton.style.border = "none";
        closeButton.style.color = "#ffffff";
        closeButton.style.fontSize = "1.2rem";
        closeButton.style.cursor = "pointer";
        closeButton.style.lineHeight = "1";
        closeButton.style.padding = "0";
        closeButton.addEventListener("click", () => {
          container.style.display = "none";
        });

        const content = document.createElement("div");
        content.className = "quick-buy-squad-content";
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.gap = "0.35rem";
        content.style.overflowY = "auto";
        content.style.maxHeight = "calc(90vh - 2.5rem)";

        const footer = document.createElement("div");
        footer.className = "quick-buy-squad-footer";
        footer.style.marginTop = "0.5rem";
        footer.style.fontSize = "0.85rem";
        footer.style.opacity = "0.85";
        footer.style.minHeight = "1.2rem";
        footer.style.textAlign = "center";

        container.append(closeButton, content, footer);
        document.body.appendChild(container);
      }

      const content = container.querySelector(".quick-buy-squad-content");
      const footer = container.querySelector(".quick-buy-squad-footer");
      return { container, content, footer };
    };

    return response;
  };
};
const sbcButtonOverride = () => {
  const UTSBCSetTileView_render = UTSBCSetTileView.prototype.render;
  UTSBCSetTileView.prototype.render = function render() {
    UTSBCSetTileView_render.call(this);
    if (this.data) {
      insertBefore(
        createElem("span", null, `COMPLETED: ${this.data.timesCompleted}. `),
        this.__rewardsHeader
      );
    }
  };
};

const tryQuickBuy = async (context = {}, item, options = {}) => {
  const { suppressNotifications = false } = options;

  const notify = (message, type) => {
    if (!suppressNotifications) {
      showNotification(message, type);
    }
  };

  const buttonRoot = context?.quickBuyButton
    ? context.quickBuyButton.__root || context.quickBuyButton
    : null;

  try {
    const baselinePrice = Number(getPrice(item));
    if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) {
      notify("No cached price available", UINotificationType.NEGATIVE);
      return { success: false, reason: "noCachedPrice" };
    }

    const listing = await fetchLivePlayerPrice(item);
    const listingPrice = Number(listing?._auction?.buyNowPrice);
    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      notify("No active listing found", UINotificationType.NEGATIVE);
      return { success: false, reason: "noListing" };
    }

    const lowestPrice = listingPrice;
    const priceLabel = lowestPrice.toLocaleString();
    if (buttonRoot?.setAttribute) {
      buttonRoot.setAttribute("title", `Quick Buy @${priceLabel}`);
    }

    if (lowestPrice > baselinePrice) {
      notify(
        `Lowest listing (${priceLabel}) exceeds expected price (${baselinePrice.toLocaleString()})`,
        UINotificationType.NEGATIVE
      );
      return {
        success: false,
        reason: "priceAboveBaseline",
        price: lowestPrice,
        priceLabel,
        baseline: baselinePrice,
        baselineLabel: baselinePrice.toLocaleString(),
      };
    }

    const definitionId = Number(listing?.definitionId || item?.definitionId || 0);
    const auctionId = Number(listing?._auction?.tradeId || listing?._auction?.id || listing?.id || 0);
    const bidResponse = await executeFcxEaRequest(
      () => services.Item.bid(listing, lowestPrice),
      "购买转会市场球员",
      {
        scope: "Price",
        verifyAfterFailure: async () => {
          try {
            const unassigned = await fetchUnassigned();
            if (unassigned.some((candidate) =>
              Number(candidate?.definitionId || 0) === definitionId
            )) {
              return { state: "applied", value: { success: true, status: 200 } };
            }
            services.Item.clearTransferMarketCache();
            const criteria = new UTBucketedItemSearchViewModel().searchCriteria;
            criteria.type = ItemType.PLAYER;
            criteria.definitionId = definitionId;
            criteria.maxBuy = lowestPrice;
            const result = await executeFcxEaRequest(
              () => services.Item.searchTransferMarket(criteria, 1),
              "核验转会市场购买状态",
              { scope: "Price", ignoreCancellation: true }
            );
            const listings = result?.data?.items || result?.response?.items || [];
            const stillAvailable = listings.some((candidate) =>
              Number(candidate?._auction?.tradeId || candidate?._auction?.id || candidate?.id || 0) === auctionId
            );
            return stillAvailable
              ? { state: "not_applied" }
              : { state: "unknown", reason: "购买结果无法确认，为避免重复扣费未自动重试" };
          } catch (error) {
            return { state: "unknown", reason: `购买状态核验失败：${error?.message || error}` };
          }
        },
      }
    );
    const success = bidResponse?.success !== false;
    if (success) {
      try {
        await dealWithUnassigned();
      } catch (err) {
        console.error("dealWithUnassigned error", err);
      }
    }
    notify(
      success ? `Quick buy success at ${priceLabel}` : "Quick buy failed",
      success ? UINotificationType.POSITIVE : UINotificationType.NEGATIVE
    );
    return {
      success,
      reason: success ? "success" : "bidFailed",
      price: lowestPrice,
      priceLabel,
    };
  } catch (error) {
    console.error("Quick buy error", error);
    notify("Quick buy encountered an error", UINotificationType.NEGATIVE);
    return { success: false, reason: "error", error };
  }
};

const lockedLabel = "解除SBC锁定";
const unlockedLabel = "锁定球员";
const fixedLabel = "SBC Use actual prices";
const unfixedLabel = "SBC Set Price to Zero";

const setDiyEvolutionButtonVisibility = (context, visible) => {
  const button = context?.diyEvolutionButton;
  if (!button) return;
  button.setInteractionState(Boolean(visible));
  const root = button.__root || button;
  if (root?.style) root.style.display = visible ? "" : "none";
};

const syncDiyEvolutionButton = (context, item, anchor = null) => {
  context.diyEvolutionItem = item;
  const eligible = canOpenAcademyPlayerEditorForItem(item);
  if (context.diyEvolutionButton) {
    setDiyEvolutionButtonVisibility(context, eligible);
    return;
  }
  if (!eligible || !anchor) return;
  const button = new UTGroupButtonControl();
  button.init();
  button.setInteractionState(true);
  button.setText("DIY进化");
  insertAfter(button, anchor);
  button.addTarget(
    context,
    async () => {
      if (context.diyEvolutionRunning) return;
      const currentItem = context.diyEvolutionItem;
      if (!canOpenAcademyPlayerEditorForItem(currentItem)) {
        setDiyEvolutionButtonVisibility(context, false);
        showNotification(
          "当前球员已不符合DIY进化条件，请刷新后重试。",
          UINotificationType.NEGATIVE
        );
        return;
      }
      context.diyEvolutionRunning = true;
      button.setInteractionState(false);
      try {
        await openAcademyPlayerEditorForItem(currentItem);
      } catch (error) {
        console.warn("[FCX][EVO] 球员详情DIY进化打开失败", error);
        showNotification(
          error?.message || "DIY进化打开失败，请刷新后重试。",
          UINotificationType.NEGATIVE
        );
      } finally {
        context.diyEvolutionRunning = false;
        setDiyEvolutionButtonVisibility(
          context,
          canOpenAcademyPlayerEditorForItem(context.diyEvolutionItem)
        );
      }
    },
    EventType.TAP
  );
  context.diyEvolutionButton = button;
};

const playerItemOverride = () => {
  UTItemEntity.prototype.isDuplicateLoanPlayer = function () {
    return (
      this.isValid() &&
      this.isPlayer() &&
      this.duplicateId > 0 &&
      this.isLimitedUse()
    );
  };
  UTItemEntity.prototype.isDuplicate = function () {
    return this.isValid() && this.isPlayer() && this.duplicateId > 0;
  };
  const UTDefaultSetItem = UTSlotActionPanelView.prototype.setItem;
  UTSlotActionPanelView.prototype.setItem = function (e, t) {
    e.isDuplicate = function () {
      return e.isValid() && e.isPlayer() && e.duplicateId > 0;
    };
    e.isDuplicateLoanPlayer = function () {
      return (
        e.isValid() && e.isPlayer() && e.duplicateId > 0 && e.isLimitedUse()
      );
    };
    const result = UTDefaultSetItem.call(this, e, t);

    // Concept players keep the existing quick-buy helper; manual price refresh is intentionally absent.
    if (!this.quickBuyButton && e.isPlayer() && e.concept) {
      const quickButton = new UTGroupButtonControl();
      quickButton.init();
      quickButton.setInteractionState(true);
      quickButton.setText("Quick Buy");
      insertAfter(quickButton, this._btnBio.__root);
      quickButton.addTarget(this, () => tryQuickBuy(this, e), EventType.TAP);
      this.quickBuyButton = quickButton;
    }

    if (e.loans > -1 || !e.isPlayer() || !e.id || e.isTimeLimited()) {
      syncDiyEvolutionButton(this, e);
      return result;
    }
    // console.log(e)
    if (!e?.duplicateId > 0 && !isItemFixed(e) && !this.lockUnlockButton) {
      const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
      const button = new UTGroupButtonControl();
      button.init();
      insertAfter(button, this._btnBio.__root);

      button.setInteractionState(true);
      button.setText(label);

      button.addTarget(
        this,
        async () => {
          if (isItemLocked(e)) {
            unlockItem(e);
            button.setText(unlockedLabel);
            showNotification(`已解除球员锁定`, UINotificationType.POSITIVE);
          } else {
            lockItem(e);

            button.setText(lockedLabel);
            showNotification(`球员已锁定`, UINotificationType.POSITIVE);
          }
          refreshOpenLockedPlayersPanel();
          getControllerInstance().applyDataChange();
          getCurrentViewController()
            .getCurrentController()
            .rightController.currentController.renderView();
        },
        EventType.TAP
      );
      this.lockUnlockButton = button;
    }
    syncDiyEvolutionButton(
      this,
      e,
      this.lockUnlockButton?.__root || this._btnBio.__root
    );
    if (!isItemLocked(e) && !this.fixUnfixButton) {
      const fixLabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
      const fixbutton = new UTGroupButtonControl();
      fixbutton.init();
      fixbutton.setInteractionState(true);
      fixbutton.setText(fixLabel);
      insertAfter(fixbutton, this._btnBio.__root);
      fixbutton.addTarget(
        this,
        async () => {
          if (isItemFixed(e)) {
            unfixItem(e);
            fixbutton.setText(unfixedLabel);
            showNotification(`Removed Must Use`, UINotificationType.POSITIVE);
          } else {
            fixItem(e);
            fixbutton.setText(fixedLabel);
            showNotification(`Must Use Set`, UINotificationType.POSITIVE);
          }
          getControllerInstance().applyDataChange();
          getCurrentViewController()
            .getCurrentController()
            .rightController.currentController.renderView();
        },
        EventType.TAP
      );
      this.fixUnfixButton = fixbutton;
    }

    return result;
  };

  const UTDefaultAction = UTDefaultActionPanelView.prototype.render;
  UTDefaultActionPanelView.prototype.render = function (e, t, i, o, n, r, s) {
    e.isDuplicate = function () {
      return e.isValid() && e.isPlayer() && e.duplicateId > 0;
    };
    e.isDuplicateLoanPlayer = function () {
      return (
        e.isValid() && e.isPlayer() && e.duplicateId > 0 && e.isLimitedUse()
      );
    };
    const result = UTDefaultAction.call(this, e, t, i, o, n, r, s);
    if (!this.quickBuyButton && e.isPlayer() && e.concept) {
      const quickButton = new UTGroupButtonControl();
      quickButton.init();
      quickButton.setInteractionState(true);
      quickButton.setText("Quick Buy");
      insertAfter(quickButton, this._bioButton.__root);
      quickButton.addTarget(this, () => tryQuickBuy(this, e), EventType.TAP);
      this.quickBuyButton = quickButton;
    }
    if (e.loans > -1 || !e.isPlayer() || !e.id || e.isTimeLimited()) {
      syncDiyEvolutionButton(this, e);
      return result;
    }

    if (!e?.duplicateId > 0 && !isItemFixed(e)) {
      const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
      if (!this.lockUnlockButton) {
        const button = new UTGroupButtonControl();
        button.init();
        button.setInteractionState(true);
        button.setText(label);
        insertAfter(button, this._bioButton.__root);
        button.addTarget(
          this,
          async () => {
            if (isItemLocked(e)) {
              unlockItem(e);
              button.setText(unlockedLabel);
              showNotification(`已解除球员锁定`, UINotificationType.POSITIVE);
            } else {
              lockItem(e);
              button.setText(lockedLabel);
              showNotification(`球员已锁定`, UINotificationType.POSITIVE);
            }
            refreshOpenLockedPlayersPanel();
            try {
              getCurrentViewController()
                .getCurrentController()
                .leftController.renderView();
              getCurrentViewController()
                .getCurrentController()
                .rightController.currentController.renderView();
            } catch (error) {
              getCurrentViewController()
                .getCurrentController()
                .leftController.refreshList();
            }
          },
          EventType.TAP
        );
        this.lockUnlockButton = button;
      }
    }
    syncDiyEvolutionButton(
      this,
      e,
      this.lockUnlockButton?.__root || this._bioButton.__root
    );
    if (!isItemLocked(e)) {
      const fixlabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
      if (!this.fixUnfixButton) {
        const button = new UTGroupButtonControl();
        button.init();
        button.setInteractionState(true);
        button.setText(fixlabel);
        insertAfter(button, this._bioButton.__root);
        button.addTarget(
          this,
          async () => {
            if (isItemFixed(e)) {
              unfixItem(e);
              button.setText(unfixedLabel);
              showNotification(`Removed Must Use`, UINotificationType.POSITIVE);
            } else {
              fixItem(e);
              button.setText(fixedLabel);
              showNotification(`Must Use Set`, UINotificationType.POSITIVE);
            }
            try {
              getCurrentViewController()
                .getCurrentController()
                .leftController.renderView();
              getCurrentViewController()
                .getCurrentController()
                .rightController.currentController.renderView();
            } catch (error) {
              getCurrentViewController()
                .getCurrentController()
                .leftController.refreshList();
            }
          },
          EventType.TAP
        );
        this.fixUnfixButton = button;
      }
    }

    return result;
  };

  const UTPlayerItemView_renderItem = UTPlayerItemView.prototype.renderItem;
  UTPlayerItemView.prototype.renderItem = async function (item, t) {
    const result = UTPlayerItemView_renderItem.call(this, item, t);
    const renderRoot = this.__root;
    const renderToken = Symbol("fcx-player-render");
    this.__fcxRenderToken = renderToken;
    const isCurrentRender = () =>
      this.__fcxRenderToken === renderToken
      && Boolean(renderRoot)
      && this.__root === renderRoot
      && renderRoot.isConnected !== false;
    const priceRequest = Promise.resolve(fetchPlayerPrices([item])).catch((error) => {
      console.warn("[FCX][Item] 球员价格读取失败", error);
    });
    const [duplicateIds, storage] = await Promise.all([
      Promise.resolve(fetchDuplicateIds()).catch(() => []),
      Promise.resolve(getStoragePlayers()).catch(() => []),
    ]);
    if (!isCurrentRender()) {
      await priceRequest;
      return result;
    }
    if (
      duplicateIds.includes(item.id) ||
      storage.map((m) => m.id).includes(item.id)
    ) {
      renderRoot.style.opacity = "0.4";
    }
    await priceRequest;
    if (!isCurrentRender()) return result;
    let priceElement = await getPriceDiv(item);
    if (!isCurrentRender()) return result;
    // Add the price element to the player item
    if (priceElement) {
      renderRoot.querySelector(".item-price")?.remove();
      renderRoot.prepend(priceElement);
    }

    if (!isCurrentRender()) return result;
    if (isItemLocked(item)) {
      addClass(this, "locked");
    } else {
      removeClass(this, "locked");
    }
    if (isItemFixed(item)) {
      addClass(this, "fixed");
    } else {
      removeClass(this, "fixed");
    }
    return result;
  };
};
