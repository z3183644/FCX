import type {
  GmCompatError,
  GmCompatRequest,
  GmCompatResponse,
} from "../types/userscript";

export const FCX_VERSION_MANIFEST_URL =
  __FCX_UPDATE_MANIFEST_URL__;
export const FCX_VERSION_CHECK_TIMEOUT_MS = 6_000;

export interface FcxVersionManifest {
  schema_version: 1;
  latest_version: string;
  release_date: string;
  update_notes: string[];
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseVersionParts(value: string): [number, number, number] | null {
  const normalized = value.trim();
  if (!VERSION_PATTERN.test(normalized)) return null;
  const parts = normalized.split(".").map(Number);
  if (
    parts.length !== 3
    || parts.some((part) => !Number.isSafeInteger(part) || part < 0)
  ) {
    return null;
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

export function compareFcxVersions(current: string, candidate: string): number {
  const currentParts = parseVersionParts(current);
  const candidateParts = parseVersionParts(candidate);
  if (!currentParts) throw new Error(`当前版本号无效：${current}`);
  if (!candidateParts) throw new Error(`最新版本号无效：${candidate}`);
  for (let index = 0; index < currentParts.length; index += 1) {
    const difference = currentParts[index]! - candidateParts[index]!;
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export function parseFcxVersionManifest(source: string): FcxVersionManifest {
  const text = source.trim();
  if (!text) throw new Error("版本信息为空");
  if (text.startsWith("<")) throw new Error("版本地址返回了网页内容，而不是 JSON");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("版本信息不是有效的 JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("版本信息格式错误");
  }
  const value = parsed as Record<string, unknown>;
  if (value.schema_version !== 1) throw new Error("不支持的版本信息格式");
  const latestVersion =
    typeof value.latest_version === "string" ? value.latest_version.trim() : "";
  if (!parseVersionParts(latestVersion)) throw new Error("最新版本号格式错误");
  const releaseDate =
    typeof value.release_date === "string" ? value.release_date.trim() : "";
  if (!RELEASE_DATE_PATTERN.test(releaseDate)) throw new Error("发布日期格式错误");
  if (!Array.isArray(value.update_notes) || value.update_notes.length > 20) {
    throw new Error("更新说明格式错误");
  }
  const updateNotes = value.update_notes.map((note) => {
    if (typeof note !== "string") throw new Error("更新说明格式错误");
    const normalized = note.trim();
    if (!normalized || normalized.length > 200) {
      throw new Error("更新说明格式错误");
    }
    return normalized;
  });
  return {
    schema_version: 1,
    latest_version: latestVersion,
    release_date: releaseDate,
    update_notes: updateNotes,
  };
}

function networkErrorMessage(error: GmCompatError | GmCompatResponse): string {
  const status = Number("status" in error ? error.status : 0) || 0;
  return status > 0
    ? `版本检查失败：HTTP ${status}`
    : "版本检查失败，请检查网络连接";
}

export function requestFcxVersionManifest(
  request: GmCompatRequest,
  options: {
    url?: string;
    now?: () => number;
    timeoutMs?: number;
  } = {},
): Promise<FcxVersionManifest> {
  const manifestUrl = options.url ?? FCX_VERSION_MANIFEST_URL;
  const separator = manifestUrl.includes("?") ? "&" : "?";
  const url = `${manifestUrl}${separator}_=${(options.now ?? Date.now)()}`;
  return new Promise((resolve, reject) => {
    request({
      method: "GET",
      url,
      timeout: options.timeoutMs ?? FCX_VERSION_CHECK_TIMEOUT_MS,
      headers: { Accept: "application/json" },
      onload: (response) => {
        if (response.status < 200 || response.status >= 300) {
          reject(new Error(`版本检查失败：HTTP ${response.status}`));
          return;
        }
        try {
          resolve(parseFcxVersionManifest(response.responseText));
        } catch (error) {
          reject(error);
        }
      },
      onerror: (error) => reject(new Error(networkErrorMessage(error))),
      ontimeout: () => reject(new Error("版本检查超时，请稍后重试")),
    });
  });
}
