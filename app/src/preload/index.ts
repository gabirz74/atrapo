import { contextBridge, ipcRenderer } from "electron";
import type { AtrapoApi, JobState } from "@shared/types";

type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(channel, ...args)) as Reply<T>;
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

const api: AtrapoApi = {
  inspect: (url) => call("inspect", url),
  cancelInspect: () => call("inspect:cancel"),
  startJob: (urls, options, title) => call("job:start", urls, options, title),
  cancelJob: (id) => call("job:cancel", id),
  removeJob: (id) => call("job:remove", id),
  clearHistory: () => call("job:clear"),
  listJobs: () => call("job:list"),
  onJobs: (cb) => {
    const handler = (_e: unknown, jobs: JobState[]) => cb(jobs);
    ipcRenderer.on("jobs:update", handler);
    return () => ipcRenderer.removeListener("jobs:update", handler);
  },
  reveal: (id) => call("job:reveal", id),
  openFolder: () => call("folder:open"),
  getSettings: () => call("settings:get"),
  setSettings: (patch) => call("settings:set", patch),
  chooseFolder: () => call("folder:choose"),
  readClipboard: () => call("clipboard:read"),
  openExternal: (url) => call("external:open", url),
  getInfo: () => call("app:info"),
  updateYtdlp: () => call("ytdlp:update"),
  checkAppUpdate: () => call("app:check-update"),
  setTitleBarTheme: (dark) => call("window:titlebar", dark),
};

contextBridge.exposeInMainWorld("atrapo", api);
