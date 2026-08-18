// @ts-nocheck
// FCX compatibility runtime for the EA Web App.

let isSideBarNavOverrideInstalled = false;

const sideBarNavOverride = () => {
  if (isSideBarNavOverrideInstalled) return true;
  if (
    typeof UTGameTabBarController === "undefined" ||
    typeof UTGameTabBarController.prototype?.initWithViewControllers !== "function"
  ) {
    return false;
  }
  const navViewInit = UTGameTabBarController.prototype.initWithViewControllers;
  isSideBarNavOverrideInstalled = true;
  UTGameTabBarController.prototype.initWithViewControllers = function (tabs) {
    // EA initializes this controller once. Mutating its live controller array on
    // later calls desynchronizes childViewControllers from the visible tabItems.
    if (this.initialized) {
      navViewInit.call(this, tabs);
      setTimeout(syncAutoSbcTabVisibility, 0);
      return;
    }
    tabs = Array.isArray(tabs) ? tabs.slice() : [];
    const getTabText = (tab) =>
      tab.tabBarItem && tab.tabBarItem.getText
        ? tab.tabBarItem.getText()
        : "";
    let sbcSolverIndex = tabs.findIndex((tab) =>
      [
        uiText.navigation.solver,
        uiText.navigation.previousSolver,
        uiText.navigation.legacySolver,
      ].includes(
        getTabText(tab)
      )
    );
    let autoSbcIndex = tabs.findIndex((tab) =>
      [uiText.navigation.autoSbc, uiText.navigation.legacyAutoSbc].includes(
        getTabText(tab)
      )
    );
    if (sbcSolverIndex === -1) {
      const navBar = new UTGameFlowNavigationController();
      navBar.initWithRootController(new sbcSettingsController());
      navBar.tabBarItem = generateSbcSolveTab();
      tabs.push(navBar);
      sbcSolverIndex = tabs.length - 1;
    } else if (tabs[sbcSolverIndex].tabBarItem?.setText) {
      tabs[sbcSolverIndex].tabBarItem.setText(uiText.navigation.solver);
      tabs[sbcSolverIndex].tabBarItem.addClass?.("icon-fcx-brand");
    }

    if (autoSbcIndex === -1) {
      const autoSbcNavBar = new UTGameFlowNavigationController();
      autoSbcNavBar.initWithRootController(new autoSbcController());
      autoSbcNavBar.tabBarItem = generateAutoSbcTab();
      tabs.splice(sbcSolverIndex + 1, 0, autoSbcNavBar);
    } else {
      const autoSbcNavBar = tabs.splice(autoSbcIndex, 1)[0];
      autoSbcNavBar.tabBarItem?.setText?.(uiText.navigation.autoSbc);
      autoSbcNavBar.tabBarItem?.addClass?.("icon-fcx-brand");
      sbcSolverIndex = tabs.findIndex((tab) =>
        [
          uiText.navigation.solver,
          uiText.navigation.previousSolver,
          uiText.navigation.legacySolver,
        ].includes(
          getTabText(tab)
        )
      );
      tabs.splice(sbcSolverIndex + 1, 0, autoSbcNavBar);
    }

    navViewInit.call(this, tabs);
    setTimeout(syncAutoSbcTabVisibility, 0);
  };
  return true;
};

let setSolverSettings = function (key, Settings) {
  fcxSettingsStore.setSection(key, Settings);
};

let getSolverSettings = function () {
  return fcxSettingsStore.getDocument();
};

let activeSettingsSession = null;

const markSettingsDraftDirty = (session = activeSettingsSession) => {
  if (!session || session.settings.isDisposed) return;
  const status = session.footer?.querySelector(".fcx-settings-save-status");
  if (status) status.textContent = "有未保存的更改";
  const savebar = session.footer;
  savebar?.removeAttribute("hidden");
  savebar?.classList.add("is-dirty");
  savebar?.classList.remove("is-saved");
  savebar?.querySelector(".fcx-settings-save")?.removeAttribute("disabled");
};

const refreshSettingsController = (session) => {
  if (!session || activeSettingsSession !== session) {
    throw new Error("当前设置页面已经关闭");
  }
  const currentController = getCurrentViewController();
  const navigationController = currentController?.getNavigationController?.();
  if (!navigationController) throw new Error("无法刷新 FCX 设置页面");
  navigationController.popViewController();
  navigationController.pushViewController(new sbcSettingsController());
};

const hideSettingsControl = (control) => {
  control?.classList.add("fcx-settings-control--hidden");
  control?.setAttribute("aria-hidden", "true");
  return control;
};

const generateSbcSolveTab = () => {
  const sbcSolveTab = new UTTabBarItemView();
  sbcSolveTab.init();
  sbcSolveTab.setTag(6);
  sbcSolveTab.setText(uiText.navigation.solver);
  sbcSolveTab.addClass("icon-sbcSettings");
  sbcSolveTab.addClass("icon-fcx-brand");
  return sbcSolveTab;
};

const generateAutoSbcTab = () => {
  const autoSbcTab = new UTTabBarItemView();
  autoSbcTab.init();
  autoSbcTab.setTag(61);
  autoSbcTab.setText(uiText.navigation.autoSbc);
  autoSbcTab.addClass("icon-autoSbc");
  autoSbcTab.addClass("icon-fcx-brand");
  return autoSbcTab;
};

const syncAutoSbcTabVisibility = () => {
  const isVisible = getSettings(0, 0, "showSbcTab") !== false;
  document.querySelectorAll(".icon-autoSbc").forEach((tab) => {
    tab.style.display = isVisible ? "" : "none";
    tab.setAttribute("aria-hidden", String(!isVisible));
  });
  mountPlayerEvolutionTab();
};

const renderFcxViewFailure = (view, pageTitle, error) => {
  const message = error?.message || String(error || "未知错误");
  if (view.__root) DOMKit.remove(view.__root);
  const root = document.createElement("div");
  root.className = "fcx-view-error-shell";
  root.innerHTML = `
    <section class="fcx-view-error-card" role="alert">
      <span class="fcx-view-error-badge">FCX</span>
      <h1>${pageTitle}加载失败</h1>
      <p>FCX 页面暂时无法显示，您仍可使用左侧导航返回 EA 其他页面。</p>
      <p class="fcx-view-error-detail">${String(message)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")}</p>
      <p class="fcx-view-error-help">请刷新页面后重试；如果问题持续，请通过顶部“捐赠/反馈”联系我们。</p>
    </section>`;
  view.__root = root;
  view._generated = true;
};

const fcxStandaloneView = function () {
  EAView.call(this);
};
JSUtils.inherits(fcxStandaloneView, EAView);
fcxStandaloneView.prototype.init = function () {
  try {
    initializeFcxStandaloneView(this);
  } catch (error) {
    console.error("[FCX][View] 页面初始化失败", error);
    renderFcxViewFailure(this, this.__fcxPageTitle || "FCX 页面", error);
  }
};

const fcxFailureView = function (pageTitle, error) {
  this.__fcxPageTitle = pageTitle;
  this.__fcxFailure = error;
  fcxStandaloneView.call(this);
};
JSUtils.inherits(fcxFailureView, fcxStandaloneView);
fcxFailureView.prototype._generate = function () {
  renderFcxViewFailure(
    this,
    this.__fcxPageTitle || "FCX 页面",
    this.__fcxFailure
  );
};
fcxFailureView.prototype.destroyGeneratedElements = function () {
  DOMKit.remove(this.__root);
  this.__root = null;
};

const createFcxPageView = (pageTitle, createView) =>
  createFcxViewSafely(
    createView,
    (error) => new fcxFailureView(pageTitle, error),
    (error) => console.error(`[FCX][View] ${pageTitle}构造失败`, error)
  );

const renderFcxAuthorSocialLinks = () => `
  <div class="auto-sbc-author-socials" aria-label="关注一阵失心风">
    <a class="auto-sbc-author-social auto-sbc-author-social--douyin" href="${FCX_DOUYIN_URL}" target="_blank" rel="noopener noreferrer" aria-label="关注抖音" title="关注抖音">${DOUYIN_ICON_SVG}</a>
    <a class="auto-sbc-author-social auto-sbc-author-social--bilibili" href="${FCX_BILIBILI_URL}" target="_blank" rel="noopener noreferrer" aria-label="关注B站" title="关注B站">${BILIBILI_ICON_SVG}</a>
  </div>`;

