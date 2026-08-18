// @ts-nocheck
// FCX compatibility runtime for the EA Web App.

//turn on console log
let i = document.createElement("iframe");
i.style.display = "none";
document.body.appendChild(i);
window.console = i.contentWindow.console;

//Add Locked Icon
let styles = `
     * {
       scrollbar-width: thin;
       scrollbar-color: rgba(0, 0, 0, .5) #ffffff;
     }

     *::-webkit-scrollbar {
       width: 12px;
       height: 12px;
     }

     *::-webkit-scrollbar-thumb {
       background-color: rgba(0, 0, 0, .5);
       border-radius: 10px;
       border: 2px solid #ffffff;
     }

     *::-webkit-scrollbar-track {
       border-radius: 10px;
       background-color: #ffffff;
     }

     html[dir=ltr] #NotificationLayer {
       right: 6.5rem;
     }

     /* Rest of the styles unchanged */
     .ut-companion-carousel-item-container-view .item-container{
     padding-top:20px;
     }
     .ut-tab-bar-item.sbcToolBarHover {
    background-color: #1f2020;
    color: #fcfcf7
}
.untradable::before {
  color: #f40727ff;
  font-family: UltimateTeam-Icons, sans-serif;
  margin-left: .5rem;
  font-size: 0.8rem;
  right: 0;
  bottom: 5px;
  position: absolute;
}
    .tradable::before {
    content: "\\E0D5";
    color: #07f468;
    font-family: UltimateTeam-Icons, sans-serif;
    margin-left: .5rem;
    font-size: 0.8rem;
    right: 0;
    bottom: 5px;
    position: absolute;
}
.ut-tab-bar-item.sbcToolBarHover.ut-tab-bar-item--default-to-root span::after {
    background-color: #fcfcf7
}
.ut-sbc-challenge-table-row-view.complete {
  cursor: no-drop;
}
.landscape .ut-tab-bar-item.sbcToolBarHover::after {
    height: 100%;
    width: 4px
}
.ut-tab-bar-item {
word-wrap:breakword;
}
     .ut-tab-bar-item.sbcToolBarHover::after {
    content: "";
    background-color: #07f468;
    display: block;
    height: 2px;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%
}
    .player.locked::before {
    font-family: 'UltimateTeam-Icons';
    position: absolute;
    content: '\\E07F';
    right: 8px;
    bottom: 2px;
    color: #00ff00;
    z-index: 2;
}
    .sbc-settings-container {
    overflow-y: scroll;
    display: flex;
    align-items: center;
    padding: 10px;
    }
    .sbc-settings {
    overflow-y: auto;
    //display: flex;
    flex-wrap: wrap;
    margin-top: 20px;
    box-shadow: 0 1rem 3em rgb(0 0 0 / 40%);
    background-color: #2a323d;
    width: 75%;
    justify-content: space-between;
    min-height:85%;
}

.sbc-settings-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 10px;
    width: 100%;
}
.sbc-settings-wrapper {
    background-color: #2a323d;
}
.sbc-settings-wrapper.tile {
    overflow: unset;
    border: 1px solid #556c95;
    border-radius: unset;
}
.sbc-settings-section {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    justify-content: space-between;
    align-items: flex-end;
}
.sbc-settings-field {
    margin-top: 15px;
    width: 45%;
    padding: 10px;
}
    .sbc-settings-longField {
    margin-top: 15px;
    width: 90%;
    padding: 10px;
}
    .spinnerLabel {
    padding-bottom: 10px;
    }
   .ut-tab-bar-item.icon-sbcSettings:before {
      content: "";
   }
   .player.fixed::before {
    font-family: 'UltimateTeam-Icons';
    position: absolute;
    content: '\\E07F';
    right: 8px;
    bottom: 2px;
    color: #ff0000;
    z-index: 2;
}
   .item-price{
    width: auto !important;
    padding: 0 0.2rem;
    left: 50%;
    transform: translateX(-50%) !important;
    white-space: nowrap;
    background: #1e242a;
    border: 1px solid cornflowerblue;
    border-radius: 5px;
    position: absolute;
    z-index: 2;
    color: #fff;
    }
.currency-sbc::after {
    background-position: right top;
    content: "";
    background-repeat: no-repeat;
    background-size: 100%;
    display: inline-block;
    height: 1em;
    vertical-align: middle;
    width: 1em;
    background-image: url(../web-app/images/sbc/logo_SBC_home_tile.png);
    margin-top: -.15em;
}
.currency-objective::after {
    background-position: right top;
    content: "";
    background-repeat: no-repeat;
    background-size: 100%;
    display: inline-block;
    height: 1em;
    vertical-align: middle;
    width: 1em;
    background-image: url(../web-app/images/pointsIcon.png);
    margin-top: -.15em;
}
.tooltip-container {
          position: relative;
}
.tooltip-container::after {
  content: "\\E093";
  font-family: UltimateTeam-Icons, sans-serif;
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  color: #07f468;
  font-size: 16px;
  text-shadow: 0 0 3px rgba(7, 244, 104, 0.5);
  cursor: help;
}
.tooltip-container:hover::before {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 10px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 5px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
}

.ut-tab-bar-item.icon-autoSbc::before {
  content: "";
}

.ut-tab-bar-item.icon-fcx-brand::before {
  content: "" !important;
  display: block;
  width: 2.35rem;
  height: 2.35rem;
  margin: 0 auto 0.15rem;
  background-image: url("${FCX_BRAND_ICON_DATA_URL}");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  font-family: initial !important;
}

/* Keep the complete sidebar stable when EA re-inserts the selected tab node. */
.ut-tab-bar > .ut-tab-bar-item.icon-home {
  order: 0 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-sbcSettings.icon-fcx-brand {
  order: 1 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-autoSbc.icon-fcx-brand {
  order: 2 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-fcx-evolution {
  order: 3 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-squad {
  order: 4 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-sbc:not(.icon-sbcSettings) {
  order: 5 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-evolution:not(.icon-fcx-evolution) {
  order: 6 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-transfer {
  order: 7 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-store {
  order: 8 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-club {
  order: 9 !important;
}
.ut-tab-bar > .ut-tab-bar-item.icon-settings {
  order: 11 !important;
}

html.fcx-consent-pending .ut-tab-bar-item.icon-fcx-brand {
  display: none !important;
}

.fcx-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 36px;
  margin: 0 8px;
  pointer-events: auto !important;
}

.fcx-header-support-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 34px;
  box-sizing: border-box;
  padding: 0 11px 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.035);
  color: #aeb6c6;
  font: 700 11px/1 system-ui, sans-serif;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.fcx-header-support-button img,
.fcx-header-support-button svg {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  display: block;
}

.fcx-header-support-button img {
  object-fit: contain;
}

.fcx-header-support-button:hover,
.fcx-header-support-button:focus-visible {
  border-color: rgba(57, 214, 163, 0.65);
  background: rgba(57, 214, 163, 0.1);
  color: #e8ecf3;
  outline: none;
}

.fcx-header-support-button--miniprogram:hover,
.fcx-header-support-button--miniprogram:focus-visible {
  border-color: rgba(7, 193, 96, 0.72);
  background: rgba(7, 193, 96, 0.11);
  color: #9cebbd;
}

.fcx-header-version-button {
  min-width: 72px;
  padding-inline: 10px;
  color: #c2cad7;
  font-family: Consolas, ui-monospace, monospace;
}

.fcx-header-version__dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #738094;
  box-shadow: 0 0 0 3px rgba(115, 128, 148, 0.12);
}

.fcx-header-version__compact { display: none; }
.fcx-header-version-button[data-state="checking"] .fcx-header-version__dot {
  background: #6fc9df;
  box-shadow: 0 0 0 3px rgba(111, 201, 223, 0.14);
}
.fcx-header-version-button[data-state="current"] .fcx-header-version__dot {
  background: #39d6a3;
  box-shadow: 0 0 0 3px rgba(57, 214, 163, 0.14);
}
.fcx-header-version-button[data-state="update"] {
  border-color: rgba(255, 163, 78, 0.68);
  background: rgba(255, 145, 55, 0.1);
  color: #ffc084;
}
.fcx-header-version-button[data-state="update"] .fcx-header-version__dot {
  background: #ff9e47;
  box-shadow: 0 0 0 3px rgba(255, 158, 71, 0.16);
}
.fcx-header-version-button[data-state="update"]:hover,
.fcx-header-version-button[data-state="update"]:focus-visible {
  border-color: rgba(255, 176, 93, 0.9);
  background: rgba(255, 145, 55, 0.16);
  color: #ffd2a6;
}

.auto-sbc-page-shell {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 22px 26px 28px;
  background:
    radial-gradient(circle at 82% 4%, rgba(57, 214, 163, 0.11), transparent 28rem),
    #14181f;
  color: #e8ecf3;
  font-family: UltimateTeam, system-ui, -apple-system, sans-serif;
}

.auto-sbc-page {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.auto-sbc-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
  padding: 20px 22px;
  border: 1px solid #2b3346;
  border-radius: 16px;
  background: linear-gradient(135deg, #202b3a 0%, #171d27 62%, #17342c 140%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

.auto-sbc-eyebrow {
  margin: 0 0 7px;
  color: #39d6a3;
  font: 800 11px/1.1 system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.auto-sbc-brandline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 7px;
}

.auto-sbc-brandline .auto-sbc-eyebrow { margin: 0; }
.auto-sbc-eyebrow span { color: #8ce8c8; }

.auto-sbc-author-socials {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.auto-sbc-author-social {
  width: 24px;
  height: 24px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #3b4658;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
  color: #9fa9b9 !important;
  text-decoration: none !important;
  transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.auto-sbc-author-social svg {
  width: 15px;
  height: 15px;
  display: block;
}

.auto-sbc-author-social--douyin:hover,
.auto-sbc-author-social--douyin:focus-visible {
  border-color: #25f4ee;
  background: rgba(37, 244, 238, 0.1);
  color: #25f4ee !important;
  outline: none;
}

.auto-sbc-author-social--bilibili:hover,
.auto-sbc-author-social--bilibili:focus-visible {
  border-color: #fb7299;
  background: rgba(251, 114, 153, 0.1);
  color: #fb7299 !important;
  outline: none;
}

.auto-sbc-title {
  margin: 0;
  color: #f7f9fc;
  font: 700 clamp(25px, 3vw, 36px)/1.05 UltimateTeam, system-ui, sans-serif;
  letter-spacing: -0.025em;
}

.auto-sbc-description {
  margin: 9px 0 0;
  color: #aeb7c7;
  font-size: 13px;
}

.auto-sbc-sync-status {
  flex: 0 0 auto;
  padding: 7px 11px;
  border: 1px solid rgba(57, 214, 163, 0.4);
  border-radius: 999px;
  background: rgba(57, 214, 163, 0.1);
  color: #8ce8c8;
  font: 700 11px/1 system-ui, sans-serif;
  white-space: nowrap;
}

.auto-sbc-sync-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-sbc-refresh-button {
  min-height: 30px;
  padding: 7px 11px;
  border: 1px solid #46536a;
  border-radius: 999px;
  background: #202938;
  color: #dce3ed;
  font: 700 11px/1 system-ui, sans-serif;
  cursor: pointer;
}

.auto-sbc-refresh-button:hover,
.auto-sbc-refresh-button:focus-visible {
  border-color: #39d6a3;
  color: #8ce8c8;
  outline: none;
}

.auto-sbc-refresh-button:disabled {
  cursor: wait;
  opacity: 0.55;
}

#fcx-task-overlay-root {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  isolation: isolate;
  pointer-events: none;
}

.fcx-task-overlay__fallback-backdrop {
  position: absolute;
  inset: 0;
  display: none;
  place-items: center;
  background: rgba(4, 7, 11, 0.82);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}

#fcx-task-overlay-root.is-fallback .fcx-task-overlay__fallback-backdrop {
  display: grid;
}

.fcx-task-overlay__fallback-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(232, 237, 244, 0.25);
  border-top-color: #39d6a3;
  border-radius: 50%;
  animation: fcx-task-overlay-spin 0.9s linear infinite;
}

@keyframes fcx-task-overlay-spin {
  to { transform: rotate(360deg); }
}

.fcx-operation-status {
  position: fixed;
  top: calc(50% + 58px);
  left: 50%;
  z-index: 2;
  display: grid;
  width: min(440px, calc(100vw - 36px));
  gap: 5px;
  transform: translateX(-50%);
  color: #cbd3df;
  font: 600 12px/1.35 system-ui, -apple-system, sans-serif;
  text-align: center;
  pointer-events: none;
}

.fcx-task-end-overlay {
  position: fixed;
  top: max(12px, env(safe-area-inset-top, 0px));
  left: 50%;
  z-index: 3;
  min-width: 112px;
  min-height: 40px;
  padding: 9px 18px;
  transform: translateX(-50%);
  border: 1px solid #ff8e9d;
  border-radius: 10px;
  background: rgba(111, 28, 42, 0.96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38);
  color: #fff6f7;
  font: 800 14px/1 UltimateTeam, system-ui, sans-serif;
  cursor: pointer;
  pointer-events: auto;
}

.fcx-task-end-overlay:hover,
.fcx-task-end-overlay:focus-visible {
  border-color: #ffd0d7;
  background: #8d293b;
  outline: 2px solid rgba(255, 208, 215, 0.72);
  outline-offset: 2px;
}

.fcx-task-end-overlay:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .fcx-task-overlay__fallback-spinner {
    animation-duration: 1.8s;
  }
}

.fcx-operation-status__entry {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(16, 21, 29, 0.82);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
}

.fcx-operation-status__entry.is-success { color: #8ce8c8; }
.fcx-operation-status__entry.is-error { color: #fecaca; }

.auto-sbc-loading,
.auto-sbc-error,
.auto-sbc-empty {
  box-sizing: border-box;
  width: 100%;
  padding: 24px;
  border: 1px solid #2b3346;
  border-radius: 14px;
  background: #191f29;
  color: #aeb7c7;
  text-align: center;
}

.auto-sbc-error {
  border-color: rgba(248, 113, 113, 0.38);
  color: #fecaca;
}

.auto-sbc-toolbar {
  position: relative;
  display: block;
  width: 100%;
}

.auto-sbc-section {
  margin-top: 18px;
}

.auto-sbc-section-title {
  margin: 0 0 10px;
  color: #cbd3df;
  font: 800 12px/1.2 system-ui, sans-serif;
  letter-spacing: 0.08em;
}

.auto-sbc-action-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.auto-sbc-action--harvest {
  border-color: rgba(74, 183, 127, 0.56) !important;
  background: linear-gradient(135deg, rgba(26, 104, 72, 0.5), rgba(18, 61, 51, 0.72)) !important;
}

.fcx-harvest-dialog { display: grid; gap: 16px; }
.fcx-harvest-settings { display: grid; gap: 10px; }
.fcx-harvest-settings .fcx-option-card { margin: 0; }
.fcx-harvest-settings input[type="text"] { width: min(260px, 58vw); }
.fcx-harvest-records__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 6px; }
.fcx-harvest-records__summary { color: #8d9aae; font-size: 11px; }
.fcx-harvest-records { display: grid; max-height: 300px; overflow: auto; border: 1px solid #2b3346; border-radius: 10px; }
.fcx-harvest-record { display: grid; grid-template-columns: 52px minmax(0, 1fr); align-items: center; gap: 12px; padding: 11px 13px; border-bottom: 1px solid #2b3346; background: #111823; }
.fcx-harvest-record:last-child { border-bottom: 0; }
.fcx-harvest-record__rating { display: grid; place-items: center; min-height: 36px; border-radius: 8px; background: rgba(38, 139, 91, 0.2); color: #6ed39d; font-size: 16px; }
.fcx-harvest-record div { min-width: 0; }
.fcx-harvest-record div strong, .fcx-harvest-record div span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcx-harvest-record div span { margin-top: 4px; color: #8d9aae; font-size: 10px; }
.fcx-harvest-records__empty { margin: 0; padding: 28px 16px; color: #8d9aae; text-align: center; }

.auto-sbc-page .ut-tab-bar-item {
  box-sizing: border-box;
  min-width: 0;
  min-height: 82px;
  margin: 0 !important;
  padding: 14px 16px;
  border: 1px solid #2b3346;
  border-radius: 14px;
  background: linear-gradient(155deg, #1d2735, #171d27) !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.23);
  color: #e8ecf3 !important;
  text-align: left;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.auto-sbc-page .ut-tab-bar-item::before {
  display: none !important;
}

.auto-sbc-page .ut-tab-bar-item:hover,
.auto-sbc-page .ut-tab-bar-item:focus-visible {
  transform: translateY(-2px);
  border-color: #46536a;
  outline: none;
}

.auto-sbc-page #btnRoutineRoll {
  border-color: rgba(125, 249, 204, 0.55) !important;
  background:
    radial-gradient(circle at 82% 18%, rgba(57, 214, 163, 0.22), transparent 38%),
    linear-gradient(155deg, #1b2d2b, #151e24) !important;
}

.auto-sbc-action-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.auto-sbc-action-copy strong { color: #8ce8c8; font-size: 14px; }
.auto-sbc-action-copy span { color: #9eabba; font-size: 10px; }

.auto-sbc-set-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}

.auto-sbc-set-grid > .ut-tab-bar-item {
  min-height: 132px;
  overflow: hidden;
}

.auto-sbc-set-grid > .ut-tab-bar-item > div {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.auto-sbc-set-grid > .ut-tab-bar-item img {
  width: 58px !important;
  height: 58px !important;
  object-fit: contain;
  grid-row: 1 / span 2;
}

.auto-sbc-set-grid > .ut-tab-bar-item span {
  grid-column: 2;
  overflow-wrap: anywhere;
  font-weight: 700;
}

.auto-sbc-set-grid > .ut-tab-bar-item .ut-progress-bar {
  grid-column: 2;
}

.auto-sbc-set-grid > .auto-sbc-empty {
  grid-column: 1 / -1;
}

.fcx-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 22px;
  background: rgba(5, 8, 13, 0.78);
  backdrop-filter: blur(8px);
}

/*
 * Decision dialogs opened by an active task must sit above FCX's task
 * shield. The shield remains owned, so the EA page behind the dialog stays
 * blocked until the user confirms, replans or cancels.
 */
.fcx-modal-backdrop--task-interaction {
  z-index: 2147483200;
  pointer-events: auto;
}

.fcx-modal-panel {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  max-height: min(86vh, 820px);
  overflow: hidden;
  border: 1px solid #354158;
  border-radius: 18px;
  background: #171d27;
  box-shadow: 0 26px 70px rgba(0, 0, 0, 0.62);
  color: #e8ecf3;
  font-family: UltimateTeam, system-ui, -apple-system, sans-serif;
}

.fcx-modal-panel--routine { width: min(980px, 100%); }
.fcx-modal-panel--disclaimer { width: min(940px, 100%); }
.fcx-modal-panel--support { width: min(900px, 100%); }
.fcx-modal-panel--miniprogram { width: min(520px, 100%); }
.fcx-modal-panel--version { width: min(560px, 100%); }
.fcx-modal-panel--confirmation { width: min(440px, 100%); }
.fcx-version-dialog { display: grid; gap: 14px; }
.fcx-version-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid #334056;
  border-radius: 13px;
  background: #111823;
}
.fcx-version-summary > div { display: grid; gap: 5px; }
.fcx-version-summary > div:last-child { text-align: right; }
.fcx-version-summary small { color: #8290a4; font-size: 10px; }
.fcx-version-summary strong {
  color: #e9eef5;
  font: 800 16px/1 Consolas, ui-monospace, monospace;
}
.fcx-version-summary__arrow { color: #76849a; font-size: 18px; }
.fcx-version-summary.is-update {
  border-color: rgba(255, 158, 71, 0.48);
  background: linear-gradient(135deg, rgba(255, 145, 55, 0.09), #111823 62%);
}
.fcx-version-summary.is-update > div:last-child strong,
.fcx-version-summary.is-update .fcx-version-summary__arrow { color: #ffb36d; }
.fcx-version-summary.is-current > div:last-child strong,
.fcx-version-summary.is-current .fcx-version-summary__arrow { color: #69dfb8; }
.fcx-version-release-date { margin: 0; color: #8996a8; font-size: 10px; }
.fcx-version-notes {
  padding: 13px 15px;
  border: 1px solid #2d384b;
  border-radius: 11px;
  background: #131a24;
}
.fcx-version-notes h3 { margin: 0 0 9px; color: #dfe6ef; font-size: 12px; }
.fcx-version-notes ul { display: grid; gap: 7px; margin: 0; padding-left: 18px; }
.fcx-version-notes li { color: #aab5c4; font-size: 11px; line-height: 1.55; }
.fcx-version-error {
  padding: 13px 15px;
  border: 1px solid rgba(255, 158, 71, 0.42);
  border-radius: 11px;
  background: rgba(255, 145, 55, 0.08);
}
.fcx-version-error p { margin: 0; color: #ffc28c; font-size: 11px; line-height: 1.6; }
.fcx-miniprogram-dialog {
  display: grid;
  justify-items: center;
  gap: 14px;
}
.fcx-miniprogram-qr-frame {
  width: min(340px, 100%);
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
}
.fcx-miniprogram-qr {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
}
.fcx-miniprogram-login-tip {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(7, 193, 96, 0.38);
  border-radius: 11px;
  background: rgba(7, 193, 96, 0.08);
  color: #a9e9c5;
  font-size: 12px;
  line-height: 1.7;
  text-align: left;
}
.fcx-support-dialog { display: grid; gap: 14px; }
.fcx-support-thanks,
.fcx-support-panel {
  border: 1px solid #313c50;
  border-radius: 14px;
  background: #151c27;
}
.fcx-support-thanks { padding: 15px 17px; }
.fcx-support-thanks h3,
.fcx-support-panel h3 {
  margin: 0 0 10px;
  color: #edf2f8;
  font-size: 15px;
}
.fcx-support-thanks p,
.fcx-support-panel p {
  margin: 0 0 8px;
  color: #b7c0ce;
  font-size: 12px;
  line-height: 1.7;
}
.fcx-support-thanks-copy { white-space: pre-line; }
.fcx-support-thanks p:last-child,
.fcx-support-panel p:last-child { margin-bottom: 0; }
.fcx-support-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(300px, 1.1fr);
  gap: 14px;
}
.fcx-support-panel { padding: 16px; }
.fcx-support-donation { text-align: center; }
.fcx-support-qr {
  display: block;
  width: min(220px, 100%);
  height: auto;
  margin: 0 auto 10px;
  border: 8px solid #fff;
  border-radius: 12px;
  box-sizing: border-box;
}
.fcx-support-contact dl { display: grid; gap: 8px; margin: 0 0 14px; }
.fcx-support-contact dl > div {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
}
.fcx-support-contact dt { color: #8190a4; font-size: 11px; }
.fcx-support-contact dd { margin: 0; color: #e1e7ef; font-size: 12px; }
.fcx-support-feedback {
  padding: 11px 12px;
  border: 1px solid rgba(57, 214, 163, 0.35);
  border-radius: 10px;
  background: rgba(57, 214, 163, 0.07);
  color: #9cebd0 !important;
}
.fcx-support-socials { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.fcx-support-social-link {
  min-height: 32px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid #3b4658;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  color: #b7c0ce !important;
  font: 700 11px/1 system-ui, sans-serif;
  text-decoration: none !important;
}
.fcx-support-social-link svg { width: 16px; height: 16px; display: block; }
.fcx-support-social-link--douyin:hover,
.fcx-support-social-link--douyin:focus-visible { border-color: #25f4ee; color: #25f4ee !important; outline: none; }
.fcx-support-social-link--bilibili:hover,
.fcx-support-social-link--bilibili:focus-visible { border-color: #fb7299; color: #fb7299 !important; outline: none; }
.fcx-disclaimer-content { display: grid; gap: 14px; }
.fcx-disclaimer-notice {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(248, 173, 66, 0.55);
  border-radius: 12px;
  background: rgba(143, 87, 17, 0.14);
  color: #f7bd68;
  font-size: 12px;
  line-height: 1.65;
}
.fcx-disclaimer-section {
  overflow: hidden;
  border: 1px solid #313c50;
  border-radius: 14px;
  background: #151c27;
}
.fcx-disclaimer-section h3 {
  margin: 0;
  padding: 13px 15px;
  border-bottom: 1px solid #313c50;
  color: #e9eef6;
  font-size: 15px;
}
.fcx-disclaimer-copy {
  padding: 15px;
  color: #b7c0ce;
  font: 12px/1.75 system-ui, -apple-system, sans-serif;
  white-space: pre-wrap;
}
.fcx-routine-center,
.fcx-routine-editor { display: grid; gap: 16px; }
.fcx-routine-counter {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 18px;
  padding: 12px 14px;
  border: 1px solid #2f3b4e;
  border-radius: 12px;
  background: #111720;
  color: #aeb7c7;
  font-size: 12px;
}
.fcx-routine-counter strong { color: #78e7c1; font-size: 15px; }
.fcx-routine-counter small { margin-left: auto; color: #f6c978; }
.fcx-routine-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.fcx-routine-card {
  position: relative;
  display: grid;
  gap: 9px;
  min-width: 0;
  padding: 17px;
  border: 1px solid #303c50;
  border-radius: 15px;
  background: linear-gradient(145deg, #1c2532, #151b25);
  color: #edf2f7;
  text-align: left;
  cursor: pointer;
}
.fcx-routine-card:hover,
.fcx-routine-card:focus-visible { border-color: #57dcb0; outline: none; }
.fcx-routine-card > strong { padding-right: 54px; font-size: 16px; }
.fcx-routine-card > p { min-height: 34px; margin: 0; color: #9eabba; font-size: 11px; }
.fcx-routine-origin {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(57, 214, 163, 0.12);
  color: #8ce8c8;
  font-size: 9px;
}
.fcx-routine-card-steps {
  overflow: hidden;
  color: #d8dee9;
  font-size: 11px;
  line-height: 1.5;
  text-overflow: ellipsis;
}
.fcx-routine-card-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 9px;
  border-top: 1px solid #2a3445;
  color: #8896aa;
  font-size: 10px;
}
.fcx-routine-card-footer .is-ready { color: #72dfb9; }
.fcx-routine-card-footer .is-warning { color: #f6c978; }
.fcx-set-preview { display: grid; gap: 14px; }
.fcx-set-preview__excluded,
.fcx-set-preview__challenge {
  padding: 14px;
  border: 1px solid #2f4157;
  border-radius: 14px;
  background: #121b27;
}
.fcx-set-preview__excluded,
.fcx-set-preview__heading,
.fcx-set-preview__player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.fcx-set-preview__heading span,
.fcx-set-preview__player small { color: #93a3b8; font-size: 11px; }
.fcx-set-preview__players { display: grid; gap: 8px; margin-top: 12px; }
.fcx-set-preview__player { padding-top: 8px; border-top: 1px solid #26364a; }
.fcx-set-preview__player > span { display: grid; gap: 3px; }
.fcx-task-history { display: grid; gap: 14px; }
.fcx-task-history__filters { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fcx-task-history__filters select,
.fcx-task-history__filters input {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #34445a;
  border-radius: 10px;
  background: #101722;
  color: #edf2f8;
}
.fcx-task-history__list { display: grid; gap: 9px; }
.fcx-task-history__card {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #2c3a4d;
  border-radius: 12px;
  background: #121b27;
  color: #edf2f8;
  text-align: left;
}
.fcx-task-history__card-heading,
.fcx-task-history-detail__result-top,
.fcx-task-history-detail__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.fcx-task-history__status {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 22px;
  padding: 3px 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .03em;
}
.fcx-task-history__status--completed { color: #72dfb9; background: rgba(36, 178, 135, .1); }
.fcx-task-history__status--stopped { color: #f6c978; background: rgba(214, 157, 57, .1); }
.fcx-task-history__status--failed { color: #ff8e97; background: rgba(190, 65, 77, .12); }
.fcx-task-history__card:hover,
.fcx-task-history__card:focus-visible { border-color: #57dcb0; outline: none; }
.fcx-task-history__card span,
.fcx-task-history__card small { color: #93a3b8; }
.fcx-task-history__card .fcx-task-history__status--completed { color: #72dfb9; }
.fcx-task-history__card .fcx-task-history__status--stopped { color: #f6c978; }
.fcx-task-history__card .fcx-task-history__status--failed { color: #ff8e97; }
.fcx-task-history-detail { display: grid; gap: 16px; }
.fcx-task-history-detail__result,
.fcx-task-history-detail__section {
  padding: 14px;
  border: 1px solid #2f3c50;
  border-radius: 13px;
  background: #111925;
}
.fcx-task-history-detail__result time { color: #98a6b9; font-size: 10px; }
.fcx-task-history-detail__reason {
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid #744335;
  border-radius: 9px;
  background: #2a211f;
  color: #f5bd82;
  line-height: 1.55;
}
.fcx-task-history-detail__metrics { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.fcx-task-history-detail__section { display: grid; gap: 12px; }
.fcx-task-history-detail__section-heading h3,
.fcx-task-history-detail__section-heading p { margin: 0; }
.fcx-task-history-detail__section-heading h3 { color: #edf2f8; font-size: 14px; }
.fcx-task-history-detail__section-heading p { color: #8f9eb2; font-size: 9px; text-align: right; }
.fcx-task-history-detail__recovery {
  display: grid;
  gap: 5px;
  padding: 11px 12px;
  border: 1px solid #654735;
  border-radius: 10px;
  background: #241d1a;
}
.fcx-task-history-detail__recovery strong { color: #ffd09c; font-size: 11px; }
.fcx-task-history-detail__recovery small { color: #9daabd; font-size: 9px; }
.fcx-task-history-detail__recovery p { margin: 0; color: #e7edf5; line-height: 1.5; }
.fcx-task-history-detail__destinations {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.fcx-task-history-detail__destinations .fcx-pack-summary__metric { min-height: 62px; }
.fcx-task-history-detail__empty {
  margin: 0;
  padding: 18px;
  border: 1px dashed #354358;
  border-radius: 10px;
  color: #8e9cae;
  text-align: center;
}
@media (max-width: 720px) {
  .fcx-set-preview__heading,
  .fcx-set-preview__player { align-items: stretch; flex-direction: column; }
  .fcx-task-history__filters { grid-template-columns: 1fr; }
  .fcx-task-history-detail__metrics,
  .fcx-task-history-detail__destinations { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fcx-task-history-detail__section-heading { align-items: flex-start; flex-direction: column; }
  .fcx-task-history-detail__section-heading p { text-align: left; }
}
.fcx-routine-editor-section {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #303c50;
  border-radius: 14px;
  background: #151c26;
}
.fcx-routine-editor-section h3 { margin: 0; color: #f2f5f9; font-size: 15px; }
.fcx-routine-editor-section > p,
.fcx-routine-section-header p { margin: 3px 0 0; color: #92a0b3; font-size: 10px; }
.fcx-routine-field { display: grid; grid-template-columns: 130px minmax(0, 1fr); align-items: center; gap: 12px; }
.fcx-routine-cycle-field[hidden] { display: none; }
.fcx-routine-field > span { color: #b9c3d1; font-size: 11px; }
.fcx-routine-field.is-disabled > span,
.fcx-routine-field.is-disabled select,
.fcx-routine-field.is-disabled input { opacity: .55; }
.fcx-routine-recovery-controls { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; align-items: center; }
.fcx-routine-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 11px 12px;
  border: 1px solid #2d384a;
  border-radius: 11px;
  background: #111720;
  color: #e8ecf3;
  cursor: pointer;
}
.fcx-routine-option strong,
.fcx-routine-option small { display: block; }
.fcx-routine-option small { margin-top: 4px; color: #92a0b3; font-size: 10px; }
.fcx-routine-field input,
.fcx-routine-field textarea,
.fcx-routine-field select,
.fcx-routine-step select,
.fcx-routine-step input,
.fcx-routine-fallback-grid select,
.fcx-routine-fallback-grid input {
  box-sizing: border-box;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid #354158;
  border-radius: 9px;
  background: #10161f;
  color: #eef2f7;
}
.fcx-routine-field input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}
.fcx-routine-field input[type="number"]::-webkit-inner-spin-button,
.fcx-routine-field input[type="number"]::-webkit-outer-spin-button {
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
}
.fcx-routine-section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.fcx-routine-step-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.fcx-routine-step-list { display: grid; gap: 8px; }
.fcx-routine-step {
  display: grid;
  grid-template-columns: 30px minmax(180px, 1fr) 78px auto;
  align-items: center;
  gap: 9px;
  padding: 10px;
  border: 1px solid #2d384a;
  border-radius: 11px;
  background: #111720;
}
.fcx-routine-step[data-step-kind="pack"] {
  border-color: rgba(224, 184, 91, 0.48);
  box-shadow: inset 3px 0 0 rgba(224, 184, 91, 0.72);
}
.fcx-routine-step[data-step-kind="pack"] .fcx-routine-step-index {
  background: rgba(224, 184, 91, 0.14);
  color: #efcf82;
}
.fcx-routine-step-index {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #263447;
  color: #8ce8c8;
  font-weight: 800;
}
.fcx-routine-step-main { display: grid; gap: 4px; }
.fcx-routine-step-status { color: #7e8da2; font-size: 9px; }
.fcx-routine-step-status.is-available { color: #72dfb9; }
.fcx-routine-step-status.is-unavailable,
.fcx-routine-step-status.is-exhausted { color: #f6c978; }
.fcx-routine-step-controls { display: flex; gap: 5px; }
.fcx-routine-step-controls .fcx-button { min-width: 34px; padding: 8px; }
.fcx-routine-fallback-grid {
  display: grid;
  grid-template-columns: minmax(170px, .8fr) minmax(220px, 1.4fr) 90px;
  align-items: center;
  gap: 10px;
}
.fcx-routine-check { display: flex; align-items: center; gap: 9px; color: #d4dbe5; }
.fcx-routine-check input { width: 18px; min-height: 18px; }
.fcx-routine-pack-picker { display: grid; gap: 14px; }

@media (max-width: 760px) {
  .fcx-routine-grid { grid-template-columns: 1fr; }
  .fcx-routine-section-header { align-items: flex-start; flex-direction: column; }
  .fcx-routine-step-actions { width: 100%; justify-content: stretch; }
  .fcx-routine-step-actions .fcx-button { flex: 1 1 0; }
  .fcx-routine-step {
    grid-template-columns: 30px minmax(0, 1fr) 72px;
  }
  .fcx-routine-step-controls {
    grid-column: 2 / -1;
    justify-content: flex-end;
  }
  .fcx-routine-field { grid-template-columns: 1fr; gap: 6px; }
}

.fcx-modal-header,
.fcx-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #2b3346;
}

.fcx-modal-footer {
  justify-content: flex-end;
  flex-wrap: wrap;
  border-top: 1px solid #2b3346;
  border-bottom: 0;
}

.fcx-modal-title {
  margin: 0;
  color: #f7f9fc;
  font-size: 21px;
  line-height: 1.2;
}

.fcx-modal-description {
  margin: 6px 0 0;
  color: #aeb7c7;
  font-size: 12px;
}

.fcx-modal-close {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #3a455b;
  border-radius: 10px;
  background: #202938;
  color: #f7f9fc;
  font-size: 25px;
  line-height: 1;
  cursor: pointer;
}

.fcx-modal-body {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 18px 20px;
}

.fcx-modal-grid,
.fcx-option-grid {
  display: grid;
  gap: 10px;
}

.fcx-modal-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.fcx-option-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #2b3346;
}

.fcx-choice-row,
.fcx-option-card,
.fcx-challenge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #2b3346;
  border-radius: 12px;
  background: #1c2430;
  color: #e8ecf3;
}

.fcx-choice-row {
  justify-content: space-between;
}

.fcx-choice-main {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 9px;
}

.fcx-choice-copy {
  min-width: 0;
}

.fcx-choice-title,
.fcx-choice-meta {
  display: block;
}

.fcx-choice-title {
  overflow: hidden;
  color: #f5f7fb;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fcx-choice-meta {
  margin-top: 4px;
  color: #94a0b3;
  font-size: 11px;
}

.fcx-choice-row input[type="number"],
.fcx-option-card input[type="number"],
.fcx-option-card select {
  box-sizing: border-box;
  min-width: 74px;
  padding: 8px;
  border: 1px solid #46536a;
  border-radius: 8px;
  background: #10151d;
  color: #f7f9fc;
}

.fcx-option-card {
  justify-content: space-between;
  min-height: 54px;
}

.fcx-option-card--warning {
  border-color: rgba(248, 173, 66, 0.62);
  background: rgba(143, 87, 17, 0.16);
}

.fcx-warning-copy,
.fcx-modal-status {
  color: #f7bd68;
  font-size: 11px;
}

.fcx-modal-status {
  flex: 1 1 220px;
  margin: 0 auto 0 0;
}

.fcx-button {
  min-height: 40px;
  padding: 9px 15px;
  border: 1px solid #3c485e;
  border-radius: 10px;
  background: #252f3e;
  color: #e8ecf3;
  font-weight: 750;
  cursor: pointer;
}

.fcx-button--primary {
  border-color: #39d6a3;
  background: #39d6a3;
  color: #071a13;
}

.fcx-button--danger {
  border-color: #f08b45;
  background: #8c421d;
  color: #fff3e9;
}

.fcx-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.fcx-sbc-summary {
  display: grid;
  grid-template-columns: 80px 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid #2b3346;
  border-radius: 14px;
  background: linear-gradient(135deg, #202b3a, #1a222d);
}

.fcx-sbc-summary img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.fcx-sbc-layout {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(280px, 1.2fr);
  gap: 14px;
}

.fcx-challenge-list {
  display: grid;
  align-content: start;
  gap: 8px;
}

.fcx-challenge-row {
  width: 100%;
  cursor: pointer;
  text-align: left;
}

.fcx-challenge-row[aria-pressed="true"] {
  border-color: #39d6a3;
  background: rgba(57, 214, 163, 0.1);
}

.fcx-challenge-row:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.fcx-requirements-panel {
  min-height: 170px;
  padding: 12px;
  border: 1px solid #2b3346;
  border-radius: 12px;
  background: #111720;
}

.fcx-sbc-run-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #2b3346;
  border-radius: 12px;
  background: #1c2430;
  color: #e8ecf3;
  cursor: pointer;
}

.fcx-sbc-run-option strong,
.fcx-sbc-run-option small {
  display: block;
}

.fcx-sbc-run-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 10px;
  padding: 12px 14px;
  border: 1px solid #344157;
  border-radius: 12px;
  background: #151d28;
  color: #e8ecf3;
}

.fcx-sbc-run-count strong,
.fcx-sbc-run-count small { display: block; }
.fcx-sbc-run-count small { margin-top: 4px; color: #94a0b3; font-size: 11px; }
.fcx-sbc-run-count input {
  width: 88px;
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid #4a5870;
  border-radius: 9px;
  background: #0f151e;
  color: #f6f8fb;
  font: 750 14px/1 Consolas, monospace;
  text-align: center;
}
.fcx-sbc-run-count input:focus { border-color: #66e1b8; outline: 2px solid rgba(102, 225, 184, 0.18); }

.fcx-sbc-run-option small {
  margin-top: 4px;
  color: #94a0b3;
  font-size: 11px;
}

.fcx-switch {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.fcx-switch input {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.fcx-switch__track {
  position: absolute;
  inset: 0;
  border: 1px solid #46536a;
  border-radius: 999px;
  background: #10151d;
  pointer-events: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.fcx-switch__track::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #cbd3df;
  content: "";
  transition: transform 0.15s ease, background 0.15s ease;
}

.fcx-switch input:checked + .fcx-switch__track {
  border-color: #39d6a3;
  background: rgba(57, 214, 163, 0.24);
}

.fcx-switch input:checked + .fcx-switch__track::after {
  background: #39d6a3;
  transform: translateX(20px);
}

.fcx-switch input:focus-visible + .fcx-switch__track {
  outline: 2px solid #8ce8c8;
  outline-offset: 2px;
}

.fcx-price-cache-actions {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.fcx-price-cache-actions > button {
  min-width: 0;
  flex: 1;
}

.fcx-price-cache-clear {
  border-color: #8d4050 !important;
  background: #572b35 !important;
}

.fcx-price-cache-clear.hover {
  background: #713443 !important;
}

.fcx-overlay-close {
  position: absolute;
  top: 4px;
  right: 6px;
  z-index: 2;
  width: 24px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: rgba(17, 23, 32, 0.92);
  color: #dbe2ec;
  font-size: 18px;
  line-height: 20px;
}

.fcx-overlay-close:hover,
.fcx-overlay-close:focus-visible {
  border-color: #ff8e9d;
  color: #ff8e9d;
  outline: none;
}

.fcx-cache-diagnostics {
  display: grid;
  gap: 16px;
  color: #e8ecf3;
}

.fcx-cache-summary,
.fcx-cache-grid,
.fcx-cache-source-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.fcx-cache-section {
  padding-top: 14px;
  border-top: 1px solid #2b3346;
}

.fcx-cache-section h3 {
  margin: 0 0 10px;
  color: #f4f7fb;
  font-size: 14px;
  font-weight: 700;
}

.fcx-cache-metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid #303a4d;
  border-radius: 10px;
  background: #121822;
}

.fcx-cache-metric span {
  color: #8f9bae;
  font-size: 11px;
}

.fcx-cache-metric strong {
  overflow: hidden;
  color: #eef2f7;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fcx-cache-metric--ok {
  border-color: rgba(57, 214, 163, 0.45);
}

.fcx-cache-metric--ok strong {
  color: #5ce2b5;
}

.fcx-cache-metric--warning {
  border-color: rgba(246, 184, 3, 0.48);
}

.fcx-cache-metric--warning strong {
  color: #f6c951;
}

.fcx-cache-copy,
.fcx-cache-checked {
  margin: 0;
  color: #aab4c4;
  font-size: 12px;
  line-height: 1.55;
}

.fcx-cache-events {
  max-height: 180px;
  overflow: auto;
  border: 1px solid #2b3346;
  border-radius: 10px;
  background: #0d1219;
}

.fcx-cache-event {
  padding: 8px 10px;
  border-bottom: 1px solid #222b39;
  color: #aab4c4;
  font: 11px/1.45 Consolas, "SFMono-Regular", monospace;
}

.fcx-cache-event:last-child {
  border-bottom: 0;
}

.fcx-cache-event--success { color: #5ce2b5; }
.fcx-cache-event--warning { color: #f6c951; }
.fcx-cache-event--error { color: #ff8e9d; }

/* FCX settings hub: dense enough for SBC power users, calm enough to scan. */
.fcx-settings-shell {
  position: absolute !important;
  inset: 0;
  box-sizing: border-box;
  display: block !important;
  overflow: auto !important;
  padding: 22px 26px 96px !important;
  background:
    linear-gradient(90deg, rgba(65, 78, 102, 0.08) 1px, transparent 1px) 0 0 / 48px 48px,
    #121720;
  color: #e8ecf3;
}

.fcx-settings-page {
  box-sizing: border-box;
  width: min(1060px, 100%) !important;
  min-height: 0 !important;
  margin: 0 auto !important;
  overflow: visible !important;
  background: transparent !important;
  box-shadow: none !important;
}

.fcx-settings-hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  margin-bottom: 16px;
  padding: 22px 24px;
  border: 1px solid #334057;
  border-radius: 18px;
  background: linear-gradient(120deg, #202a39 0%, #18202c 64%, #15342e 130%);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
}

.fcx-settings-hero::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: linear-gradient(#68edc0, #1e9f79);
  content: "";
}

.fcx-settings-eyebrow {
  margin: 0 0 8px;
  color: #6de7bf;
  font: 800 10px/1.1 Consolas, "SFMono-Regular", monospace;
  letter-spacing: 0.18em;
}

.fcx-sbc-fallback {
  display: grid;
  gap: 11px;
  margin-top: 10px;
  padding: 12px 14px;
  border: 1px solid #344157;
  border-radius: 12px;
  background: #151d28;
  color: #e8ecf3;
}

.fcx-sbc-fallback__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.fcx-sbc-fallback__header strong,
.fcx-sbc-fallback__header small,
.fcx-sbc-fallback__controls label > span {
  display: block;
}

.fcx-sbc-fallback__header small {
  margin-top: 4px;
  color: #94a0b3;
  font-size: 11px;
}

.fcx-sbc-fallback__controls {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 110px;
  gap: 10px;
}

.fcx-sbc-fallback__controls label > span {
  margin-bottom: 5px;
  color: #94a0b3;
  font-size: 10px;
}

.fcx-sbc-fallback__controls select,
.fcx-sbc-fallback__controls input {
  box-sizing: border-box;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid #4a5870;
  border-radius: 9px;
  background: #0f151e;
  color: #f6f8fb;
}
.fcx-sbc-fallback__controls input[type="number"],
.fcx-routine-fallback-grid input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}
.fcx-sbc-fallback__controls input[type="number"]::-webkit-inner-spin-button,
.fcx-sbc-fallback__controls input[type="number"]::-webkit-outer-spin-button,
.fcx-routine-fallback-grid input[type="number"]::-webkit-inner-spin-button,
.fcx-routine-fallback-grid input[type="number"]::-webkit-outer-spin-button {
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
}

.fcx-sbc-fallback.is-disabled .fcx-sbc-fallback__controls { opacity: .55; }

.fcx-settings-brandline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 8px;
}

.fcx-settings-brandline .fcx-settings-eyebrow { margin: 0; }
.fcx-settings-eyebrow span { color: #8ce8c8; }

.fcx-settings-hero h1 {
  margin: 0;
  color: #f8fafc;
  font: 750 clamp(25px, 3vw, 36px)/1.06 UltimateTeam, system-ui, sans-serif;
  letter-spacing: -0.025em;
}

.fcx-settings-hero p:last-child {
  margin: 9px 0 0;
  color: #aeb9ca;
  font-size: 13px;
}

.fcx-settings-protection-badge {
  display: grid;
  min-width: 116px;
  padding: 12px 15px;
  border: 1px solid rgba(104, 237, 192, 0.35);
  border-radius: 13px;
  background: rgba(13, 31, 29, 0.7);
  text-align: right;
}

.fcx-settings-protection-badge strong {
  color: #7bf0c7;
  font: 800 26px/1 Consolas, monospace;
}

.fcx-settings-protection-badge span {
  margin-top: 5px;
  color: #a7c9bd;
  font-size: 10px;
}

.fcx-settings-card-stack {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-bottom: 16px;
}

.fcx-view-error-shell {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  min-height: 100%;
  overflow: auto;
  padding: 56px 32px 96px;
  background: #121720;
  color: #f4f7fb;
}
.fcx-view-error-card {
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 32px;
  border: 1px solid rgba(255, 123, 142, .42);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(29, 40, 55, .97), rgba(18, 27, 39, .98));
  box-shadow: 0 24px 64px rgba(0, 0, 0, .28);
}
.fcx-view-error-badge {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 7px;
  color: #ff9cab;
  background: rgba(255, 123, 142, .12);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .14em;
}
.fcx-view-error-card h1 { margin: 18px 0 12px; font-size: 30px; }
.fcx-view-error-card p { margin: 8px 0; color: #b9c4d2; line-height: 1.65; }
.fcx-view-error-detail {
  padding: 12px 14px;
  border: 1px solid rgba(255, 123, 142, .25);
  border-radius: 10px;
  color: #ffd0d7 !important;
  background: rgba(9, 14, 22, .55);
  overflow-wrap: anywhere;
}
.fcx-view-error-help { font-size: 13px; }

.fcx-settings-disclaimer-copy {
  margin: 0 0 12px;
  color: #aeb7c7;
  font-size: 12px;
  line-height: 1.65;
}

.fcx-settings-control--hidden {
  display: none !important;
}

.fcx-settings-card.sbc-settings-wrapper.tile {
  box-sizing: border-box;
  min-width: 0;
  margin: 0;
  overflow: visible;
  border: 1px solid #2e394c;
  border-radius: 15px;
  background: #19212d;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.18);
}

.fcx-settings-card#disclaimer,
.fcx-settings-card#protection,
.fcx-settings-card#lockedPlayers,
.fcx-settings-card#customRules,
.fcx-settings-card#submissionReminders {
  grid-column: 1 / -1;
}

.fcx-remote-status,
.fcx-remote-field,
.fcx-remote-actions {
  display: flex;
  align-items: center;
}
.fcx-remote-status,
.fcx-remote-field {
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
  border-bottom: 1px solid rgba(126, 145, 174, .18);
}
.fcx-remote-status span,
.fcx-remote-field span { color: #aab5c6; }
.fcx-remote-status strong { color: #68edc0; }
.fcx-remote-field input,
.fcx-remote-field select {
  box-sizing: border-box;
  width: min(360px, 58%);
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid rgba(126, 145, 174, .28);
  border-radius: 8px;
  background: #111923;
  color: #f4f7fb;
}
.fcx-remote-actions { justify-content: flex-end; gap: 10px; margin-top: 16px; }
.fcx-remote-actions--auth {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.fcx-remote-actions--auth .fcx-button { width: 100%; }
.fcx-remote-error { margin: 12px 0 0; color: #ff9c9c; }
.fcx-remote-notice { margin: 12px 0 0; color: #68edc0; }
.fcx-register-form { display: grid; gap: 12px; }
.fcx-register-field { display: grid; gap: 7px; color: #aab5c6; }
.fcx-register-field input {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
  padding: 9px 11px;
  border: 1px solid rgba(126, 145, 174, .32);
  border-radius: 9px;
  outline: none;
  background: #111923;
  color: #f4f7fb;
}
.fcx-register-field input:focus {
  border-color: #39d6a3;
  box-shadow: 0 0 0 3px rgba(57, 214, 163, .12);
}
.fcx-register-hint { margin: 0; color: #8f9aae; font-size: 11px; }

.fcx-settings-card > .sbc-settings-header {
  justify-content: flex-start;
  box-sizing: border-box;
  margin: 0;
  padding: 15px 17px 11px;
  border-bottom: 1px solid #2a3547;
}

.fcx-settings-card > .sbc-settings-header h2 {
  margin: 0;
  color: #f3f6fa;
  font: 750 15px/1.2 UltimateTeam, system-ui, sans-serif;
}

.fcx-settings-card .sbc-settings-section {
  box-sizing: border-box;
  align-items: stretch;
  gap: 0 12px;
  padding: 4px 15px 15px;
}

.fcx-settings-card .sbc-settings-field,
.fcx-settings-card .sbc-settings-longField {
  box-sizing: border-box;
  width: calc(50% - 6px);
  margin-top: 10px;
  padding: 9px 10px;
  border: 1px solid #303c50;
  border-radius: 11px;
  background: #141b25;
}

.fcx-settings-card .sbc-settings-longField { width: 100%; }
.fcx-settings-card-copy {
  width: 100%;
  margin: 10px 2px 0;
  color: #97a5b8;
  font-size: 11px;
  line-height: 1.55;
}

.fcx-locked-manager { display: block !important; }
.fcx-locked-toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  width: 100%;
  gap: 9px;
  margin-top: 11px;
}
.fcx-locked-search {
  box-sizing: border-box;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid #3c4960;
  border-radius: 10px;
  outline: none;
  background: #101620;
  color: #f5f7fa;
}
.fcx-locked-search:focus { border-color: #68dfba; box-shadow: 0 0 0 2px rgba(104, 223, 186, 0.16); }
.fcx-protected-view-button { min-height: 42px; white-space: nowrap; }
.fcx-locked-results,
.fcx-locked-list {
  display: grid;
  width: 100%;
  gap: 7px;
  margin-top: 10px;
}
.fcx-locked-results { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); color: #91a0b4; }
.fcx-locked-search-result,
.fcx-locked-player-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 48px;
  padding: 8px 10px;
  border: 1px solid #303b4e;
  border-radius: 10px;
  background: #121923;
  color: #e6ebf2;
  text-align: left;
}
.fcx-locked-search-result { grid-template-columns: 38px 1fr; cursor: pointer; }
.fcx-locked-search-result:hover:not(:disabled),
.fcx-locked-search-result:focus-visible { border-color: #56d8ad; outline: none; }
.fcx-locked-search-result:disabled { opacity: 0.52; }
.fcx-locked-search-result > strong,
.fcx-locked-rating { color: #75e8c0; font: 800 15px/1 Consolas, monospace; }
.fcx-locked-search-result span,
.fcx-locked-player-copy { min-width: 0; }
.fcx-locked-search-result small,
.fcx-locked-player-copy small { display: block; margin-top: 3px; color: #8391a5; font-size: 10px; }
.fcx-locked-player-copy b { overflow: hidden; display: block; text-overflow: ellipsis; white-space: nowrap; }
.fcx-locked-remove {
  padding: 6px 9px;
  border: 1px solid #714553;
  border-radius: 8px;
  background: #412832;
  color: #ffc2cd;
  cursor: pointer;
}
.fcx-locked-list-heading { display: flex; justify-content: space-between; color: #cfd7e3; }
.fcx-locked-list-heading span,
.fcx-locked-empty { color: #8795a8; font-size: 11px; }

.fcx-rules-scope {
  display: grid;
  grid-template-columns: minmax(210px, 0.8fr) repeat(2, minmax(0, 1fr));
  width: 100%;
  gap: 10px;
  margin-top: 10px;
}
.fcx-rules-scope__heading {
  display: grid;
  align-content: center;
  gap: 5px;
  padding: 11px 13px;
  border-left: 3px solid #65e3b8;
  border-radius: 9px;
  background: linear-gradient(90deg, rgba(39, 112, 89, 0.24), rgba(18, 25, 35, 0));
}
.fcx-rules-scope__heading strong { color: #e9fff7; font-size: 13px; }
.fcx-rules-scope__heading span { color: #91a2b7; font-size: 10px; line-height: 1.45; }
.fcx-rules-scope > .sbc-settings-field,
.fcx-rules-scope > .sbc-settings-longField { width: 100%; margin-top: 0; }
.fcx-rules-content { display: flex; flex-wrap: wrap; width: 100%; gap: 0 12px; }

.fcx-submission-reminder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  gap: 12px;
  margin-top: 10px;
}
.fcx-submission-reminder-grid > .sbc-settings-field,
.fcx-submission-reminder-grid > .sbc-settings-longField {
  width: 100%;
  min-width: 0;
  margin-top: 0;
}
.fcx-exclusion-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, .65fr) auto;
  align-items: center;
  gap: 12px;
}
.fcx-exclusion-field__copy { display: grid; min-width: 0; gap: 5px; }
.fcx-exclusion-field__copy strong { color: #edf3fa; font-size: 13px; }
.fcx-exclusion-field__copy small { color: #8190a4; font-size: 10px; line-height: 1.45; }
.fcx-exclusion-field__summary { display: grid; min-width: 0; gap: 4px; }
.fcx-exclusion-field__summary b { color: #6fe4be; font: 800 12px/1 Consolas, monospace; }
.fcx-exclusion-field__summary span {
  overflow: hidden;
  color: #9aa7b8;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fcx-exclusion-field__button { min-width: 68px; min-height: 38px; padding-inline: 12px; }

.fcx-modal-panel--picker { width: min(860px, 100%); }
.fcx-picker { display: grid; min-height: 320px; gap: 12px; }
.fcx-picker__toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 9px;
}
.fcx-picker__search {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid #3a4860;
  border-radius: 10px;
  outline: none;
  background: #101720;
  color: #f4f7fb;
  font: 650 12px/1.2 UltimateTeam, system-ui, sans-serif;
}
.fcx-picker__search:focus { border-color: #68dfba; box-shadow: 0 0 0 3px rgba(104, 223, 186, .13); }
.fcx-picker__selection { color: #79e5c1; font: 800 11px/1 Consolas, monospace; white-space: nowrap; }
.fcx-picker__clear {
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid #3a465a;
  border-radius: 9px;
  background: #202938;
  color: #bdc7d5;
  font-weight: 700;
  cursor: pointer;
}
.fcx-picker__clear:disabled { cursor: not-allowed; opacity: .42; }
.fcx-picker__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  max-height: min(54vh, 520px);
  overflow: auto;
  padding: 3px 4px 3px 1px;
}
.fcx-picker__option {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 7px 10px;
  border: 1px solid #303d51;
  border-radius: 11px;
  outline: none;
  background: #141c27;
  color: #dfe6ef;
  text-align: left;
  cursor: pointer;
}
.fcx-picker__option:hover,
.fcx-picker__option:focus-visible { border-color: #53647d; background: #192433; }
.fcx-picker__option.is-selected {
  border-color: rgba(86, 224, 178, .72);
  background: linear-gradient(90deg, rgba(42, 124, 96, .3), #17232d 70%);
  color: #f1fff9;
}
.fcx-picker__option-visual {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: #202b3a;
}
.fcx-picker__option-visual:empty::before { content: "FCX"; color: #67778d; font: 800 8px/1 Consolas, monospace; }
.fcx-picker__option-visual img { display: block; max-width: 32px; max-height: 32px; object-fit: contain; }
.fcx-picker__option-label { overflow: hidden; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.fcx-picker__option-check {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid #46546a;
  border-radius: 7px;
  color: transparent;
  font-weight: 900;
}
.fcx-picker__option.is-selected .fcx-picker__option-check { border-color: #5ce0b5; background: #5ce0b5; color: #092119; }
.fcx-picker__empty { grid-column: 1 / -1; margin: 0; padding: 42px 16px; border: 1px dashed #364257; border-radius: 11px; color: #8896aa; text-align: center; }

.fcx-settings-savebar {
  position: static;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  padding: 10px 12px;
  border: 1px solid #354258;
  border-radius: 13px;
  background: rgba(21, 28, 39, 0.94);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(12px);
  isolation: isolate;
  pointer-events: auto !important;
}
.fcx-settings-savebar[hidden] { display: none !important; }
.fcx-settings-savebar.is-saved { border-color: rgba(104, 237, 192, .55); }
.fcx-settings-savebar.is-error { border-color: rgba(255, 123, 142, .75); }
.fcx-settings-savebar .fcx-button { pointer-events: auto !important; }
.fcx-settings-save-status { margin-right: auto; color: #9aa7b9; font-size: 11px; }

@media (min-width: 1380px) {
  .fcx-settings-savebar {
    position: fixed;
    top: 50%;
    right: 18px;
    bottom: auto;
    width: 138px;
    box-sizing: border-box;
    align-items: stretch;
    flex-direction: column;
    transform: translateY(-50%);
  }
  .fcx-settings-save-status { margin: 0 0 3px; line-height: 1.4; }
  .fcx-settings-savebar .fcx-button { width: 100%; }
}

.fcx-modal-panel--protected { width: min(920px, 100%); }
.fcx-protected-summary { display: grid; gap: 12px; }
.fcx-protected-summary__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.fcx-protected-summary__metric {
  display: grid;
  gap: 5px;
  padding: 11px 12px;
  border: 1px solid #303c50;
  border-radius: 11px;
  background: #111822;
}
.fcx-protected-summary__metric span { color: #8997aa; font-size: 10px; }
.fcx-protected-summary__metric strong { color: #72e8bf; font: 800 19px/1 Consolas, monospace; }
.fcx-protected-summary__warning {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #78583b;
  border-radius: 10px;
  background: rgba(128, 76, 34, 0.18);
  color: #ffc58e;
  font-size: 11px;
  line-height: 1.5;
}
.fcx-protected-summary__list { display: grid; gap: 8px; }
.fcx-protected-summary__empty {
  padding: 34px 18px;
  border: 1px dashed #39465b;
  border-radius: 12px;
  color: #8c9aad;
  text-align: center;
}
.fcx-protected-player {
  display: grid;
  grid-template-columns: 50px minmax(180px, 1fr) minmax(230px, auto);
  align-items: center;
  gap: 11px;
  min-height: 62px;
  padding: 10px 14px;
  border: 1px solid #303b4e;
  border-radius: 12px;
  background: #121923;
}
.fcx-protected-player__rating { color: #7ceac5; font: 800 18px/1 Consolas, monospace; text-align: center; }
.fcx-protected-player__copy { min-width: 0; }
.fcx-protected-player__copy strong { display: block; overflow: hidden; color: #edf2f7; text-overflow: ellipsis; white-space: nowrap; }
.fcx-protected-player__copy span { display: block; margin-top: 5px; color: #8896a9; font-size: 10px; }
.fcx-protected-player__reasons { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 6px; }
.fcx-protected-reason {
  padding: 5px 8px;
  border: 1px solid #3a4b54;
  border-radius: 999px;
  background: #18242a;
  color: #b9ddd1;
  font-size: 9px;
  white-space: nowrap;
}
.fcx-protected-reason.is-manualLock { border-color: #3b7563; background: rgba(37, 105, 82, .24); color: #8ef1cf; }
.fcx-protected-reason.is-activeSquad { border-color: #4e6688; background: rgba(58, 83, 119, .25); color: #bcd4f6; }
.fcx-protected-reason.is-evolution { border-color: #765b8e; background: rgba(91, 61, 116, .25); color: #dec3f4; }

.fcx-pack-summary { display: grid; gap: 14px; }
.fcx-pack-summary__metrics {
  display: grid;
  grid-template-columns: repeat(7, minmax(72px, 1fr));
  gap: 7px;
}
.fcx-pack-summary__metric {
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  border: 1px solid #303b4e;
  border-radius: 10px;
  background: #111822;
}
.fcx-pack-summary__metric span { color: #8290a4; font-size: 9px; }
.fcx-pack-summary__metric strong { color: #72e8bf; font: 800 17px/1 Consolas, monospace; }
.fcx-pack-summary__reason {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #7c4d37;
  border-radius: 10px;
  background: rgba(117, 59, 31, 0.2);
  color: #ffc28e;
  font-size: 11px;
}
.fcx-pack-summary__table {
  overflow: hidden;
  border: 1px solid #303b4e;
  border-radius: 11px;
}
.fcx-pack-summary__row {
  display: grid;
  grid-template-columns: 54px minmax(130px, 1.5fr) minmax(90px, 1fr) minmax(100px, 1fr) minmax(110px, 1fr) 80px 92px;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-bottom: 1px solid #273244;
  background: #151c27;
  color: #dce2eb;
  font-size: 11px;
}
.fcx-pack-summary__row:last-child { border-bottom: 0; }
.fcx-pack-summary__row > strong { color: #7ceac5; font: 800 14px/1 Consolas, monospace; }
.fcx-pack-summary__row--header { background: #101721; color: #8391a5; font-size: 9px; text-transform: uppercase; }
.fcx-pack-summary__empty { padding: 26px; border: 1px dashed #38445a; border-radius: 11px; color: #8d9aae; text-align: center; }

@media (max-width: 1120px) {
  .auto-sbc-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fcx-routine-step { grid-template-columns: 30px minmax(160px, 1fr) 72px; }
  .fcx-routine-step-controls { grid-column: 2 / -1; justify-content: flex-end; }
}

@media (max-width: 1280px) {
  .fcx-header-actions { margin-inline: 5px; }
  .fcx-header-support-button { width: 34px; padding: 0; }
  .fcx-header-support-button span { display: none; }
  .fcx-header-version-button {
    width: auto;
    min-width: 62px;
    padding-inline: 8px;
  }
  .fcx-header-version-button .fcx-header-version__compact { display: inline; }
}

@media (max-width: 680px) {
  .fcx-modal-backdrop {
    align-items: end;
    padding: 10px 10px max(10px, env(safe-area-inset-bottom, 0px));
  }
  .fcx-modal-panel {
    max-height: 92vh;
    border-radius: 16px;
  }
  .fcx-modal-grid,
  .fcx-option-grid,
  .fcx-sbc-layout,
  .fcx-cache-summary,
  .fcx-cache-grid,
  .fcx-cache-source-grid {
    grid-template-columns: 1fr;
  }
  .fcx-modal-header,
  .fcx-modal-body,
  .fcx-modal-footer {
    padding: 14px;
  }
  .fcx-choice-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .fcx-settings-shell { padding: 12px 12px 80px !important; }
  .fcx-settings-hero { align-items: flex-start; flex-direction: column; padding: 18px; }
  .fcx-settings-protection-badge { width: 100%; box-sizing: border-box; text-align: left; }
  .fcx-settings-card-stack { grid-template-columns: 1fr; }
  .fcx-settings-card#protection,
  .fcx-settings-card#lockedPlayers,
  .fcx-settings-card#customRules,
  .fcx-settings-card#submissionReminders { grid-column: auto; }
  .fcx-remote-field { align-items: flex-start; flex-direction: column; padding: 10px 0; }
  .fcx-remote-field input,
  .fcx-remote-field select { width: 100%; }
  .fcx-settings-card .sbc-settings-field,
  .fcx-settings-card .sbc-settings-longField { width: 100%; }
  .fcx-locked-toolbar { grid-template-columns: 1fr; }
  .fcx-rules-scope,
  .fcx-submission-reminder-grid { grid-template-columns: 1fr; }
  .fcx-exclusion-field { grid-template-columns: minmax(0, 1fr) auto; }
  .fcx-exclusion-field__summary { grid-column: 1 / -1; grid-row: 2; }
  .fcx-picker__toolbar { grid-template-columns: 1fr auto; }
  .fcx-picker__search { grid-column: 1 / -1; }
  .fcx-picker__list { grid-template-columns: 1fr; }
  .fcx-settings-savebar { flex-wrap: wrap; }
  .fcx-settings-save-status { flex: 1 0 100%; }
  .fcx-protected-summary__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fcx-protected-player { grid-template-columns: 42px minmax(0, 1fr); padding: 10px; }
  .fcx-protected-player__reasons { grid-column: 1 / -1; justify-content: flex-start; }
  .fcx-pack-summary__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fcx-pack-summary__row { grid-template-columns: 1fr 1fr; gap: 5px 12px; }
  .fcx-pack-summary__row--header { display: none; }
  .fcx-routine-grid { grid-template-columns: 1fr; }
  .fcx-routine-field { grid-template-columns: 1fr; gap: 5px; }
  .fcx-routine-section-header { align-items: flex-start; flex-direction: column; }
  .fcx-routine-step { grid-template-columns: 28px minmax(0, 1fr) 68px; }
  .fcx-routine-step-controls { grid-column: 1 / -1; justify-content: flex-end; }
  .fcx-routine-fallback-grid { grid-template-columns: 1fr; }
  .fcx-routine-counter small { width: 100%; margin-left: 0; }
  .fcx-pack-summary__row > span::before,
  .fcx-pack-summary__row > strong::before {
    display: block;
    margin-bottom: 2px;
    color: #718095;
    content: attr(data-label);
    font: 8px/1 system-ui, sans-serif;
  }
}

@media (max-width: 760px) {
  .auto-sbc-page-shell {
    padding: 14px 14px calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .auto-sbc-hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 17px;
  }
  .fcx-sbc-fallback__controls { grid-template-columns: 1fr; }
  .auto-sbc-sync-actions { flex-wrap: wrap; }
  .fcx-support-grid { grid-template-columns: 1fr; }
  .auto-sbc-action-grid {
    grid-template-columns: 1fr;
  }
  .auto-sbc-page .ut-tab-bar-item {
    min-height: 68px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auto-sbc-page .ut-tab-bar-item { transition: none; }
}

.fcx-candidate-rules {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid #2f3a4f;
  border-radius: 14px;
  background: #151d28;
  color: #e8ecf3;
}
.fcx-candidate-rules__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.fcx-candidate-rules__heading strong, .fcx-candidate-rules__heading small { display: block; }
.fcx-candidate-rules__heading small { margin-top: 3px; color: #94a0b3; font-size: 11px; }
.fcx-candidate-rules__restore { padding: 8px 11px; border: 1px solid #46536a; border-radius: 9px; background: #222c3b; color: #eef2f8; cursor: pointer; }
.fcx-candidate-rules__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.fcx-candidate-rules__subheading { grid-column: 1 / -1; display: grid; gap: 3px; margin-top: 4px; color: #d7dfec; }
.fcx-candidate-rules__subheading small { color: #94a0b3; font-size: 10px; }
.fcx-candidate-rules__details { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.fcx-candidate-rules__details[hidden] { display: none; }
.fcx-candidate-rules__field { display: grid; gap: 6px; padding: 11px; border: 1px solid #2c374b; border-radius: 11px; background: #111821; }
.fcx-candidate-rules__field > span:first-child { font-weight: 700; }
.fcx-candidate-rules__range { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 7px; }
.fcx-candidate-rules__range input { min-width: 0; width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #46536a; border-radius: 8px; background: #0d141d; color: #fff; appearance: textfield; -moz-appearance: textfield; }
.fcx-candidate-rules__range input::-webkit-inner-spin-button,
.fcx-candidate-rules__range input::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; appearance: none; }
.fcx-candidate-rules__number { grid-template-columns: minmax(0, 1fr) minmax(90px, 150px); align-items: center; }
.fcx-candidate-rules__number small { display: block; margin-top: 3px; color: #94a0b3; font-size: 10px; }
.fcx-candidate-rules__number input { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #46536a; border-radius: 8px; background: #0d141d; color: #fff; appearance: textfield; -moz-appearance: textfield; }
.fcx-candidate-rules__number input::-webkit-inner-spin-button,
.fcx-candidate-rules__number input::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; appearance: none; }
.fcx-candidate-rules__toggle { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.fcx-candidate-rules__toggle small { display: block; margin-top: 3px; color: #94a0b3; font-size: 10px; }
.fcx-consumption-summary { display: grid; gap: 14px; }
.fcx-consumption-group { overflow: hidden; border: 1px solid #2f3a4f; border-radius: 13px; background: #111821; }
.fcx-consumption-group > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #2f3a4f; background: #192230; }
.fcx-consumption-group > header strong, .fcx-consumption-group > header small { display: block; }
.fcx-consumption-group > header small { color: #94a0b3; font-size: 10px; text-align: right; }
.fcx-consumption-table { display: grid; }
.fcx-consumption-row { display: grid; grid-template-columns: 58px minmax(140px, 1.3fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(90px, .8fr); gap: 10px; align-items: center; padding: 9px 14px; border-bottom: 1px solid rgba(47, 58, 79, .72); color: #e8ecf3; }
.fcx-consumption-row:last-child { border-bottom: 0; }
.fcx-consumption-row--header { color: #94a0b3; font-size: 10px; font-weight: 750; }
.fcx-consumption-row > strong { color: #68edc0; }

.ut-tab-bar-item.icon-fcx-evolution { position: relative; }
.fcx-standalone-nav-tab {
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.fcx-standalone-nav-tab__label { line-height: 1; }
.fcx-evolution-navigation-screen {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: auto;
  overscroll-behavior: contain;
  background: #101721;
}
.ut-tab-bar-item.icon-fcx-evolution::after {
  content: "EVO";
  position: absolute;
  top: 3px;
  right: 8px;
  padding: 2px 4px;
  border: 1px solid rgba(83, 226, 184, .48);
  border-radius: 5px;
  background: #18372f;
  color: #6eebc3;
  font: 800 7px/1 system-ui, sans-serif;
  letter-spacing: .08em;
}
.fcx-academy-page-shell {
  background:
    radial-gradient(circle at 84% 3%, rgba(123, 84, 221, .13), transparent 30rem),
    radial-gradient(circle at 10% 30%, rgba(57, 214, 163, .08), transparent 26rem),
    #14181f;
}
.fcx-academy-hero { align-items: center; }
.fcx-academy-hero__limits,
.fcx-academy-editor__counts {
  display: flex;
  align-items: stretch;
  gap: 8px;
}
.fcx-academy-hero__limits > span,
.fcx-academy-editor__counts > span {
  display: grid;
  gap: 4px;
  min-width: 84px;
  padding: 11px 13px;
  border: 1px solid #334055;
  border-radius: 12px;
  background: rgba(13, 20, 29, .72);
  color: #9ba8bb;
  font: 700 10px/1.2 system-ui, sans-serif;
  text-align: center;
}
.fcx-academy-hero__limits b,
.fcx-academy-editor__counts b { display: block; font: 850 20px/1 Consolas, monospace; }
.fcx-academy-hero__limits .is-base b,
.fcx-academy-editor__counts .is-base b { color: #cbd3de; }
.fcx-academy-hero__limits .is-plus b,
.fcx-academy-editor__counts .is-plus b { color: #f3c85b; }
.fcx-academy-workspace { display: grid; gap: 14px; }
.fcx-academy-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto auto;
  gap: 10px;
  align-items: end;
  padding: 14px;
  border: 1px solid #2b3548;
  border-radius: 14px;
  background: #19222f;
}
.fcx-academy-search-wrap { display: grid; gap: 6px; color: #99a5b7; font-size: 10px; }
.fcx-academy-search,
.fcx-academy-editor select {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #3a4860;
  border-radius: 9px;
  outline: 0;
  background: #101721;
  color: #eef2f7;
  font: 700 12px/1 system-ui, sans-serif;
}
.fcx-academy-search:focus,
.fcx-academy-editor select:focus { border-color: #42d9aa; box-shadow: 0 0 0 3px rgba(66, 217, 170, .12); }
.fcx-academy-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  color: #c9d0dc;
  font-weight: 750;
  cursor: pointer;
}
.fcx-academy-switch input { width: 17px; height: 17px; accent-color: #39d6a3; }
.fcx-academy-stats { align-self: center; color: #8794a8; font: 750 10px/1 system-ui, sans-serif; }
.fcx-academy-loading,
.fcx-academy-empty {
  padding: 30px;
  border: 1px dashed #354156;
  border-radius: 14px;
  color: #8f9caf;
  text-align: center;
}
.fcx-academy-loading.is-error { border-color: #7a3d48; color: #ff9ca9; }
.fcx-academy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.fcx-academy-player {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 13px;
  border: 1px solid #2e394d;
  border-radius: 13px;
  background: linear-gradient(135deg, #1a2432, #121923);
  color: #eef2f8;
  text-align: left;
  cursor: pointer;
  transition: transform .12s ease, border-color .12s ease, background .12s ease;
}
.fcx-academy-player:hover,
.fcx-academy-player:focus-visible { transform: translateY(-1px); border-color: #45cda5; background: linear-gradient(135deg, #1d2d38, #141c26); outline: 0; }
.fcx-academy-player.has-evolved-sibling { opacity: .58; filter: saturate(.7); }
.fcx-academy-player.is-maxed { border-color: rgba(211, 184, 255, .38); }
.fcx-academy-player__rating {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 12px;
  background: rgba(61, 211, 165, .12);
  color: #64eac1;
  font: 850 20px/1 Consolas, monospace;
}
.fcx-academy-player__identity { min-width: 0; }
.fcx-academy-player__identity strong,
.fcx-academy-player__identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcx-academy-player__identity strong { font-size: 13px; }
.fcx-academy-player__identity small { margin-top: 5px; color: #8794a8; font-size: 10px; }
.fcx-academy-player__levels { display: flex; gap: 6px; }
.fcx-academy-player__levels span { padding: 6px 8px; border-radius: 8px; background: #0f1620; color: #8491a5; font-size: 9px; white-space: nowrap; }
.fcx-academy-player__levels .is-base b { color: #cbd3de; }
.fcx-academy-player__levels .is-plus b { color: #f3c85b; }
.fcx-academy-player__state { padding: 6px 8px; border: 1px solid #3d4960; border-radius: 8px; color: #aeb7c5; font-size: 9px; white-space: nowrap; }
#fcx-academy-player-modal .fcx-modal-panel,
#fcx-academy-confirm-modal .fcx-modal-panel,
#fcx-academy-result-modal .fcx-modal-panel { width: min(980px, 100%); }
#fcx-academy-preset-modal .fcx-modal-panel { width: min(620px, 100%); }
.fcx-academy-editor { display: grid; gap: 15px; }
.fcx-academy-editor__player,
.fcx-academy-confirm__player {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 13px;
  border: 1px solid #303c51;
  border-radius: 13px;
  background: #151e2a;
}
.fcx-academy-editor__player > b,
.fcx-academy-confirm__player > b { color: #65e9c1; font: 850 23px/1 Consolas, monospace; text-align: center; }
.fcx-academy-editor__player strong,
.fcx-academy-editor__player small,
.fcx-academy-confirm__player strong,
.fcx-academy-confirm__player small { display: block; }
.fcx-academy-editor__player small,
.fcx-academy-confirm__player small { margin-top: 4px; color: #8794a8; font-size: 10px; }
.fcx-academy-editor__counts > span { min-width: 66px; padding: 8px 10px; }
.fcx-academy-editor__counts b { display: inline; font-size: 14px; }
.fcx-academy-editor__recommendation { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 9px; align-items: end; }
.fcx-academy-editor__recommendation label { display: grid; gap: 6px; color: #8f9caf; font-size: 10px; }
.fcx-academy-styles { display: grid; gap: 12px; }
.fcx-academy-style-group { display: grid; gap: 8px; }
.fcx-academy-style-group h4 { margin: 0; color: #9ca8b9; font-size: 11px; }
.fcx-academy-style-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.fcx-academy-style {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  min-height: 58px;
  padding: 9px;
  border: 1px solid #303b50;
  border-radius: 10px;
  background: #111821;
  color: #dce2eb;
  text-align: left;
  cursor: pointer;
}
.fcx-academy-style__icon {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  box-sizing: border-box;
  border: 1px solid #38445a;
  border-radius: 12px;
  background: linear-gradient(145deg, #202a38, #101721);
  color: #7f8ba0;
  font: 28px/1 UltimateTeam-Icons, sans-serif;
  text-align: center;
  overflow: hidden;
  isolation: isolate;
}
.fcx-academy-style__icon::after {
  content: "";
  position: absolute;
  inset: auto -8px -12px auto;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: currentColor;
  opacity: .08;
  z-index: -1;
}
.fcx-academy-style__icon-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: currentColor;
  font: 850 8px/1 Arial, sans-serif;
  letter-spacing: -.3px;
}
.fcx-academy-style__icon.has-glyph .fcx-academy-style__icon-fallback { display: none; }
.fcx-academy-style__icon.is-base {
  border-color: rgba(199, 208, 220, .72);
  background: linear-gradient(145deg, #3c4654, #171d25);
  color: #e1e6ed;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08);
}
.fcx-academy-style__icon.is-plus {
  border-color: rgba(240, 196, 79, .82);
  background: linear-gradient(145deg, #77591c, #271e0d);
  color: #ffda72;
  box-shadow: 0 0 16px rgba(226, 171, 48, .18), inset 0 0 0 1px rgba(255, 232, 157, .12);
}
.fcx-academy-style__icon.is-preview { opacity: .7; }
.fcx-academy-style__icon.is-compact { width: 31px; height: 31px; border-radius: 8px; font-size: 21px; flex: 0 0 auto; }
.fcx-academy-style__copy { min-width: 0; }
.fcx-academy-style__copy strong,
.fcx-academy-style__copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcx-academy-style__copy strong { color: #dce2eb; font-size: 10px; }
.fcx-academy-style__copy small { margin-top: 5px; color: #768398; font-size: 9px; }
.fcx-academy-style.is-level-1 { border-color: rgba(190, 201, 215, .72); background: linear-gradient(135deg, rgba(110, 123, 140, .2), rgba(52, 61, 73, .13)); }
.fcx-academy-style.is-level-1 .fcx-academy-style__copy small { color: #cbd3de; }
.fcx-academy-style.is-level-2 { border-color: rgba(235, 188, 70, .78); background: linear-gradient(135deg, rgba(142, 103, 24, .27), rgba(75, 55, 16, .16)); }
.fcx-academy-style.is-level-2 .fcx-academy-style__copy small { color: #f3c85b; }
.fcx-academy-style.is-owned { box-shadow: inset 3px 0 #ffbf62; }
.fcx-academy-preset { display: grid; gap: 6px; }
.fcx-academy-preset__row,
.fcx-academy-confirm__list > div,
.fcx-academy-result__list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 11px;
  border: 1px solid #303b50;
  border-radius: 9px;
  background: #121923;
}
.fcx-academy-preset__row span:first-child { display: flex; align-items: center; gap: 8px; }
.fcx-academy-preset__row span:first-child b { display: grid; place-items: center; width: 23px; height: 23px; border-radius: 6px; background: #213044; color: #69e8c1; }
.fcx-academy-preset__row span:first-child em { color: #dce2eb; font-style: normal; font-weight: 750; }
.fcx-academy-preset__row span:last-child { display: flex; gap: 5px; }
.fcx-academy-preset__row button { width: 30px; height: 30px; border: 1px solid #40506a; border-radius: 7px; background: #202b3a; color: #eef2f8; cursor: pointer; }
.fcx-academy-preset__row button:disabled { opacity: .35; cursor: default; }
.fcx-academy-confirm,
.fcx-academy-result { display: grid; gap: 12px; }
.fcx-academy-confirm__list,
.fcx-academy-result__list { display: grid; gap: 7px; }
.fcx-academy-confirm__list span b,
.fcx-academy-confirm__list span small,
.fcx-academy-result__list span b,
.fcx-academy-result__list span small { display: block; }
.fcx-academy-confirm__list span small,
.fcx-academy-result__list span small { margin-top: 3px; color: #8794a8; font-size: 9px; }
.fcx-academy-confirm__list > div > strong { max-width: 52%; color: #ffcb79; font-size: 10px; text-align: right; }
.fcx-academy-confirm__trait { display: flex; align-items: center; gap: 9px; min-width: 0; }
.fcx-academy-result__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fcx-academy-result__stats span { padding: 12px; border: 1px solid #303b50; border-radius: 10px; background: #121923; color: #98a5b7; text-align: center; }
.fcx-academy-result__stats b { display: block; color: #65e9c1; font: 850 20px/1 Consolas, monospace; }
.fcx-academy-result__warning {
  padding: 10px 12px;
  border: 1px solid rgba(232, 171, 66, .55);
  border-radius: 10px;
  background: rgba(91, 60, 18, .25);
  color: #f0c26b;
  font-size: 10px;
  line-height: 1.55;
}
.fcx-academy-result__list .is-success > strong { color: #65e9c1; }
.fcx-academy-result__list .is-failed > strong { color: #ff9ca9; }
@media (max-width: 760px) {
  .fcx-candidate-rules__grid { grid-template-columns: 1fr; }
  .fcx-candidate-rules__heading { align-items: flex-start; flex-direction: column; }
  .fcx-consumption-group > header { flex-direction: column; }
  .fcx-consumption-group > header small { text-align: left; }
  .fcx-consumption-row { grid-template-columns: 1fr 1fr; gap: 5px 12px; }
  .fcx-consumption-row--header { display: none; }
  .fcx-consumption-row > span::before,
  .fcx-consumption-row > strong::before { display: block; margin-bottom: 2px; color: #718095; content: attr(data-label); font-size: 8px; }
  .fcx-academy-toolbar { grid-template-columns: 1fr 1fr; align-items: center; }
  .fcx-academy-search-wrap { grid-column: 1 / -1; }
  .fcx-academy-grid { grid-template-columns: 1fr; }
  .fcx-academy-player { grid-template-columns: 48px minmax(0, 1fr) auto; }
  .fcx-academy-player__rating { width: 48px; height: 48px; }
  .fcx-academy-player__levels { grid-column: 2 / -1; }
  .fcx-academy-player__state { grid-column: 3; grid-row: 1; }
  .fcx-academy-editor__recommendation { grid-template-columns: 1fr 1fr; }
  .fcx-academy-style-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fcx-academy-editor__player { grid-template-columns: 50px minmax(0, 1fr); }
  .fcx-academy-editor__counts { grid-column: 1 / -1; }
}
`;
let styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

