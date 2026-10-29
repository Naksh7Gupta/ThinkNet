import { useCallback, useEffect, useState } from "react";

export type DesktopStatus = ThinkNetDesktopStatus;

/** The Electron preload API, or null when running as a plain web page. */
export function desktopBridge(): ThinkNetDesktop | null {
  return typeof window !== "undefined" && window.thinknet ? window.thinknet : null;
}

export function isDesktop(): boolean {
  return desktopBridge() !== null;
}

/**
 * Backend address decided at runtime by the shell. A base baked into the bundle
 * would be wrong the moment the app is installed on another machine, so the
 * desktop value wins whenever the bridge is present.
 */
export function getDesktopApiBase(): string {
  return desktopBridge()?.apiBase?.replace(/\/+$/, "") || "";
}

export async function selectModelInput(): Promise<string | null> {
  const bridge = desktopBridge();
  if (!bridge) throw new Error("Local model browsing is available in the ThinkNet desktop app.");
  return bridge.selectModelInput();
}

export async function selectOutputDirectory(): Promise<string | null> {
  const bridge = desktopBridge();
  if (!bridge) throw new Error("Choosing a local output folder is available in the ThinkNet desktop app.");
  return bridge.selectOutputDirectory();
}

export function useDesktopBackend() {
  const bridge = desktopBridge();
  const [status, setStatus] = useState<ThinkNetDesktopStatus | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    bridge
      .getStatus()
      .then((current) => active && setStatus(current))
      .catch(() => undefined);
    const unsubscribe = bridge.onStatus((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);

  const restart = useCallback(() => {
    if (!bridge) return;
    bridge.restartBackend().catch(() => undefined);
  }, [bridge]);

  const openLog = useCallback(() => {
    bridge?.openLogFile().catch(() => undefined);
  }, [bridge]);

  return { desktop: !!bridge, status, restart, openLog };
}