const sbcSettingsController = function (t) {
  UTHomeHubViewController.call(this);
};

JSUtils.inherits(sbcSettingsController, UTHomeHubViewController);

sbcSettingsController.prototype._getViewInstanceFromData = function () {
  return createFcxPageView("FCX设置", () => new sbcSettingsView());
};

sbcSettingsController.prototype.viewDidAppear = function () {
  this.getNavigationController().setNavigationVisibility(true, true);
};

const sbcSettingsView = function (t) {
  this.__fcxPageTitle = "FCX设置";
  fcxStandaloneView.call(this);
};
JSUtils.inherits(sbcSettingsView, fcxStandaloneView);
sbcSettingsController.prototype.viewWillDisappear = function () {
  this.getNavigationController().setNavigationVisibility(false, false);
};
sbcSettingsController.prototype.getNavigationTitle = function () {
  return uiText.navigation.solver;
};

const autoSbcController = function () {
  UTHomeHubViewController.call(this);
};

JSUtils.inherits(autoSbcController, UTHomeHubViewController);

autoSbcController.prototype._getViewInstanceFromData = function () {
  return createFcxPageView("自动SBC", () => new autoSbcView());
};

autoSbcController.prototype.viewDidAppear = function () {
  this.getNavigationController().setNavigationVisibility(true, true);
  createSBCTab();
};

autoSbcController.prototype.viewWillDisappear = function () {
  this.getNavigationController().setNavigationVisibility(false, false);
};

autoSbcController.prototype.getNavigationTitle = function () {
  return uiText.navigation.autoSbc;
};

const autoSbcView = function () {
  this.__fcxPageTitle = "自动SBC";
  fcxStandaloneView.call(this);
};

JSUtils.inherits(autoSbcView, fcxStandaloneView);

autoSbcView.prototype.destroyGeneratedElements = function () {
  unmountAutoSbcPage(this.__autoSbcWorkspace);
  DOMKit.remove(this.__root);
  this.__autoSbcWorkspace = null;
  this.__root = null;
};

autoSbcView.prototype._generate = function () {
  const root = document.createElement("div");
  root.classList.add("auto-sbc-page-shell");
  root.id = "AutoSbcPanel";

  const page = document.createElement("main");
  page.classList.add("auto-sbc-page");

  const hero = document.createElement("header");
  hero.classList.add("auto-sbc-hero");
  hero.innerHTML = `
    <div>
      <div class="auto-sbc-brandline">
        <p class="auto-sbc-eyebrow">${uiText.autoSbc.eyebrow} · <span>${uiText.autoSbc.author}</span></p>
        ${renderFcxAuthorSocialLinks()}
      </div>
      <h1 class="auto-sbc-title">${uiText.autoSbc.pageTitle}</h1>
      <p class="auto-sbc-description">${uiText.autoSbc.description}</p>
    </div>
    <div class="auto-sbc-sync-actions">
      <span class="auto-sbc-sync-status">${uiText.autoSbc.syncing}</span>
      <button type="button" class="auto-sbc-refresh-button" aria-label="${uiText.autoSbc.refreshData}">${uiText.autoSbc.refresh}</button>
    </div>
  `;

  hero
    .querySelector(".auto-sbc-refresh-button")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const refreshed = await createSBCTab(true);
        queueFcxNotification([
          refreshed
            ? uiText.autoSbc.refreshComplete
            : uiText.autoSbc.refreshFailed,
          refreshed
            ? UINotificationType.POSITIVE
            : UINotificationType.NEGATIVE,
        ]);
      } finally {
        button.disabled = false;
      }
    });

  const workspace = document.createElement("div");
  workspace.id = "autoSbcWorkspace";
  workspace.classList.add("auto-sbc-workspace");
  workspace.innerHTML = `<div class="auto-sbc-loading">${uiText.autoSbc.loading}</div>`;

  page.appendChild(hero);
  page.appendChild(workspace);
  root.appendChild(page);

  this.__autoSbcWorkspace = workspace;
  this.__root = root;
  this._generated = true;
  mountAutoSbcPage(workspace);
};

const FCX_EVOLUTION_TAB_ID = "fcx-player-evolution-tab";
const FCX_EVOLUTION_SCREEN_ID = "FcxPlayerEvolutionPanel";
let fcxEvolutionScreenState = null;
let fcxEvolutionNavigationObserver = null;
let fcxEvolutionDismissListenerInstalled = false;
let fcxEvolutionTabMountedAt = 0;
let fcxEvolutionMountTimer = null;

const createPlayerEvolutionScreen = () => {
  const root = document.createElement("div");
  root.className =
    "auto-sbc-page-shell fcx-academy-page-shell fcx-evolution-navigation-screen";
  root.id = FCX_EVOLUTION_SCREEN_ID;
  const page = document.createElement("main");
  page.className = "auto-sbc-page fcx-academy-page";
  const hero = document.createElement("header");
  hero.className = "auto-sbc-hero fcx-academy-hero";
  hero.innerHTML = `
    <div>
      <div class="auto-sbc-brandline">
        <p class="auto-sbc-eyebrow">FCX · PLAYSTYLE LAB · <span>${uiText.autoSbc.author}</span></p>
        ${renderFcxAuthorSocialLinks()}
      </div>
      <h1 class="auto-sbc-title">球员进化</h1>
      <p class="auto-sbc-description">一键DIY球员PlayStyle。</p>
    </div>
    <div class="fcx-academy-hero__limits" aria-label="学院能力上限">
      <span class="is-base"><b>${PLAYSTYLE_ACADEMY_CONFIG.limits.basic}</b> 基础</span>
      <span class="is-plus"><b>${PLAYSTYLE_ACADEMY_CONFIG.limits.plus}</b> Plus</span>
    </div>`;
  const workspace = document.createElement("div");
  workspace.className = "fcx-academy-workspace";
  page.append(hero, workspace);
  root.appendChild(page);
  return { root, workspace };
};

const closePlayerEvolutionScreen = (restoreSelection = true) => {
  const state = fcxEvolutionScreenState;
  if (!state) return;
  fcxEvolutionScreenState = null;
  try {
    unmountPlayStyleAcademyPage(state.workspace);
  } catch (error) {
    console.warn("[FCX][Evolution] 页面卸载失败", error);
  }
  state.root.remove();
  document.getElementById(FCX_EVOLUTION_TAB_ID)?.classList.remove("selected");
  if (state.titleElement?.isConnected && state.titleElement.textContent === uiText.navigation.evolution) {
    state.titleElement.textContent = state.previousTitle;
  }
  if (restoreSelection && state.previousSelected?.isConnected) {
    state.previousSelected.classList.add("selected");
  }
};

const openPlayerEvolutionScreen = () => {
  if (fcxEvolutionScreenState?.root?.isConnected) return;
  if (fcxEvolutionScreenState) closePlayerEvolutionScreen(false);
  const content =
    document.querySelector(
      ".ut-tab-bar-view > .ut-navigation-container-view > .ut-navigation-container-view--content"
    ) || document.querySelector(".ut-navigation-container-view--content");
  if (!content) {
    queueFcxNotification([
      "EA 页面尚未准备完成，请稍后重试",
      UINotificationType.NEGATIVE,
    ]);
    return;
  }
  const previousSelected = document.querySelector(
    `.ut-tab-bar > .ut-tab-bar-item.selected:not(#${FCX_EVOLUTION_TAB_ID})`
  );
  const titleElement = document.querySelector(".ut-navigation-bar-view .title");
  const previousTitle = titleElement?.textContent || "";
  const { root, workspace } = createPlayerEvolutionScreen();
  document
    .querySelectorAll(".ut-tab-bar > .ut-tab-bar-item.selected")
    .forEach((tab) => tab.classList.remove("selected"));
  document.getElementById(FCX_EVOLUTION_TAB_ID)?.classList.add("selected");
  if (titleElement) titleElement.textContent = uiText.navigation.evolution;
  content.appendChild(root);
  fcxEvolutionScreenState = {
    root,
    workspace,
    previousSelected,
    titleElement,
    previousTitle,
  };
  mountPlayStyleAcademyPage(workspace);
};

