import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const packageManifest = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { version: string };
const viteSource = readFileSync(resolve(root, "vite.config.ts"), "utf8");
const apiSource = readFileSync(resolve(root, "src/remote/api-client.ts"), "utf8");
const clientSource = readFileSync(resolve(root, "src/remote/client.ts"), "utf8");
const authSource = readFileSync(resolve(root, "src/remote/auth-store.ts"), "utf8");
const releaseInfo = JSON.parse(
  readFileSync(resolve(root, "release-info.json"), "utf8"),
) as { release_date: string; update_notes: string[] };
const releaseAssemblerSource = readFileSync(
  resolve(root, "scripts/assemble-release.mjs"),
  "utf8",
);

describe("userscript release metadata", () => {
  it("uses the FCX brand and package version as the release source", () => {
    expect(packageManifest.version).toBe("26.1.0");
    expect(viteSource).toContain('name: "一阵失心风FCX"');
    expect(viteSource).toContain('author: "一阵失心风"');
    expect(viteSource).toContain('license: "MIT"');
    expect(viteSource).toContain('homepageURL: "https://fczhushou.com"');
    expect(viteSource).toContain(
      'description: "FCX 市面最先进滚卡，登录可享小程序。"',
    );
    expect(viteSource).not.toContain(
      "FCX 本地 SBC 求解、自动 SBC、球员保护与小程序远程控制工具",
    );
    expect(viteSource).toContain("icon: FCX_BRAND_ICON_DATA_URL");
    expect(viteSource).toContain('? "26.1.1"');
    expect(viteSource).toContain("version: userscriptVersion");
    expect(viteSource).toContain(
      '"https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*"',
    );
    expect(viteSource).toContain(
      '"https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*"',
    );
    expect(viteSource).toContain(
      '"https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app/*"',
    );
    expect(viteSource).not.toContain("26.2.0");
    expect(viteSource).not.toContain("// @require");
    expect(viteSource).not.toContain("// @resource");
    expect(viteSource).not.toContain("GM_getResourceText");
  });

  it("reports the build version and branded device name remotely", () => {
    expect(apiSource).toContain("client_version: __FCX_SCRIPT_VERSION__");
    expect(clientSource).toContain("script_version: __FCX_SCRIPT_VERSION__");
    expect(authSource).toContain(
      'DEFAULT_SCRIPT_DEVICE_NAME = "一阵失心风FCX"',
    );
  });

  it("generates the public update manifest from the userscript version", () => {
    expect(releaseInfo.release_date).toBe("2026-08-15");
    expect(releaseInfo.update_notes.length).toBeGreaterThan(0);
    expect(releaseAssemblerSource).toContain(
      "latest_version: userscriptVersion",
    );
    expect(releaseAssemblerSource).toContain(
      'resolve(releaseRoot, "version.json")',
    );
    expect(viteSource).toContain('"fczhushou.com"');
    expect(viteSource).not.toContain("@updateURL");
    expect(viteSource).not.toContain("@downloadURL");
  });
});
