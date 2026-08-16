import type { GmValueAdapter } from "../remote/auth-store";
import {
  compareFcxVersions,
  requestFcxVersionManifest,
  type FcxVersionManifest,
} from "../update/version-check";
import type { GmCompatRequest } from "../types/userscript";
import { openFcxModal } from "./modal";
import type { FcxHeaderSupportHandle } from "./support";

export const FCX_UPDATE_PROMPT_STORAGE_KEY = "fcx.update.lastPrompt";
export const FCX_UPDATE_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const FCX_UPDATE_HOMEPAGE_URL = __FCX_UPDATE_HOMEPAGE_URL__;

interface UpdatePromptRecord {
  targetVersion: string;
  promptedAt: number;
}

export interface FcxVersionUpdateControllerOptions {
  currentVersion: string;
  request: GmCompatRequest;
  storage: GmValueAdapter;
  header: FcxHeaderSupportHandle;
  documentRef?: Document;
  now?: () => number;
}

export class FcxVersionUpdateController {
  private readonly documentRef: Document;
  private readonly now: () => number;
  private checking: Promise<FcxVersionManifest> | undefined;
  private lastManifest: FcxVersionManifest | undefined;

  constructor(private readonly options: FcxVersionUpdateControllerOptions) {
    this.documentRef = options.documentRef ?? document;
    this.now = options.now ?? Date.now;
  }

  async checkAutomatically(): Promise<void> {
    try {
      const manifest = await this.check();
      if (!this.hasUpdate(manifest)) return;
      if (!(await this.shouldPrompt(manifest.latest_version))) return;
      await this.markPrompted(manifest.latest_version);
      this.openResultDialog(manifest);
    } catch (error) {
      console.warn("[FCX][Update] automatic version check failed", error);
    }
  }

  async checkManually(): Promise<void> {
    this.options.header.setVersionState({
      currentVersion: this.options.currentVersion,
      state: "checking",
    });
    try {
      this.openResultDialog(await this.check());
    } catch (error) {
      const previous = this.lastManifest;
      this.options.header.setVersionState(previous
        ? {
            currentVersion: this.options.currentVersion,
            latestVersion: previous.latest_version,
            state: this.hasUpdate(previous) ? "update" : "current",
          }
        : {
            currentVersion: this.options.currentVersion,
            state: "idle",
          });
      this.openErrorDialog(error);
    }
  }

  private async check(): Promise<FcxVersionManifest> {
    if (!this.checking) {
      this.checking = requestFcxVersionManifest(this.options.request, {
        now: this.now,
      }).finally(() => {
        this.checking = undefined;
      });
    }
    const manifest = await this.checking;
    this.lastManifest = manifest;
    this.options.header.setVersionState({
      currentVersion: this.options.currentVersion,
      latestVersion: manifest.latest_version,
      state: this.hasUpdate(manifest) ? "update" : "current",
    });
    return manifest;
  }

  private hasUpdate(manifest: FcxVersionManifest): boolean {
    return compareFcxVersions(
      this.options.currentVersion,
      manifest.latest_version,
    ) < 0;
  }

  private async shouldPrompt(targetVersion: string): Promise<boolean> {
    try {
      const record = await this.options.storage.get<UpdatePromptRecord | null>(
        FCX_UPDATE_PROMPT_STORAGE_KEY,
        null,
      );
      if (!record || record.targetVersion !== targetVersion) return true;
      const promptedAt = Number(record.promptedAt);
      return !Number.isFinite(promptedAt)
        || this.now() - promptedAt >= FCX_UPDATE_PROMPT_INTERVAL_MS;
    } catch (error) {
      console.warn("[FCX][Update] prompt state could not be read", error);
      return true;
    }
  }

  private async markPrompted(targetVersion: string): Promise<void> {
    try {
      await this.options.storage.set<UpdatePromptRecord>(
        FCX_UPDATE_PROMPT_STORAGE_KEY,
        { targetVersion, promptedAt: this.now() },
      );
    } catch (error) {
      console.warn("[FCX][Update] prompt state could not be saved", error);
    }
  }