const installPlayerEvolutionDismissListener = () => {
  if (fcxEvolutionDismissListenerInstalled) return;
  fcxEvolutionDismissListenerInstalled = true;
  const dismiss = (event) => {
    if (!fcxEvolutionScreenState) return;
    const tab = event.target?.closest?.(".ut-tab-bar-item");
    if (tab && tab.id !== FCX_EVOLUTION_TAB_ID) {
      closePlayerEvolutionScreen(false);
    }
  };
  document.addEventListener("click", dismiss, true);
  document.addEventListener("pointerup", dismiss, true);
};

const mountPlayerEvolutionTab = () => {
  const observerTarget = document.body || document.documentElement;
  if (!fcxEvolutionNavigationObserver && observerTarget) {
    fcxEvolutionNavigationObserver = new MutationObserver(() => {
      if (fcxEvolutionMountTimer) return;
      fcxEvolutionMountTimer = setTimeout(() => {
        fcxEvolutionMountTimer = null;
        if (fcxEvolutionScreenState && !fcxEvolutionScreenState.root.isConnected) {
          closePlayerEvolutionScreen(false);
        }
        mountPlayerEvolutionTab();
      }, 0);
    });
    fcxEvolutionNavigationObserver.observe(observerTarget, {
      childList: true,
      subtree: true,
    });
  }
  const tabBar = document.querySelector(".ut-tab-bar");
  if (!tabBar) return false;
  installPlayerEvolutionDismissListener();
  let tab = document.getElementById(FCX_EVOLUTION_TAB_ID);
  if (!tab) {
    tab = document.createElement("button");
    tab.type = "button";
    tab.id = FCX_EVOLUTION_TAB_ID;
    tab.className =
      "ut-tab-bar-item icon-fcx-brand icon-fcx-evolution fcx-standalone-nav-tab";
    tab.title = uiText.navigation.evolution;
    tab.setAttribute("aria-label", uiText.navigation.evolution);
    const label = document.createElement("span");
    label.className = "fcx-standalone-nav-tab__label";
    label.textContent = uiText.navigation.evolution;
    tab.appendChild(label);
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() - fcxEvolutionTabMountedAt < 350) return;
      openPlayerEvolutionScreen();
    });
    fcxEvolutionTabMountedAt = Date.now();
    tabBar.appendChild(tab);
  }
  tab.classList.toggle(
    "selected",
    Boolean(fcxEvolutionScreenState?.root?.isConnected)
  );
  return true;
};
sbcSettingsView.prototype.destroyGeneratedElements =
  function destroyGeneratedElements() {
    const session = this.__settingsSession;
    session?.lockedPlayersPanelDispose?.();
    session?.settings?.dispose();
    if (activeSettingsSession === session) activeSettingsSession = null;
    this.__settingsSession = null;
    DOMKit.remove(this.__root), (this.__root = null);
  };

