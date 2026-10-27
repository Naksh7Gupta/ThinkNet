/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Mirrors frontend/electron/preload.cjs. */
interface ThinkNetDesktopStatus {
  state: "starting" | "ready" | "unavailable" | "failed";
  url?: string;
  message?: string;
  reused?: boolean;
  started?: boolean;
  log?: string;
  tail?: string[];
  at?: string;
}

interface ThinkNetDesktop {
  desktop: true;
  platform: string;
  apiBase: string;
  uiOrigin: string;
  versions: { electron: string; chrome: string; node: string };
  getStatus: () => Promise<ThinkNetDesktopStatus>;
  restartBackend: () => Promise<ThinkNetDesktopStatus>;
  openLogFile: () => Promise<string>;
  onStatus: (callback: (status: ThinkNetDesktopStatus) => void) => () => void;
}

interface Window {
  /** Present only when the page is loaded inside the Electron shell. */
  thinknet?: ThinkNetDesktop;
}