  private createVersionSummary(
    manifest: FcxVersionManifest,
    updateAvailable: boolean,
  ): HTMLElement {
    const content = this.documentRef.createElement("div");
    content.className = "fcx-version-dialog";

    const summary = this.documentRef.createElement("div");
    summary.className = updateAvailable
      ? "fcx-version-summary is-update"
      : "fcx-version-summary is-current";
    const current = this.documentRef.createElement("div");
    current.innerHTML = `<small>当前版本</small><strong>v${this.options.currentVersion}</strong>`;
    const separator = this.documentRef.createElement("span");
    separator.className = "fcx-version-summary__arrow";
    separator.setAttribute("aria-hidden", "true");
    separator.textContent = updateAvailable ? "→" : "✓";
    const latest = this.documentRef.createElement("div");
    latest.innerHTML = `<small>最新版本</small><strong>v${manifest.latest_version}</strong>`;
    summary.append(current, separator, latest);

    const meta = this.documentRef.createElement("p");
    meta.className = "fcx-version-release-date";
    meta.textContent = `发布日期：${manifest.release_date}`;
    content.append(summary, meta);

    if (manifest.update_notes.length > 0) {
      const notes = this.documentRef.createElement("section");
      notes.className = "fcx-version-notes";
      const heading = this.documentRef.createElement("h3");
      heading.textContent = "更新内容";
      const list = this.documentRef.createElement("ul");
      for (const note of manifest.update_notes) {
        const item = this.documentRef.createElement("li");
        item.textContent = note;
        list.appendChild(item);
      }
      notes.append(heading, list);
      content.appendChild(notes);
    }
    return content;
  }

  private openResultDialog(manifest: FcxVersionManifest): void {
    const updateAvailable = this.hasUpdate(manifest);
    const modal = openFcxModal({
      id: "fcx-version-update-modal",
      title: updateAvailable
        ? `发现新版本 ${manifest.latest_version}`
        : "FCX 已是最新版本",
      description: updateAvailable
        ? "新版本已经发布，您可以前往官网查看并更新完整脚本。"
        : `当前正在使用 v${this.options.currentVersion}。`,
      content: this.createVersionSummary(manifest, updateAvailable),
      documentRef: this.documentRef,
    });
    modal.panel.classList.add("fcx-modal-panel--version");

    const closeButton = this.documentRef.createElement("button");
    closeButton.type = "button";
    closeButton.className = "fcx-button";
    closeButton.textContent = updateAvailable ? "稍后提醒" : "关闭";
    closeButton.addEventListener("click", modal.close);
    modal.footer.appendChild(closeButton);
    if (updateAvailable) {
      const homepage = this.documentRef.createElement("a");
      homepage.className = "fcx-button fcx-button--primary";
      homepage.href = FCX_UPDATE_HOMEPAGE_URL;
      homepage.target = "_blank";
      homepage.rel = "noopener noreferrer";
      homepage.textContent = "前往官网";
      modal.footer.appendChild(homepage);
    }
  }

  private openErrorDialog(error: unknown): void {
    const content = this.documentRef.createElement("div");
    content.className = "fcx-version-error";
    const message = this.documentRef.createElement("p");
    message.textContent = error instanceof Error
      ? error.message
      : "版本检查失败，请稍后重试";
    content.appendChild(message);
    const modal = openFcxModal({
      id: "fcx-version-update-modal",
      title: "无法检查更新",
      description: "FCX 可以继续正常使用。",
      content,
      documentRef: this.documentRef,
    });
    modal.panel.classList.add("fcx-modal-panel--version");
    const closeButton = this.documentRef.createElement("button");
    closeButton.type = "button";
    closeButton.className = "fcx-button";
    closeButton.textContent = "关闭";
    closeButton.addEventListener("click", modal.close);
    const retryButton = this.documentRef.createElement("button");
    retryButton.type = "button";
    retryButton.className = "fcx-button fcx-button--primary";
    retryButton.textContent = "重新检查";
    retryButton.addEventListener("click", () => {
      modal.close();
      void this.checkManually();
    });
    modal.footer.append(closeButton, retryButton);
  }
}