sbcSettingsView.prototype._generate = function _generate() {
  const session = {
    settings: new SettingsEditSession(fcxSettingsStore),
    protectionDraft: getPlayerProtectionSettings(),
    footer: null,
    lockedPlayersPanelDispose: null,
  };
  this.__settingsSession = session;
  activeSettingsSession = session;
  if (
    document.contains(
      document.getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
    )
  ) {
    document
      .getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
      .remove();
  }

  var e = document.createElement("div");
  e.classList.add("ut-market-search-filters-view"), e.classList.add("floating");
  e.classList.add("sbc-settings-container");
  e.classList.add("fcx-settings-shell");
  e.setAttribute("id", "SettingsPanel");

  var f = document.createElement("div");
  f.classList.add("ut-pinned-list"), f.classList.add("sbc-settings");
  f.classList.add("fcx-settings-page");
  e.appendChild(f);

  const hero = document.createElement("header");
  hero.className = "fcx-settings-hero";
  hero.innerHTML = `
    <div>
      <div class="fcx-settings-brandline">
        <p class="fcx-settings-eyebrow">FCX · SQUAD CONTROL · <span>${uiText.autoSbc.author}</span></p>
        ${renderFcxAuthorSocialLinks()}
      </div>
      <h1>${uiText.settings.pageTitle}</h1>
      <p>在同一个位置管理求解规则、球员保护、价格和奖励卡包。</p>
    </div>
    <div class="fcx-settings-protection-badge">
      <strong>${getLockedItems().length}</strong><span>已锁定球员</span>
    </div>`;
  f.appendChild(hero);

  const cards = document.createElement("div");
  cards.className = "fcx-settings-card-stack";
  f.appendChild(cards);

  const backendTile = createSettingsTile(cards, "本地后端", "backend");
  createNumberSpinner(
    backendTile,
    uiText.settings.backendPort,
    "backendPort",
    1024,
    65535,
    normalizeBackendPort(getSettings(0, 0, "backendPort")),
    (spinner) => {
      saveSettings(0, 0, "backendPort", normalizeBackendPort(spinner.getValue()));
    },
    uiText.settings.backendPortHelp
  );

  const eaRetryTile = createSettingsTile(cards, "EA请求重试", "eaRequestRetry");
  createNumberSpinner(
    eaRetryTile,
    "最大请求次数",
    "eaRequestMaxAttempts",
    1,
    10,
    Number(getSettings(0, 0, "eaRequestMaxAttempts") || 3),
    (spinner) => saveSettings(0, 0, "eaRequestMaxAttempts", spinner.getValue()),
    "包含首次请求；设置为 1 表示普通请求失败后不重试。SBC限流使用独立的安全冷却。"
  );
  createNumberSpinner(
    eaRetryTile,
    "重试间隔（秒）",
    "eaRequestRetryDelaySeconds",
    1,
    30,
    Number(getSettings(0, 0, "eaRequestRetryDelaySeconds") || 3),
    (spinner) => saveSettings(0, 0, "eaRequestRetryDelaySeconds", spinner.getValue()),
    "普通请求失败时使用该间隔；SBC限流按3秒、8秒、20秒逐级冷却。首次成功不会等待。"
  );
  createNumberSpinner(
    eaRetryTile,
    "API请求节奏（毫秒）",
    "eaSbcRequestIntervalMs",
    0,
    10000,
    Number(getSettings(0, 0, "eaSbcRequestIntervalMs") ?? 900),
    (spinner) => saveSettings(0, 0, "eaSbcRequestIntervalMs", spinner.getValue()),
    "控制FCX发起的SBC读取、保存和提交请求之间的最小间隔；默认900毫秒。设置为0会关闭主动节奏控制，更容易触发EA限流。"
  );

  const remoteTile = createSettingsTile(
    cards,
    "账号与远程控制",
    "remoteControl"
  );
  void fcxRemoteControl.mountSettings(remoteTile);

  const disclaimerTile = createSettingsTile(cards, "免责声明", "disclaimer");
  const disclaimerCopy = document.createElement("p");
  disclaimerCopy.className = "fcx-settings-disclaimer-copy";
  disclaimerCopy.textContent =
    "查看 FCX 的软件使用与游戏相关声明。首次使用时必须阅读并确认。";
  const disclaimerButton = document.createElement("button");
  disclaimerButton.type = "button";
  disclaimerButton.className = "fcx-button fcx-button--primary";
  disclaimerButton.textContent = "查看完整免责声明";
  disclaimerButton.addEventListener("click", () => openFcxDisclaimerDialog());
  disclaimerTile.append(disclaimerCopy, disclaimerButton);

  const protectionTile = createSettingsTile(cards, "球员保护", "protection");
  createPlayerProtectionPanel(protectionTile, session);
  const lockedPlayersTile = createSettingsTile(cards, "锁定球员", "lockedPlayers");
  session.lockedPlayersPanelDispose = createLockedPlayersPanel(lockedPlayersTile, session);

  let sbcUITile = createSettingsTile(cards, "显示与价格", "ui");
  createNumberSpinner(
    sbcUITile,
    uiText.settings.walkoutRating,
    "animateWalkouts",
    1,
    100,
    getSettings(0, 0, "animateWalkouts"),
    (toggleAW) => {
      saveSettings(0, 0, "animateWalkouts", toggleAW.getValue());
    }
  );
  hideSettingsControl(createToggle(
    sbcUITile,
    uiText.settings.showClubStorageStats,
    "ratingUI",
    getSettings(0, 0, "ratingUI"),
    (toggleST) => {
      saveSettings(0, 0, "ratingUI", toggleST.getToggleState());
      ratingCountUI();
    }
  ));
  createToggle(
    sbcUITile,
    uiText.settings.showPrices,
    "showPrices",
    getSettings(0, 0, "showPrices"),
    (toggleSP) => {
      saveSettings(0, 0, "showPrices", toggleSP.getToggleState());
    }
  );
  const priceCachePanel = createNumberSpinner(
    sbcUITile,
    uiText.settings.priceCacheMinutes,
    "priceCacheMinutes",
    1,
    1440,
    getSettings(0, 0, "priceCacheMinutes"),
    (numberspinnerPCM) => {
      saveSettings(0, 0, "priceCacheMinutes", numberspinnerPCM.getValue());
    }
  );
  hideSettingsControl(priceCachePanel);
  createToggle(
    sbcUITile,
    uiText.settings.showAutoSbcEntry,
    "showSbcTab",
    getSettings(0, 0, "showSbcTab"),
    (toggleSBCT) => {
      saveSettings(0, 0, "showSbcTab", toggleSBCT.getToggleState());
      createSBCTab();
      syncAutoSbcTabVisibility();
    }
  );
  let panel = createPanel();
  panel.classList.add("fcx-price-cache-actions");

  const inspectPricesBtn = createButton(
    "inspectPrices",
    uiText.settings.inspectPrices,
    async () => {
      try {
        await ensurePriceItemsLoaded();
        await openPriceCacheDiagnosticsDialog({
          load: () =>
            collectPriceCacheDiagnostics({
              memoryRecords: getPriceItems(),
              indexedDb: window.indexedDB,
              storage: localStorage,
              cacheMinutes:
                Number(getSettings(0, 0, "priceCacheMinutes")) || 1440,
              lastFetch: runtimeState.lastPriceFetchResult,
              lastPersistence: runtimeState.lastPricePersistenceResult,
              events: runtimeState.priceDiagnosticEvents,
            }),
          onCopied: () =>
            showNotification(
              uiText.settings.diagnosticsCopied,
              UINotificationType.POSITIVE
            ),
          onCopyError: (error) => {
            console.error("Price diagnostics copy failed", error);
            showNotification(
              uiText.settings.diagnosticsCopyFailed,
              UINotificationType.NEGATIVE
            );
          },
        });
      } catch (error) {
        console.error("Error opening price cache diagnostics:", error);
        showNotification(
          `价格缓存检查失败：${error?.message || error}`,
          UINotificationType.NEGATIVE
        );
      }
    },
    "btn-standard fcx-price-cache-inspect"
  );

  let clearPricesBtn = createButton(
    "clearPrices",
    uiText.settings.clearPrices,
    async () => {
      try {
        if (runtimeState.priceFetchPromise) {
          await runtimeState.priceFetchPromise.catch(() => undefined);
        }
        await clearPriceRecords(window.indexedDB, localStorage);
        showNotification(
          uiText.settings.pricesCleared,
          UINotificationType.POSITIVE
        );
      } catch (error) {
        console.error("Error clearing persisted prices:", error);
        showNotification(
          `价格缓存清除失败：${error?.message || error}`,
          UINotificationType.NEGATIVE
        );
      } finally {
        runtimeState.cachedPriceItems = {};
        runtimeState.priceItemsHydrated = true;
        runtimeState.priceItemsLoadPromise = Promise.resolve({});
        runtimeState.priceRequestBlockedUntil = 0;
        runtimeState.priceRequestLastError = undefined;
        runtimeState.futggBlockedForSession = false;
        runtimeState.lastPriceFetchResult = undefined;
        runtimeState.lastPricePersistenceResult = undefined;
        runtimeState.priceDiagnosticEvents.splice(0);
        clearPriceLookupCoordinator();
      }
    },
    "btn-standard fcx-price-cache-clear"
  );
  panel.append(inspectPricesBtn, clearPricesBtn);
  hideSettingsControl(panel);
  priceCachePanel.insertAdjacentElement("afterend", panel);

  const packTile = createSettingsTile(cards, "卡包处理", "packSettings");
  createPackSettingsPanel(packTile);

  const submissionRemindersTile = createSettingsTile(
    cards,
    "提交统计提醒",
    "submissionReminders"
  );
  const submissionReminderGrid = document.createElement("div");
  submissionReminderGrid.className = "fcx-submission-reminder-grid";
  submissionRemindersTile.appendChild(submissionReminderGrid);
  createNumberSpinner(
    submissionReminderGrid,
    "每小时 FCX 提交提醒值",
    "submitHourLimit",
    1,
    500,
    Number(getSettings(0, 0, "submitHourLimit") || 90),
    (spinner) => saveSettings(0, 0, "submitHourLimit", spinner.getValue()),
    "统计所有由 FCX 发起且成功的 challenge 提交；默认 90，仅提醒、不限制。"
  );
  createNumberSpinner(
    submissionReminderGrid,
    "每日 FCX 提交提醒值",
    "submitDayLimit",
    1,
    1000,
    Number(getSettings(0, 0, "submitDayLimit") || 300),
    (spinner) => saveSettings(0, 0, "submitDayLimit", spinner.getValue()),
    "统计所有由 FCX 发起且成功的 challenge 提交；默认 300，仅提醒、不限制。"
  );
  let sbcRulesTile = createSettingsTile(
    cards,
    "高级SBC规则",
    "customRules"
  );
  const scopePanel = document.createElement("section");
  scopePanel.className = "fcx-rules-scope";
  const scopeHeading = document.createElement("div");
  scopeHeading.className = "fcx-rules-scope__heading";
  scopeHeading.innerHTML = `
    <strong>规则应用范围</strong>
    <span>挑战设置优先，其次是整组SBC，最后使用全局设置。</span>`;
  const rulesContent = document.createElement("div");
  rulesContent.className = "fcx-rules-content";
  scopePanel.appendChild(scopeHeading);
  sbcRulesTile.append(scopePanel, rulesContent);
  createSBCCustomRulesPanel(scopePanel, rulesContent, session);

  const footer = createSettingsSaveFooter(session);
  session.footer = footer;
  f.appendChild(footer);

  (this.__root = e), (this._generated = !0);
};

const createPlayerProtectionPanel = (parent, session) => {
  const intro = document.createElement("p");
  intro.className = "fcx-settings-card-copy";
  intro.textContent =
    "受保护球员会在求解、应用阵容和提交前重复校验；保护数据读取失败时任务会停止。";
  parent.appendChild(intro);
  createToggle(
    parent,
    "保护进化球员",
    "protectEvolutions",
    session.protectionDraft?.protectEvolutions !== false,
    (toggle) => {
      session.protectionDraft.protectEvolutions = toggle.getToggleState();
      markSettingsDraftDirty(session);
    },
    "排除正在进化或仍可移除进化的球员。"
  );
  createToggle(
    parent,
    "保护当前激活阵容",
    "protectActiveSquad",
    session.protectionDraft?.protectActiveSquad !== false,
    (toggle) => {
      session.protectionDraft.protectActiveSquad = toggle.getToggleState();
      markSettingsDraftDirty(session);
    },
    "排除当前激活阵容中的球员；每个任务和每次提交前都会重新校验。"
  );
  createToggle(
    parent,
    "锁定同时保护SBC仓库同卡型",
    "protectLockedStorageCopies",
    session.protectionDraft?.protectLockedStorageCopies !== false,
    (toggle) => {
      session.protectionDraft.protectLockedStorageCopies = toggle.getToggleState();
      markSettingsDraftDirty(session);
    },
    "开启后，手动锁定球员时也会排除SBC仓库内同一卡型；关闭后只保留原俱乐部锁定保护。"
  );
  hideSettingsControl(createToggle(
    parent,
    "收集概念球员数据",
    "collectConcepts",
    getSettings(0, 0, "collectConcepts") === true,
    (toggle) => {
      saveSettings(0, 0, "collectConcepts", toggle.getToggleState());
      if (toggle.getToggleState()) void getConceptPlayers();
    },
    "开启后才允许“使用概念球员”规则从概念库中选择球员。"
  ));
  hideSettingsControl(createNumberSpinner(
    parent,
    "概念球员价值倍率",
    "conceptPremium",
    1,
    100,
    getSettings(0, 0, "conceptPremium") ?? 10,
    (spinner) =>
      saveSettings(0, 0, "conceptPremium", spinner.getValue()),
    "10表示按基础价值的10倍计入成本；越高越少使用。仅在启用概念球员且未忽略价值时生效，含概念球员的阵容不会自动提交。"
  ));
};

