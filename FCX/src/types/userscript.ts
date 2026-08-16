export interface GmCompatResponse {
  responseText: string;
  status: number;
  statusText: string;
  finalUrl: string;
  responseHeaders: Headers | string;
}

export interface GmCompatError {
  error?: unknown;
  responseText?: string;
  status?: number;
  statusText?: string;
}

export interface GmCompatRequestOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  timeout?: number;
  onload?: (response: GmCompatResponse) => void;
  onerror?: (error: GmCompatError | GmCompatResponse) => void;
  ontimeout?: (error: GmCompatError | GmCompatResponse) => void;
}

export type GmCompatRequest = (options: GmCompatRequestOptions) => void;

declare global {
  const __FCX_SCRIPT_VERSION__: string;
  const __FCX_UPDATE_MANIFEST_URL__: string;
  const __FCX_UPDATE_HOMEPAGE_URL__: string;
  const __FCX_AUTO_UPDATE_CHECK__: boolean;
  function GM_getValue<T>(key: string, defaultValue?: T): T | Promise<T>;
  function GM_setValue<T>(key: string, value: T): void | Promise<void>;
  function GM_deleteValue(key: string): void | Promise<void>;
}
