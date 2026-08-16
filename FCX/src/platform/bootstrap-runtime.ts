// @ts-nocheck
// FCX compatibility runtime for the EA Web App.

const popupOverride = () => {};

const registerFcxDebugShortcuts = () => document.addEventListener("keydown", async function onKeyR(e) {
  if (e.key === "z" && !e.repeat) {
    let storage = await getStorage();
    console.log("Pressed “z”: fetching storage items…");

    let counts = {};
    for (const item of storage.map((m) => m.rating)) {
      counts[item] = (counts[item] || 0) + 1;
      counts.total = (counts.total || 0) + 1;
    }
    console.log("Storage item counts:", counts);
  }
  if (e.key === "q" && !e.repeat) {
    console.log("Pressed “q”: quickselling unassigned items…");
    dealWithUnassigned();

    goToUnassignedView();
    let packs = await getPacks();
    let nextPack = packs.packs.find((p) => p.isMyPack);
    if (nextPack) {
      let pp = await fetchUnassigned();
      // analyze unassigned player ratings
      const playerRatings = pp
        .filter((item) => item.isPlayer())
        .map((item) => item.rating);
      const avgRating =
        playerRatings.reduce((sum, r) => sum + r, 0) / playerRatings.length;
      console.log(
        "Unassigned ratings:",
        playerRatings,
        "Average rating:",
        avgRating
      );

      // pick next SBC set based on count rating
      const tierCounts = {
        below82: playerRatings.filter((r) => r < 82).length,
        between82and88: playerRatings.filter((r) => r >= 82 && r <= 88).length,
        between89and91: playerRatings.filter((r) => r > 88 && r < 92).length,
        above92: playerRatings.filter((r) => r >= 92).length,
      };
      console.log("Unassigned rating tiers count:", tierCounts);

      let nextSetId;

      // kick off the solver for the chosen SBC
      solveSBC(nextSetId, 0, true);
    }
  }
  // ignore repeats, only respond to lower‐case r
  if (e.key === "r" && !e.repeat) {
    console.log("Pressed “r”: fetching unassigned items…");
    try {
      let pp = await fetchUnassigned();
      let playerPicks = pp.filter((m) => m.isPlayerPickItem());
      await executeFcxEaRequest(
        () => services.Item.redeem(playerPicks[0]),
        "打开球员挑选",
        {
          scope: "Pack",
          verifyAfterFailure: async () => {
            try {
              const pending = await executeFcxEaRequest(
                () => services.Item.requestPendingPlayerPickItemSelection(),
                "核验球员挑选打开状态",
                { scope: "Pack", ignoreCancellation: true }
              );
              return normalizePlayerPickPayload(pending)?.items?.length
                ? { state: "applied", value: { success: true, status: 200 } }
                : { state: "unknown", reason: "球员挑选打开结果无法确认，为避免重复操作未自动重试" };
            } catch (error) {
              return { state: "unknown", reason: `球员挑选状态核验失败：${error?.message || error}` };
            }
          },
        }
      );
      let n = new UTItemDetailsViewController();
      const pending = await executeFcxEaRequest(
        () => services.Item.requestPendingPlayerPickItemSelection(),
        "读取待确认球员挑选",
        { scope: "Pack" }
      );
      pending.success && JSUtils.isObject(pending.response)
        ? n.showPlayerPicks(
            pending.response.items,
            pending.response.availablePicks,
            !0
          )
        : NetworkErrorManager.handleStatus(pending.status);
    } catch (err) {
      console.error("Error fetching or filtering:", err);
    }
  }
});

let sbcSolverInitialized = false;
const init = () => {
  if (sbcSolverInitialized) {
    return;
  }

  let isAllLoaded = false;
  if (typeof services !== "undefined" && services.Localization) {
    isAllLoaded = true;
  }
  if (isAllLoaded) {
    if (!sideBarNavOverride()) {
      setTimeout(init, 100);
      return;
    }
    // Mark as initialized
    syncBadgeContent();
    sbcSolverInitialized = true;
    sbcViewOverride();
    sbcButtonOverride();
    playerItemOverride();
    playerSlotOverride();
    installInventorySnapshotHooks();
    installManualPlayerPickAction();
    favTagOverride();
    sbcSubmitChallengeOverride();
    unassignedItemsOverride();
    initDefaultSettings();
    initializePlayerProtection();
    void ensurePriceItemsLoaded();
    futHomeOverride();
    showFcxLoadedBadge();
    void fcxRemoteControl.start();
  } else {
    setTimeout(init, 4000);
    console.log(
      "SBC Solver: Waiting for all services to load before initializing."
    );
  }
};

let fcxRuntimeStarted = false;
let fcxVersionUpdateController;
const startFcxRuntime = () => {
  if (fcxRuntimeStarted) return;
  fcxRuntimeStarted = true;
  registerFcxDebugShortcuts();
  void harvestMoment
    .initialize()
    .then(() => harvestMoment.startRetryLoop())
    .catch((error) => console.warn("[FCX][Harvest] initialization failed", error));
  scriptRuntimeLogs.start();
  startSbcActivitySync();
  const headerSupport = mountFcxHeaderSupport(document, {
    currentVersion: __FCX_SCRIPT_VERSION__,
    onVersionClick: () => void fcxVersionUpdateController?.checkManually(),
  });
  fcxVersionUpdateController = new FcxVersionUpdateController({
    currentVersion: __FCX_SCRIPT_VERSION__,
    request: GM_xmlhttpRequest,
    storage: createGmValueAdapter(),
    header: headerSupport,
    documentRef: document,
  });
  if (__FCX_AUTO_UPDATE_CHECK__) {
    void fcxVersionUpdateController.checkAutomatically();
  }
  void fcxRoutineCatalogController.loadOnce();
  // The Store view is available before every EA service finishes loading.
  // Install this UI-only hook independently so owned-pack actions are not
  // blocked by Localization or unrelated service startup failures.
  packOverRide();
  init();
};

let fcxNavigationPreparationTimer;
const prepareFcxNavigation = () => {
  if (sideBarNavOverride()) {
    if (fcxNavigationPreparationTimer) clearTimeout(fcxNavigationPreparationTimer);
    fcxNavigationPreparationTimer = undefined;
    return;
  }
  fcxNavigationPreparationTimer = setTimeout(prepareFcxNavigation, 50);
};

document.documentElement.classList.add("fcx-consent-pending");
prepareFcxNavigation();
void ensureFcxDisclaimerAccepted(createGmValueAdapter(), document)
  .then(() => {
    document.documentElement.classList.remove("fcx-consent-pending");
    syncAutoSbcTabVisibility();
    startFcxRuntime();
  })
  .catch((error) => console.error("[FCX][Disclaimer] initialization failed", error));