const createLockedPlayersPanel = (parent, session) => {
  parent.classList.add("fcx-locked-manager");
  const toolbar = document.createElement("div");
  toolbar.className = "fcx-locked-toolbar";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "fcx-locked-search";
  search.placeholder = "输入至少两个字符搜索俱乐部球员";
  search.setAttribute("aria-label", "搜索可锁定球员");
  const viewProtectedButton = document.createElement("button");
  viewProtectedButton.type = "button";
  viewProtectedButton.className = "fcx-button fcx-protected-view-button";
  viewProtectedButton.textContent = "查看所有保护球员";
  toolbar.append(search, viewProtectedButton);

  const results = document.createElement("div");
  results.className = "fcx-locked-results";
  const list = document.createElement("div");
  list.className = "fcx-locked-list";
  parent.append(toolbar, results, list);

  const renderLocked = () => {
    const locked = getPlayerProtectionStore().list();
    list.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "fcx-locked-list-heading";
    heading.innerHTML = `<strong>已锁定</strong><span>${locked.length} 名</span>`;
    list.appendChild(heading);
    if (!locked.length) {
      const empty = document.createElement("p");
      empty.className = "fcx-locked-empty";
      empty.textContent = "还没有锁定球员。锁定后，任何 SBC 都不会使用他们。";
      list.appendChild(empty);
    }
    for (const record of locked) {
      const row = document.createElement("div");
      row.className = "fcx-locked-player-row";
      const price = getPrice({ definitionId: record.definitionId });
      row.innerHTML = `
        <strong class="fcx-locked-rating">${record.rating || "—"}</strong>
        <span class="fcx-locked-player-copy"><b>${record.name}</b><small>${record.rarity}${record.evolution ? " · 进化" : ""}${price ? ` · ${Number(price).toLocaleString()}` : ""}</small></span>`;
      const unlock = document.createElement("button");
      unlock.type = "button";
      unlock.className = "fcx-locked-remove";
      unlock.textContent = "解除";
      unlock.addEventListener("click", () => {
        getPlayerProtectionStore().unlock(record.definitionId);
        renderLocked();
        document.querySelector(".fcx-settings-protection-badge strong").textContent =
          String(getLockedItems().length);
      });
      row.appendChild(unlock);
      list.appendChild(row);
    }
  };

  const renderResults = (players) => {
    results.replaceChildren();
    for (const player of players) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "fcx-locked-search-result";
      row.disabled = isItemLocked(player);
      row.innerHTML = `<strong>${player.rating || "—"}</strong><span>${getPlayerName(player)}<small>${isItemLocked(player) ? "已锁定" : "点击锁定"}</small></span>`;
      row.addEventListener("click", () => {
        lockItem(player);
        renderResults(players);
        renderLocked();
        document.querySelector(".fcx-settings-protection-badge strong").textContent =
          String(getLockedItems().length);
      });
      results.appendChild(row);
    }
  };

  const refreshLockedPanel = () => {
    renderLocked();
    const badge = document.querySelector(".fcx-settings-protection-badge strong");
    if (badge) badge.textContent = String(getLockedItems().length);
  };
  const disposeLockedPanelRefresh = registerOpenLockedPlayersPanelRefresh(
    refreshLockedPanel
  );

  let clubPromise = null;
  let searchTimer;
  search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const query = search.value.trim().toLocaleLowerCase();
    if (query.length < 2) {
      results.replaceChildren();
      return;
    }
    searchTimer = setTimeout(async () => {
      results.textContent = "正在读取俱乐部…";
      clubPromise ??= fetchPlayers();
      try {
        const clubPlayers = await clubPromise;
        const grouped = new Map();
        for (const player of clubPlayers) {
          const key = readPlayerDefinitionId(player);
          if (key <= 0) continue;
          const previous = grouped.get(key);
          if (!previous || Number(player.rating) > Number(previous.rating)) {
            grouped.set(key, player);
          }
        }
        const matches = [...grouped.values()]
          .filter((player) => getPlayerName(player).toLocaleLowerCase().includes(query))
          .sort((left, right) => Number(right.rating) - Number(left.rating))
          .slice(0, 25);
        renderResults(matches);
        void fetchPlayerPrices(matches).then(renderLocked);
      } catch (error) {
        results.textContent = `俱乐部读取失败：${error?.message || error}`;
      }
    }, 250);
  });

  viewProtectedButton.addEventListener("click", async () => {
    if (viewProtectedButton.disabled) return;
    viewProtectedButton.disabled = true;
    const originalLabel = viewProtectedButton.textContent || "查看所有保护球员";
    viewProtectedButton.textContent = "正在读取保护球员…";
    const lockedPlayers = getPlayerProtectionStore().list();
    try {
      let clubPlayers = [];
      let warning;
      try {
        clubPlayers = await fetchPlayers();
      } catch (error) {
        warning = "俱乐部球员读取失败，当前仅显示已保存的手动锁定记录，结果可能不完整。";
        console.warn("[FCX][Protection] 保护球员总览读取俱乐部失败", error);
      }
      const settings = session.protectionDraft || getPlayerProtectionSettings();
      const activeSquadItemIds = settings.protectActiveSquad
        ? await getActiveSquadProtectedIds()
        : new Set();
      if (
        settings.protectActiveSquad &&
        didActiveSquadProtectionReadFail()
      ) {
        warning = [
          warning,
          "当前激活阵容读取失败，本次总览可能缺少阵容保护球员。",
        ]
          .filter(Boolean)
          .join(" ");
      }
      const protectedPlayers = aggregateProtectedPlayers({
        clubPlayers,
        lockedPlayers,
        activeSquadItemIds,
        protectActiveSquad: settings.protectActiveSquad !== false,
        protectEvolutions: settings.protectEvolutions !== false,
        getName: getPlayerName,
        getRarity: (player) =>
          services.Localization?.localize?.("item.raretype" + player.rareflag) ||
          String(player.rareflag || "未知"),
      });
      openProtectedPlayersDialog({
        players: protectedPlayers,
        ...(warning ? { warning } : {}),
      });
    } catch (error) {
      console.warn("[FCX][Protection] 保护球员总览读取失败", error);
      openProtectedPlayersDialog({
        players: aggregateProtectedPlayers({
          clubPlayers: [],
          lockedPlayers,
          activeSquadItemIds: new Set(),
          protectActiveSquad: false,
          protectEvolutions: false,
          getName: getPlayerName,
          getRarity: () => "未知",
        }),
        warning: "保护数据读取失败，当前仅显示已保存的手动锁定记录，结果可能不完整。",
      });
    } finally {
      viewProtectedButton.disabled = false;
      viewProtectedButton.textContent = originalLabel;
    }
  });
  renderLocked();
  return disposeLockedPanelRefresh;
};

const createPackSettingsPanel = (parent) => {
  createToggle(
    parent,
    "自动选择球员挑选",
    "packAutoPick",
    getSettings(0, 0, "packAutoPick") !== false,
    (toggle) => saveSettings(0, 0, "packAutoPick", toggle.getToggleState())
  );
  createToggle(
    parent,
    "跳过开包动画",
    "packSkipAnimation",
    getSettings(0, 0, "packSkipAnimation") === true,
    (toggle) => saveSettings(0, 0, "packSkipAnimation", toggle.getToggleState())
  );
  createToggle(
    parent,
    "快速出售低总评重复球员",
    "packQuickSellDuplicates",
    getSettings(0, 0, "packQuickSellDuplicates") === true,
    (toggle) =>
      saveSettings(0, 0, "packQuickSellDuplicates", toggle.getToggleState()),
    "仅处理低于设定总评且无法进入俱乐部或仓库的重复球员。"
  );
  createNumberSpinner(
    parent,
    "快速出售总评阈值",
    "packQuickSellUnder",
    0,
    99,
    getSettings(0, 0, "packQuickSellUnder"),
    (spinner) => saveSettings(0, 0, "packQuickSellUnder", spinner.getValue())
  );
  createDropDown(
    parent,
    "球员挑选排序",
    "packPickStrategy",
    [
      new UTDataProviderEntryDTO("ovr", "ovr", "按总评"),
      new UTDataProviderEntryDTO("price", "price", "按价格"),
    ],
    getSettings(0, 0, "packPickStrategy"),
    (dropdown) =>
      saveSettings(
        0,
        0,
        "packPickStrategy",
        dropdown.getValue() === "price" ? "price" : "ovr"
      )
  );
};

