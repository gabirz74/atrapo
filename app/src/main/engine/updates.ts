import { app } from "electron";
import type { UpdateInfo } from "@shared/types";

export const SITE_URL = "https://atrapo.vercel.app";

const newer = (a: string, b: string): boolean => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
};

/** Asks the download page whether a newer version of the app exists. Never throws: no connection means no news. */
export async function checkAppUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch(`${SITE_URL}/version.json`, { signal: AbortSignal.timeout(8000), headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) return { available: false };
    const j = (await res.json()) as { version?: string };
    if (j.version && newer(j.version, app.getVersion())) return { available: true, version: j.version, url: SITE_URL };
  } catch {
    /* offline */
  }
  return { available: false };
}