const createPseudoContentSync = (() => {
  const FALLBACK_CONTENT = "\\E0DA";
  const registry = new Map();

  const normalizeContent = (rawContent) => {
    if (!rawContent || rawContent === "none") {
      return FALLBACK_CONTENT;
    }
    let value = rawContent.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) {
      return FALLBACK_CONTENT;
    }
    if (value.startsWith("\\")) {
      return value;
    }
    const codePoint = value.codePointAt(0);
    if (!Number.isFinite(codePoint)) {
      return FALLBACK_CONTENT;
    }
    return `\\${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  };

  const splitSelectors = (selectorText) =>
    selectorText
      .split(",")
      .map((sel) => sel.trim())
      .filter(Boolean);

  const findContentForSelector = (sourceSelector) => {
    const selector = sourceSelector.trim();
    const matches = (selectorText) =>
      splitSelectors(selectorText).includes(selector);

    const walkRules = (rules) => {
      if (!rules) {
        return null;
      }
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText) {
          if (matches(rule.selectorText)) {
            const value = rule.style?.getPropertyValue("content");
            if (value) {
              return value;
            }
          }
        }
        if (rule.cssRules) {
          const nested = walkRules(rule.cssRules);
          if (nested) {
            return nested;
          }
        }
      }
      return null;
    };

    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules || sheet.rules;
      } catch (err) {
        continue; // skip cross-origin stylesheets
      }
      const match = walkRules(rules);
      if (match) {
        return match;
      }
    }
    return null;
  };

  return ({ sourceSelector, injectSelector }) => {
    if (!sourceSelector || !injectSelector) {
      throw new Error("sourceSelector and injectSelector are required");
    }

    const rawContent = findContentForSelector(sourceSelector);
    const content = normalizeContent(rawContent);

    let styleElement = registry.get(injectSelector);
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.dataset.injectSelector = injectSelector;
      document.head.appendChild(styleElement);
      registry.set(injectSelector, styleElement);
    }

    styleElement.textContent = `${injectSelector} {\n  content: "${content}";\n}`;
  };
})();

const syncBadgeContent = () => {
  try {
    createPseudoContentSync({
      sourceSelector:
        ".ut-store-pack-details-view.is-untradeable .ut-store-pack-details-view--title span::after",
      injectSelector: ".untradable::before",
    });
    createPseudoContentSync({
      sourceSelector:
        ".ut-store-pack-details-view.is-tradeable .ut-store-pack-details-view--title span::after",
      injectSelector: ".tradeable::before",
    });
  } catch (err) {
    console.warn("Failed to sync badge content", err);
  }
};

const getElement = (query, parent = document) => {
  return getRootElement(parent).querySelector(query);
};
const css = (elem, css) => {
  for (let key of Object.keys(css)) {
    getRootElement(elem).style[key] = css[key];
  }
  return elem;
};
const addClass = (elem, ...className) => {
  getRootElement(elem).classList.add(...className);
  return elem;
};
const removeClass = (elem, className) => {
  try {
    getRootElement(elem).classList.remove(className);
  } catch (error) {}
  return elem;
};
const getElementString = (node) => {
  let DIV = document.createElement("div");
  if ("outerHTML" in DIV) {
    return node.outerHTML;
  }
  let div = DIV.cloneNode();
  div.appendChild(node.cloneNode(true));
  return div.innerHTML;
};
const createElem = (tag, attrs, innerHtml) => {
  let elem = document.createElement(tag);
  elem.innerHTML = innerHtml;
  if (attrs) {
    for (let attr of Object.keys(attrs)) {
      if (!attrs[attr]) continue;
      elem.setAttribute(attr === "className" ? "class" : attr, attrs[attr]);
    }
  }
  return elem;
};
const getRootElement = (elem) => {
  if (elem.getRootElement) {
    return elem.getRootElement();
  }
  return elem;
};
const insertBefore = (newNode, existingNode) => {
  existingNode = getRootElement(existingNode);
  existingNode.parentNode.insertBefore(getRootElement(newNode), existingNode);
  return newNode;
};
const insertAfter = (newNode, existingNode) => {
  existingNode = getRootElement(existingNode);
  existingNode.parentNode.insertBefore(
    getRootElement(newNode),
    existingNode.nextSibling
  );
  return newNode;
};
const createButton = (id, label, callback, buttonClass = "btn-standard") => {
  const innerSpan = createElem(
    "span",
    {
      className: "button__text",
    },
    label
  );
  const button = createElem(
    "button",
    {
      className: buttonClass,
      id: id,
    },
    getElementString(innerSpan)
  );
  button.addEventListener("click", function () {
    callback();
  });
  button.addEventListener("mouseenter", () => {
    addClass(button, "hover");
  });
  button.addEventListener("mouseleave", () => {
    removeClass(button, "hover");
  });
  return button;
};

const DEFAULT_SEARCH_BATCH_SIZE = 91;
const MILLIS_IN_SECOND = 1000;
const wait = async (maxWaitTime = 2) => {
  const factor = Math.random();
  await new Promise((resolve) =>
    setTimeout(resolve, factor * maxWaitTime * MILLIS_IN_SECOND)
  );
};