const createSettingsSaveFooter = (session) => {
  const footer = document.createElement("footer");
  footer.className = "fcx-settings-savebar";
  footer.hidden = true;
  const status = document.createElement("span");
  status.className = "fcx-settings-save-status";
  status.textContent = "设置没有更改";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "fcx-button";
  cancel.textContent = "取消更改";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "fcx-button fcx-button--primary fcx-settings-save";
  save.textContent = "保存设置";
  save.disabled = true;
  cancel.addEventListener("click", () => {
    if (cancel.disabled) return;
    cancel.disabled = true;
    save.disabled = true;
    status.textContent = "正在取消更改…";
    try {
      session.settings.discard();
      session.protectionDraft = getPlayerProtectionSettings();
      refreshSettingsController(session);
      setTimeout(() => {
        syncAutoSbcTabVisibility();
        ratingCountUI();
      }, 0);
    } catch (error) {
      console.error("[FCX][Settings] 取消更改失败", error);
      status.textContent = `取消失败：${error?.message || error}`;
      cancel.disabled = false;
      save.disabled = false;
      footer.classList.add("is-error");
    }
  });
  save.addEventListener("click", () => {
    if (save.disabled) return;
    save.disabled = true;
    cancel.disabled = true;
    status.textContent = "正在保存设置…";
    footer.classList.remove("is-error");
    try {
      session.settings.commit();
      savePlayerProtectionSettings(session.protectionDraft);
      session.protectionDraft = getPlayerProtectionSettings();
      status.textContent = "设置已保存";
      footer.classList.remove("is-dirty");
      footer.classList.add("is-saved");
      syncAutoSbcTabVisibility();
      ratingCountUI();
      setTimeout(() => {
        if (!footer.isConnected) return;
        footer.classList.remove("is-saved");
        footer.hidden = true;
        cancel.disabled = false;
      }, 1400);
    } catch (error) {
      console.error("[FCX][Settings] 保存设置失败", error);
      status.textContent = `保存失败：${error?.message || error}`;
      save.disabled = false;
      cancel.disabled = false;
      footer.classList.add("is-error");
      showNotification(
        `设置保存失败：${error?.message || error}`,
        UINotificationType.NEGATIVE
      );
    }
  });
  footer.append(status, cancel, save);
  return footer;
};

const createExclusionPicker = ({
  parent,
  session,
  label,
  help,
  settingKey,
  options,
  sbcId,
  challengeId,
}) => {
  const control = createFcxMultiSelectControl({
    id: `exclude-${settingKey}`,
    label,
    help,
    modalTitle: `选择要排除的${label.replace(/^排除/, "")}`,
    options,
    selected: session.settings.getValue(sbcId, challengeId, settingKey) || [],
    onSave: (values) => {
      session.settings.persistValue(sbcId, challengeId, settingKey, values);
      showNotification(`${label}已保存`, UINotificationType.POSITIVE);
    },
  });
  parent.appendChild(control.root);
  return control;
};

