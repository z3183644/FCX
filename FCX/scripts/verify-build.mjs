import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const distDir = resolve(projectRoot, "dist");
const expectedName = "FCX.js";
const userscriptVersion = "26.1.1";
const files = readdirSync(distDir).filter((name) => !name.startsWith("."));

if (files.length !== 1 || files[0] !== expectedName) {
  throw new Error(`Expected only ${expectedName}; found: ${files.join(", ")}`);
}

const output = resolve(distDir, expectedName);
const source = readFileSync(output, "utf8");
const requiredFragments = [
  "// ==UserScript==",
  "// @name         一阵失心风FCX",
  `// @version      ${userscriptVersion}`,
  "// @description  FCX 市面最先进滚卡，登录可享小程序。",
  "// @author       一阵失心风",
  "// @license      MIT",
  "// @homepageURL  https://fczhushou.com",
  "// @icon         data:image/x-icon;base64,",
  "// @icon64       data:image/x-icon;base64,",
  "// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*",
  "// @match        https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*",
  "// @match        https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app/*",
  "// @grant        GM_xmlhttpRequest",
  "// @connect      www.fut.gg",
  "// @connect      enhancer-api.futnext.com",
  "// @connect      127.0.0.1",
  "// @connect      fczhushou.com",
  "https://fczhushou.com/fcx/version.json",
  "https://fczhushou.com/fcx/routines.json",
  "在线流程目录不可用，继续使用脚本内置流程",
  "流程修改仅保存在当前浏览器。",
  "恢复默认",
  "fcx.update.lastPrompt",
  "fcx-header-version-button",
  "发现新版本",
  "前往官网",
  "localBackendUrl(backendPort, \"/solve\")",
  "并确认 EXE 与用户脚本端口一致",
  "FCX求解",
  "本次奖励卡包尚未到账，未打开仓库中已有的同名卡包。",
  "检测到球员挑选；自动球员挑选已关闭，已停在未分配页面。",
  "DIY进化",
  "一键DIY球员PlayStyle。",
  'title: "DIY特技"',
  "fcx-academy-style__icon-fallback",
  "进化任务遮罩已释放",
  "进化已完成，页面数据未自动刷新，请切换页面或刷新 Web App。",
  "Quick Buy Squad",
  "FCX设置",
  "FCX 自动化控制台",
  "一阵失心风",
  "捐赠/反馈",
  "FCX 小程序",
  "使用前请先进入左侧「FCX设置」→「账号与远程控制」，完成注册并登录；小程序需登录同一账号。",
  "fcx-header-support",
  "https://www.douyin.com/search/97129992611",
  "https://space.bilibili.com/698078048",
  "fcx.disclaimer.acceptedVersion",
  "data:image/x-icon;base64,",
  "data:image/png;base64,",
  "永动机滚卡",
  "✓ FCX 加载成功",
  "auto-sbc-toolbar",
  "价格缓存诊断",
  "document.addEventListener(\"keydown\"",
  "fcx-pick-",
  "requestPendingPlayerPickItemSelection()",
  "confirmPlayerPickItemSelection(chosen)",
  `script_version: "${userscriptVersion}"`,
  `client_version: "${userscriptVersion}"`,
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Build is missing compatibility fragment: ${fragment}`);
  }
}

if (source.includes(
  "FCX 本地 SBC 求解、自动 SBC、球员保护与小程序远程控制工具",
)) {
  throw new Error("Build still contains the retired userscript description");
}

for (const retiredPriceControl of [
  "mountRefreshPriceButton",
  'setText("刷新价格")',
  'setText("刷新中…")',
]) {
  if (source.includes(retiredPriceControl)) {
    throw new Error(`Build still contains the retired manual price control: ${retiredPriceControl}`);
  }
}

const miniProgramQr = readFileSync(
  resolve(projectRoot, "src/ui/assets/fcx-miniprogram-qr.png"),
).toString("base64");
if (!source.includes(`data:image/png;base64,${miniProgramQr}`)) {
  throw new Error("Build does not embed the original FCX mini program QR image");
}

if (/^\s*(?:import|export)\s/m.test(source)) {
  throw new Error("Build contains an ESM import/export statement");
}

if (source.includes('document.querySelectorAll(".ut-tab-bar-view")')) {
  throw new Error("Build still contains the legacy right-side toolbar injection");
}

const icon = source.match(/^\/\/ @icon\s+(data:image\/x-icon;base64,.+)$/m)?.[1];
const icon64 = source.match(/^\/\/ @icon64\s+(data:image\/x-icon;base64,.+)$/m)?.[1];
if (!icon || icon !== icon64) {
  throw new Error("Build metadata icons are missing or inconsistent");
}

if (source.includes("auto-sbc-social-button")) {
  throw new Error("Build still contains the retired social pill buttons");
}

if (source.includes("function GM_xmlhttpRequest")) {
  throw new Error("Build shadows the native Tampermonkey GM_xmlhttpRequest API");
}

const connectHosts = [...source.matchAll(/^\/\/ @connect\s+(.+)$/gm)].map((match) => match[1]);
const allowedConnectHosts = new Set([
  "www.fut.gg",
  "enhancer-api.futnext.com",
  "127.0.0.1",
  "fc.fczhushou.com",
  "fczhushou.com",
  "ntfy.sh",
]);
for (const host of connectHosts) {
  if (!allowedConnectHosts.has(host)) {
    throw new Error(`Build contains an unexpected connection host: ${host}`);
  }
}

if (source.includes('\"/solver-logs\"')) {
  throw new Error("Build still contains the retired solver-log polling path");
}

if (source.includes("numCounter")) {
  throw new Error("Build still contains the legacy three-digit counter");
}

for (const nativeOverride of [
  "UTSquadEntity.prototype._calculateRating",
  "UTItemEntity.prototype.init =",
  "UTSectionedItemListView.prototype.addItems =",
  "UTPlayerPicksView.prototype.setCarouselItems =",
  "UTPlayerPicksViewController.prototype",
  "Refresh Price",
]) {
  if (source.includes(nativeOverride)) {
    throw new Error(`Build still contains an unsafe native override: ${nativeOverride}`);
  }
}

for (const forbidden of [
  "https://fczhushou.com/fcx/client.core.js",
  "__fcx_remote_loader_state__",
  "(0, eval)(source",
  "// @updateURL    https://fczhushou.com/fcx/",
  "// @downloadURL  https://fczhushou.com/fcx/",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Build still contains remote-loader behavior: ${forbidden}`);
  }
}

for (const retiredRoutineCopy of [
  "推荐流程已有新版",
  "恢复最新推荐",
  "不会请求远程配置接口",
]) {
  if (source.includes(retiredRoutineCopy)) {
    throw new Error(`Build still contains retired routine copy: ${retiredRoutineCopy}`);
  }
}

for (const retiredDependency of [
  "// @require",
  "// @resource",
  "GM_getResourceText",
  "d3js.org",
  "pivottable.js.org",
  "code.jquery.com",
  "cdnjs.cloudflare.com/ajax/libs/c3",
]) {
  if (source.includes(retiredDependency)) {
    throw new Error(`Build still contains an unused external dependency: ${retiredDependency}`);
  }
}

const syntax = spawnSync(process.execPath, ["--check", output], {
  encoding: "utf8",
});
if (syntax.status !== 0) {
  throw new Error(syntax.stderr || syntax.stdout || "node --check failed");
}

console.log(`Verified ${expectedName}: complete userscript, embedded metadata, IIFE syntax`);
