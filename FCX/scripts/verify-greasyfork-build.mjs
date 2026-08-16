import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const output = resolve(projectRoot, "greasyfork", "FCX-macOS.user.js");
const manifestPath = resolve(projectRoot, "greasyfork", "version.json");
const source = readFileSync(output, "utf8");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const header = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==/m)?.[0];

if (!header) throw new Error("Greasy Fork build is missing a userscript header");

const expected = [
  "// @name         FCX macOS 自用维护版（非官方）",
  "// @namespace    https://github.com/titi14gj/FCX",
  "// @version      26.1.1",
  "// @author       titi14gj（维护）；一阵失心风（原作）",
  "// @license      MIT",
  "// @homepageURL  https://github.com/titi14gj/FCX",
  "// @supportURL   https://github.com/titi14gj/FCX/issues",
  "// @source       https://github.com/titi14gj/FCX",
  "// @antifeature  tracking 可选远程登录功能会向原 FCX 服务发送设备状态、任务状态和运行日志",
  "// @connect      raw.githubusercontent.com",
];
for (const fragment of expected) {
  if (!header.includes(fragment)) {
    throw new Error(`Greasy Fork metadata is missing: ${fragment}`);
  }
}

for (const forbidden of [
  "// @name         一阵失心风FCX",
  "// @namespace    http://tampermonkey.net/",
  "// @updateURL",
  "// @downloadURL",
]) {
  if (header.includes(forbidden)) {
    throw new Error(`Greasy Fork metadata still contains: ${forbidden}`);
  }
}

if (manifest.schema_version !== 1 || manifest.latest_version !== "26.1.1") {
  throw new Error("Greasy Fork version manifest does not match the script");
}
if (!source.includes("raw.githubusercontent.com/titi14gj/FCX")) {
  throw new Error("Greasy Fork build does not use the fork update manifest");
}
if (source.includes("https://fczhushou.com/fcx/version.json")) {
  throw new Error("Greasy Fork build still checks the original update manifest");
}
if (statSync(output).size > 2_000_000) {
  throw new Error("Greasy Fork build exceeds the 2 MB script limit");
}
if (source.split("\n").length < 1_000) {
  throw new Error("Greasy Fork build appears to be minified");
}

const syntax = spawnSync(process.execPath, ["--check", output], {
  encoding: "utf8",
});
if (syntax.status !== 0) {
  throw new Error(syntax.stderr || syntax.stdout || "node --check failed");
}

console.log(
  `Verified Greasy Fork userscript: ${statSync(output).size} bytes, public fork metadata, non-minified syntax`,
);