let challenges;
let sbcSet;
const createSBCCustomRulesPanel = async (
  parent,
  advancedParent = parent,
  session = activeSettingsSession
) => {
  let sbcData = await sbcSets();
  if (!session || session.settings.isDisposed) return;

  let SBCList = sbcData.sets
    .sort(function (a, b) {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    })
    .filter((f) => !f.isComplete())
    .map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name));
  SBCList.unshift(new UTDataProviderEntryDTO(0, 0, uiText.settings.allSbcs));
  createDropDown(
    parent,
    uiText.settings.chooseSbc,
    "sbcId",
    SBCList,
    0,
    async (dropdown) => {
      if (
        document.contains(
          document.getElementsByClassName(
            "ut-sbc-challenge-requirements-view"
          )[0]
        )
      ) {
        document
          .getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
          .remove();
      }
      let challenge = [];
      if (dropdown.getValue() != 0) {
        let allSbcData = await sbcSets();
        sbcSet = allSbcData.sets.filter((e) => e.id == dropdown.getValue())[0];

        challenges = await getChallenges(sbcSet);

        challenge = challenges.challenges.map(
          (e) => new UTDataProviderEntryDTO(e.id, e.id, e.name)
        );
      }
      challenge.unshift(
        new UTDataProviderEntryDTO(0, 0, uiText.settings.allChallenges)
      );

      createDropDown(
        parent,
        uiText.settings.chooseChallenge,
        "sbcChallengeId",
        challenge,
        null,
        async (dropdownChallenge) => {
          console.log(
            "SBCId:" + dropdown.getValue(),
            "ChallengeId:" + dropdownChallenge.getValue()
          );
          if (
            document.contains(
              document.getElementsByClassName(
                "ut-sbc-challenge-requirements-view"
              )[0]
            )
          ) {
            document
              .getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
              .remove();
          }
          advancedParent.replaceChildren();
          const context = document.createElement("p");
          context.className = "fcx-settings-card-copy";
          const selectedSetId = Number(dropdown.getValue());
          const selectedChallengeId = Number(dropdownChallenge.getValue());
          const selectedChallenge = challenges?.challenges?.find(
            (challenge) => Number(challenge.id) === selectedChallengeId
          );
          context.textContent =
            selectedSetId === 0
              ? "当前范围：全局规则"
              : selectedChallengeId === 0
                ? `当前范围：整组SBC · ${sbcSet?.name || selectedSetId}`
                : `当前范围：单个挑战 · ${selectedChallenge?.name || selectedChallengeId}`;
          advancedParent.appendChild(context);
          let sbcParamsTile = advancedParent;

          // Create a "Restore to Default" button
          const resetButton = createButton(
            "resetSettings",
            uiText.settings.restoreDefaults,
            () => {
              // Get the current SBC and challenge IDs
              const sbcId = dropdown.getValue();
              const challengeId = dropdownChallenge.getValue();

              session.settings.deleteScope(sbcId, challengeId);
              markSettingsDraftDirty(session);
              showNotification(
                uiText.settings.defaultsRestored,
                UINotificationType.POSITIVE
              );
              dropdownChallenge._triggerActions(EventType.CHANGE);
            }
          );

          const resetPanel = createPanel();
          resetPanel.appendChild(resetButton);
          sbcParamsTile.appendChild(resetPanel);
          createDropDown(
            sbcParamsTile,
            uiText.settings.autoSubmit,
            "autoSubmit",
            [
              { name: uiText.settings.always, id: 1 },
              { name: uiText.settings.optimal, id: 4 },
              { name: uiText.settings.never, id: 0 },
            ].map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name)),
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "autoSubmit"
            ),
            (dropdownAS) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "autoSubmit",
                parseInt(dropdownAS.getValue())
              );
            },
            uiText.settings.autoSubmitHelp
          );
          createToggle(
            sbcParamsTile,
            uiText.settings.tryAllInGroup,
            "sbcAllGroup",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "sbcAllGroup"
            ),
            (toggleSBC) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "sbcAllGroup",
                toggleSBC.getToggleState()
              );
            },
            uiText.settings.tryAllInGroupHelp
          );
          createToggle(
            sbcParamsTile,
            uiText.settings.useConcepts,
            "useConcepts",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "useConcepts"
            ),
            (toggleUC) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "useConcepts",
                toggleUC.getToggleState()
              );
            },
            uiText.settings.useConceptsHelp
          );
          createToggle(
            sbcParamsTile,
            uiText.settings.autoOpenRewards,
            "autoOpenPacks",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "autoOpenPacks"
            ),
            (toggleAO) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "autoOpenPacks",
                toggleAO.getToggleState()
              );
            },
            uiText.settings.autoOpenRewardsHelp
          );
          const readScopedCandidateRules = () => resolveCandidateRules(
            Number(dropdown.getValue()),
            Number(dropdownChallenge.getValue()),
            (setId, challengeId, key) => session.settings.getValue(setId, challengeId, key),
            (setId, challengeId, key) => session.settings.getOwnValue(setId, challengeId, key)
          );
          const candidateRulesEditor = createCandidateRulesEditor({
            value: readScopedCandidateRules(),
            onChange: (key, value) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                key,
                value
              );
            },
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
                session.settings.deleteValue(
                  dropdown.getValue(),
                  dropdownChallenge.getValue(),
                  key
                );
              }
              markSettingsDraftDirty(session);
              showNotification("已恢复 FCX 推荐规则", UINotificationType.POSITIVE);
              return readScopedCandidateRules();
            },
          });
          sbcParamsTile.appendChild(candidateRulesEditor.element);
          createToggle(
            sbcParamsTile,
            uiText.settings.ignoreStorageExclusions,
            "useDupes",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "useDupes"
            ),
            (toggleUD) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "useDupes",
                toggleUD.getToggleState()
              );
            },
            uiText.settings.ignoreStorageExclusionsHelp
          );
          createNumberSpinner(
            sbcParamsTile,
            uiText.settings.duplicateValue,
            "duplicateDiscount",
            0,
            100,
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "duplicateDiscount"
            ) ?? 51,
            (spinnerDD) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "duplicateDiscount",
                spinnerDD.getValue()
              );
            },
            uiText.settings.duplicateValueHelp
          );
          createNumberSpinner(
            sbcParamsTile,
            uiText.settings.untradeableValue,
            "untradeableDiscount",
            0,
            100,
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "untradeableDiscount"
            ) ?? 80,
            (spinnerUD) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "untradeableDiscount",
                spinnerUD.getValue()
              );
            },
            uiText.settings.untradeableValueHelp
          );
          createNumberSpinner(
            sbcParamsTile,
            uiText.settings.maxSolveTime,
            "maxSolveTime",
            10,
            990,
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "maxSolveTime"
            ),
            (numberspinnerMST) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "maxSolveTime",
                numberspinnerMST.getValue()
              );
            },
            uiText.settings.maxSolveTimeHelp
          );
          //  (parentDiv,label,id,options,value,target)
          createToggle(
            sbcParamsTile,
            uiText.settings.onlyStorage,
            "onlyStorage",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "onlyStorage"
            ),
            (toggleOS) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "onlyStorage",
                toggleOS.getToggleState()
              );
            },
            uiText.settings.onlyStorageHelp
          );
          createToggle(
            sbcParamsTile,
            uiText.settings.excludeOtherSolutions,
            "excludeSbcSquads",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "excludeSbcSquads"
            ),
            (toggleOS) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeSbcSquads",
                toggleOS.getToggleState()
              );
            },
            uiText.settings.excludeOtherSolutionsHelp
          );

          createToggle(
            sbcParamsTile,
            uiText.settings.excludeObjective,
            "excludeObjective",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "excludeObjective"
            ),
            (toggleXO) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeObjective",
                toggleXO.getToggleState()
              );
            },
            uiText.settings.excludeObjectiveHelp
          );
          createToggle(
            sbcParamsTile,
            uiText.settings.excludeTradable,
            "excludeTradable",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "excludeTradable"
            ),
            (toggleSP) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeTradable",
                toggleSP.getToggleState()
              );
            },
            uiText.settings.excludeTradableHelp
          );
          createToggle(
            sbcParamsTile,
            uiText.settings.excludeSbc,
            "excludeSbc",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "excludeSbc"
            ),
            (toggleXSBC) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeSbc",
                toggleXSBC.getToggleState()
              );
            },
            uiText.settings.excludeSbcHelp
          );
          createToggle(
            sbcParamsTile,
            uiText.settings.excludeExtinct,
            "excludeExtinct",
            getSettings(
              dropdown.getValue(),
              dropdownChallenge.getValue(),
              "excludeExtinct"
            ),
            (toggleXE) => {
              saveSettings(
                dropdown.getValue(),
                dropdownChallenge.getValue(),
                "excludeExtinct",
                toggleXE.getToggleState()
              );
            },
            uiText.settings.excludeExtinctHelp
          );
          createExclusionPicker({
            parent: sbcParamsTile,
            session,
            label: uiText.settings.excludeLeagues,
            help: uiText.settings.excludeLeaguesHelp,
            settingKey: "excludeLeagues",
            options: factories.DataProvider.getLeagueDP()
              .filter((entry) => entry.id > 0)
              .map((entry) => ({
                value: Number(entry.id),
                label: entry.label,
                iconUrl: AssetLocationUtils.getLeagueImageUri(entry.id),
              })),
            sbcId: dropdown.getValue(),
            challengeId: dropdownChallenge.getValue(),
          });

          createExclusionPicker({
            parent: sbcParamsTile,
            session,
            label: uiText.settings.excludeNations,
            help: uiText.settings.excludeNationsHelp,
            settingKey: "excludeNations",
            options: factories.DataProvider.getNationDP()
              .filter((entry) => entry.id > 0)
              .map((entry) => ({
                value: Number(entry.id),
                label: entry.label,
                iconUrl: AssetLocationUtils.getFlagImageUri(entry.id),
              })),
            sbcId: dropdown.getValue(),
            challengeId: dropdownChallenge.getValue(),
          });
          createExclusionPicker({
            parent: sbcParamsTile,
            session,
            label: uiText.settings.excludeTeams,
            help: uiText.settings.excludeTeamsHelp,
            settingKey: "excludeTeams",
            options: factories.DataProvider.getTeamDP()
              .map((entry) => {
                const leagueName =
                  repositories.TeamConfig.leagues._collection[
                    repositories.TeamConfig.teams._collection[entry.id]?.league
                  ]?.name;
                return {
                  value: Number(entry.id),
                  label: leagueName
                    ? `${entry.label}（${leagueName}）`
                    : entry.label,
                  iconUrl: AssetLocationUtils.getBadgeImageUri(entry.id),
                };
              })
              .filter(
                (entry) => Number(entry.value) > 0 && !entry.label.includes("*")
              ),
            sbcId: dropdown.getValue(),
            challengeId: dropdownChallenge.getValue(),
          });
          createExclusionPicker({
            parent: sbcParamsTile,
            session,
            label: uiText.settings.excludeRarities,
            help: uiText.settings.excludeRaritiesHelp,
            settingKey: "excludeRarity",
            options: factories.DataProvider.getItemRarityDP({
              itemSubTypes: [ItemSubType.PLAYER],
              itemTypes: [ItemType.PLAYER],
              quality: SearchLevel.ANY,
              tradableOnly: false,
            })
              .filter((entry) => entry.id > 0 && !entry.label.includes("*"))
              .map((entry) => ({
                value: entry.label,
                label: entry.label,
                iconUrl: getShellUri(
                  entry.id,
                  entry.id < 4 ? ItemRatingTier.GOLD : ItemRatingTier.NONE
                ),
              })),
            sbcId: dropdown.getValue(),
            challengeId: dropdownChallenge.getValue(),
          });
        },
        "",
        true
      );
    },
    "",
    true
  );
};

const getShellUri = (id, ratingTier) => {
  return AssetLocationUtils.getShellUri(
    0,
    1,
    id,
    ratingTier,
    repositories.Rarity._collection[id]?.guid
  );
};

const saveSettings = (sbc, challenge, id, value) => {
  if (activeSettingsSession && !activeSettingsSession.settings.isDisposed) {
    activeSettingsSession.settings.saveValue(sbc, challenge, id, value);
    markSettingsDraftDirty(activeSettingsSession);
    return;
  }
  fcxSettingsStore.saveValue(sbc, challenge, id, value);
};
const getSettings = (sbc, challenge, id) => {
  return activeSettingsSession && !activeSettingsSession.settings.isDisposed
    ? activeSettingsSession.settings.getValue(sbc, challenge, id)
    : fcxSettingsStore.getValue(sbc, challenge, id);
};
const defaultSBCSolverSettings = defaultSolverSettings;

