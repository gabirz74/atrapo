import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppInfo, JobState, Settings, UpdateInfo } from "@shared/types";

interface Store {
  ready: boolean;
  settings: Settings;
  info: AppInfo | null;
  jobs: JobState[];
  update: UpdateInfo | null;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  refreshJobs: () => Promise<void>;
  refreshInfo: () => Promise<void>;
}

const FALLBACK: Settings = { language: "auto", theme: "system", outputDir: "", collectionsAs: "zip", spotifyFormat: "mp3", history: [] };

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(FALLBACK);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [jobs, setJobs] = useState<JobState[]>([]);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // The page must not wait for the slow bits (yt-dlp takes a few seconds to report its version).
      const [s, j] = await Promise.all([window.atrapo.getSettings(), window.atrapo.listJobs()]);
      if (!alive) return;
      setSettings(s);
      setJobs(j);
      setReady(true);
      void window.atrapo.getInfo().then((i) => {
        if (!alive) return;
        setInfo(i);
        document.documentElement.dataset.platform = i.platform;
      });
      void window.atrapo.checkAppUpdate().then((u) => alive && setUpdate(u));
    })();
    const off = window.atrapo.onJobs((list) => alive && setJobs(list));
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Theme: "system" removes the override so the CSS follows the OS.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    void window.atrapo.setTitleBarTheme(dark);
  }, [settings.theme]);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch })); // optimistic
    setSettings(await window.atrapo.setSettings(patch));
  }, []);
  const refreshJobs = useCallback(async () => setJobs(await window.atrapo.listJobs()), []);
  const refreshInfo = useCallback(async () => setInfo(await window.atrapo.getInfo()), []);

  const value = useMemo(
    () => ({ ready, settings, info, jobs, update, saveSettings, refreshJobs, refreshInfo }),
    [ready, settings, info, jobs, update, saveSettings, refreshJobs, refreshInfo],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const c = useContext(StoreContext);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}