const migrateMaxRatingSettings = () => {
  
  
  const settings = getSolverSettings();
  const sbcSettings = settings?.sbcSettings;

  if (!sbcSettings) {
  
    return;
  }

  let needsSave = false;

  Object.entries(sbcSettings).forEach(([sbcId, challenges]) => {
    if (!challenges || typeof challenges !== "object") {
  
      return;
    }

    Object.entries(challenges).forEach(([challengeId, config]) => {
      if (!config || typeof config !== "object" || !("maxRating" in config)) {
        return;
      }

      console.log(`[SBC] migrateMaxRatingSettings: migrating sbcId=${sbcId}, challengeId=${challengeId}`);
      const maxRating = Number(config.maxRating);
      if (Number.isFinite(maxRating)) {
        const currentRange = Array.isArray(config.ratingRange)
          ? [...config.ratingRange]
          : [0, 99];

        currentRange[1] = maxRating;
        config.ratingRange = currentRange;
        needsSave = true;
        console.log(`[SBC] migrateMaxRatingSettings: updated ratingRange=${currentRange}`);
      }

      
        delete config.maxRating;
        needsSave = true;
        console.log("[SBC] migrateMaxRatingSettings: removed legacy maxRating");
      
    });
  });

  if (needsSave) {
    console.log("[SBC] migrateMaxRatingSettings: saving updated settings");
    setSolverSettings("sbcSettings", sbcSettings);
  }
};

let initDefaultSettings = () => {
  migrateMaxRatingSettings();
  fcxSettingsStore.migrateFcxCandidateRules();
  fcxSettingsStore.migrateDefaultRatingRange();
  fcxSettingsStore.migrateDefaultSquadRatingOvershoot();
  fcxSettingsStore.migrateBackendPort();
  fcxSettingsStore.removeLegacyRepeatCount();
  fcxSettingsStore.removeLegacyUiSettings();
  fcxSettingsStore.removeRetiredStartupSbcSettings();
  Object.keys(defaultSBCSolverSettings). forEach((id) =>
    saveSettings(
      0,
      0,
      id,
      getSettings(0, 0, id) ?? defaultSBCSolverSettings[id]
    )
  );
};
const createPanel = (long = false) => {
  var panel = document.createElement("div");
  if (long) {
    panel.classList.add("sbc-settings-longField");
  } else {
    panel.classList.add("sbc-settings-field");
  }

  return panel;
};
const createTooltip = (tooltip, labelSpan, labelContainer) => {
  const tooltipIcon = document.createElement("span");
  const labelWrapper = document.createElement("div");
  labelWrapper.style.position = "relative";
  labelWrapper.style.display = "inline-block";
  labelWrapper.style.paddingRight = "25px";
  labelWrapper.appendChild(labelSpan);

  // Add a data attribute for the tooltip text
  labelWrapper.dataset.tooltip = tooltip;
  labelWrapper.classList.add("tooltip-container");

  // Replace the labelContainer with our wrapper
  labelContainer.appendChild(labelWrapper);
  labelContainer.appendChild(tooltipIcon);
};
const createDoubleRangeControl = (
  parentDiv,
  label,
  id,
  absoluteMin = 0,
  absoluteMax = 99,
  value = [0, 99],
  target = () => {},
  tooltip = "",
  step = UTDoubleRangeControl.DEFAULT_STEP,
  valueLabel = [uiText.settings.minOverall, uiText.settings.maxOverall]
) => {
  const panelRow = document.createElement("div");
  panelRow.classList.add("panelActionRow");
  const infoLabel = document.createElement("div");
  infoLabel.classList.add("buttonInfoLabel");
  const rangeLabel = document.createElement("span");
  rangeLabel.classList.add("spinnerLabel");
  rangeLabel.innerHTML = label;
  infoLabel.appendChild(rangeLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    createTooltip(tooltip, rangeLabel, infoLabel);
  }

  panelRow.appendChild(infoLabel);

  const rangeControl = new UTDoubleRangeControl();
  rangeControl._generate();
  rangeControl.init(),
    rangeControl.setStep(step),
    (rangeControl.latestSetMin = value[0]),
    (rangeControl.latestSetMax = value[1]),
    rangeControl.setAbsoluteMin(absoluteMin),
    rangeControl.setAbsoluteMax(absoluteMax),
    rangeControl._setValue(value[0], rangeControl.__rangeSliderMinInput),
    rangeControl._setValue(value[1], rangeControl.__rangeSliderMaxInput),
    rangeControl.setMinTitle(valueLabel[0]),
    rangeControl.setMaxTitle(valueLabel[1]),
    rangeControl._refresh();
  rangeControl.addTarget(rangeControl, target, EventType.INPUT);

  const panel = createPanel(true);
  panel.setAttribute("id", id);
  panel.appendChild(panelRow);
  panel.appendChild(rangeControl.getRootElement());
  parentDiv.appendChild(panel);

  return panel;
};

const createNumberSpinner = (
  parentDiv,
  label,
  id,
  min = 0,
  max = 100,
  value = 1,
  target = () => {},
  tooltip = ""
) => {
  var i = document.createElement("div");
  i.classList.add("panelActionRow");
  var o = document.createElement("div");
  o.classList.add("buttonInfoLabel");
  var spinnerLabel = document.createElement("span");
  spinnerLabel.classList.add("spinnerLabel");
  spinnerLabel.innerHTML = label;
  o.appendChild(spinnerLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    createTooltip(tooltip, spinnerLabel, o);
  }

  i.appendChild(o);
  let spinner = new UTNumberInputSpinnerControl();
  let panel = createPanel();

  spinner.init();
  spinner.setLimits(min, max);
  spinner.setValue(value);
  spinner.addTarget(spinner, target, EventType.CHANGE);
  panel.appendChild(i);
  panel.appendChild(spinner.getRootElement());

  parentDiv.appendChild(panel);
  return panel;
};
const createDropDown = (
  parentDiv,
  label,
  id,
  options,
  value,
  target,
  tooltip = "",
  triggerInitial = false
) => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }

  const i = document.createElement("div");
  i.classList.add("panelActionRow");

  const o = document.createElement("div");
  o.classList.add("buttonInfoLabel");

  // Add label
  const spinnerLabel = document.createElement("span");
  spinnerLabel.classList.add("spinnerLabel");
  spinnerLabel.innerHTML = label;
  o.appendChild(spinnerLabel);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    createTooltip(tooltip, spinnerLabel, o);
  }

  i.appendChild(o);

  let dropdown = new UTDropDownControl();
  let panel = createPanel();
  panel.appendChild(i);
  panel.appendChild(dropdown.getRootElement());
  panel.setAttribute("id", id);
  dropdown.init();

  dropdown.setOptions(options);

  dropdown.addTarget(dropdown, target, EventType.CHANGE);
  parentDiv.appendChild(panel);
  dropdown.setIndexById(value);
  if (triggerInitial) target(dropdown);
  return dropdown;
};
const createToggle = (parentDiv, label, id, value, target, tooltip = "") => {
  let toggle = new UTToggleCellView();
  let panel = createPanel();

  // Create label container
  const labelContainer = document.createElement("div");
  labelContainer.style.display = "flex";
  labelContainer.style.alignItems = "center";

  // Add label text
  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  labelContainer.appendChild(labelSpan);

  // Add tooltip icon if tooltip text is provided
  if (tooltip) {
    createTooltip(tooltip, labelSpan, labelContainer);
  }

  // Set label container as toggle label
  toggle.setLabel("");
  toggle.getRootElement().prepend(labelContainer);

  panel.appendChild(toggle.getRootElement());
  toggle.init();

  if (value) {
    toggle.toggle();
  }

  toggle.addTarget(toggle, target, EventType.TAP);
  parentDiv.appendChild(panel);
  return panel;
};
const createSettingsTile = (parentDiv, label, id) => {
  if (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }

  var tile = document.createElement("div");
  tile.setAttribute("id", id);
  tile.classList.add("tile");
  tile.classList.add("col-1-1");
  tile.classList.add("sbc-settings-wrapper");
  tile.classList.add("main-header");
  tile.classList.add("fcx-settings-card");

  var tileheader = document.createElement("div");
  tileheader.classList.add("sbc-settings-header");
  var h1 = document.createElement("H2");
  h1.innerHTML = label;
  tileheader.appendChild(h1);
  tile.appendChild(tileheader);
  var tileContent = document.createElement("div");
  tileContent.classList.add("sbc-settings-section");
  tile.appendChild(tileContent);
  parentDiv.appendChild(tile);
  return tileContent;
};
