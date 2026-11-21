import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, session, shell } from "electron";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { AppInfo, Options, Settings } from "@shared/types";
import { inspect } from "./engine/inspect";
import { defaultOutputDir, flushSettings, getSettings, setSettings } from "./engine/settings";
import { bundledSpotifyKeys } from "./engine/paths";
import { activeJobCount, cancelJob, cleanWorkDir, clearFinished, createJob, listJobs, onJobsChanged, removeJob, stopAll } from "./engine/queue";
import { spotifyKeys } from "./engine/spotify";
import { checkAppUpdate } from "./engine/updates";
import { ensureTools, updateYtdlp, ytdlpVersion } from "./engine/ytdlp";
import { runSelfTest, wantsSelfTest } from "./selftest";

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const isDev = !app.isPackaged;

const LIGHT = { bg: "#eef1ef", ink: "#0e1b17" };
const DARK = { bg: "#0c1412", ink: "#e8efec" };
const colors = () => (nativeTheme.shouldUseDarkColors ? DARK : LIGHT);

let win: BrowserWindow | null = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

function createWindow(opts: { hidden?: boolean } = {}) {
  const c = colors();
  win = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 880,
    minHeight: 640,
    show: false,
    title: "Atrapo",
    backgroundColor: c.bg,
    titleBarStyle: isMac || isWin ? "hidden" : "default",
    ...(isMac ? { trafficLightPosition: { x: 20, y: 22 } } : {}),
    ...(isWin ? { titleBarOverlay: { color: c.bg, symbolColor: c.ink, height: 56 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (!opts.hidden) win.once("ready-to-show", () => win?.show());
  win.on("closed", () => (win = null));

  // The window only ever shows our own page; anything else opens in the user's browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://") && !(isDev && url.startsWith(process.env.ELECTRON_RENDERER_URL ?? "\0"))) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    { role: "editMenu" },
    { role: "windowMenu" },
    ...(isDev ? [{ role: "viewMenu" as const }] : []),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  if (!isMac) win?.removeMenu();
}

// ------------------------------------------------------------------ IPC

type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>) {
  ipcMain.handle(channel, async (_e, ...args): Promise<Reply<R>> => {
    try {
      return { ok: true, value: await fn(...(args as A)) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
    }
  });
}

const inspectors = new Map<string, AbortController>();

function registerIpc() {
  handle("inspect", async (url: string) => {
    if (typeof url !== "string" || url.length > 2048) throw new Error("Enlace no válido");
    inspectors.get("current")?.abort();
    const ctrl = new AbortController();
    inspectors.set("current", ctrl);
    try {
      return await inspect(url, ctrl.signal);
    } finally {
      if (inspectors.get("current") === ctrl) inspectors.delete("current");
    }
  });

  handle("inspect:cancel", () => {
    inspectors.get("current")?.abort();
    inspectors.delete("current");
  });

  handle("job:start", (urls: string[], options: Options, title: string) => {
    if (!Array.isArray(urls) || !urls.length || urls.length > 50 || urls.some((u) => typeof u !== "string" || u.length > 2048)) throw new Error("Enlaces no válidos");
    const job = createJob(urls, options, String(title ?? "").slice(0, 200));
    return { id: job.id };
  });
  handle("job:cancel", (id: string) => cancelJob(String(id)));
  handle("job:remove", (id: string) => removeJob(String(id)));
  handle("job:clear", () => clearFinished());
  handle("job:list", () => listJobs());
  handle("job:reveal", (id: string) => {
    const job = listJobs().find((j) => j.id === id);
    const p = job?.result?.path;
    if (p && existsSync(p)) {
      shell.showItemInFolder(p);
      return true;
    }
    void shell.openPath(getSettings().outputDir);
    return false;
  });
  handle("folder:open", async () => {
    const dir = getSettings().outputDir;
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  });
  handle("folder:choose", async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ["openDirectory", "createDirectory"], defaultPath: getSettings().outputDir });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  });

  handle("settings:get", () => getSettings());
  handle("settings:set", (patch: Partial<Settings>) => {
    const allowed: (keyof Settings)[] = ["language", "theme", "outputDir", "collectionsAs", "spotifyClientId", "spotifyClientSecret", "spotifyFormat"];
    const clean: Partial<Settings> = {};
    for (const k of allowed) if (patch && k in patch) (clean as Record<string, unknown>)[k] = patch[k];
    const next = setSettings(clean);
    if (clean.theme) nativeTheme.themeSource = next.theme;
    return next;
  });

  handle("clipboard:read", () => clipboard.readText());
  handle("external:open", (url: string) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url);
  });

  handle("app:info", async (): Promise<AppInfo> => ({
    version: app.getVersion(),
    platform: process.platform,
    ytdlpVersion: await ytdlpVersion(),
    spotifyApi: Boolean(spotifyKeys().clientId || bundledSpotifyKeys().clientId),
    defaultOutputDir: defaultOutputDir(),
  }));
  handle("ytdlp:update", () => updateYtdlp());
  handle("app:check-update", () => checkAppUpdate());

  handle("window:titlebar", (dark: boolean) => {
    if (isWin && win && !win.isDestroyed()) {
      const c = dark ? DARK : LIGHT;
      win.setTitleBarOverlay({ color: c.bg, symbolColor: c.ink, height: 56 });
    }
  });
}

/** Opens the real window off-screen and checks that the interface boots without errors. Used by --self-test. */
async function uiSmokeTest(): Promise<string> {
  createWindow({ hidden: true });
  const w = win!;
  const errors: string[] = [];
  w.webContents.on("console-message", (e) => {
    const d = e as unknown as { level?: string | number; message?: string };
    if (d.level === "error" || d.level === 3) errors.push(String(d.message).slice(0, 160));
  });
  await new Promise<void>((resolve, reject) => {
    w.webContents.once("did-finish-load", () => resolve());
    w.webContents.once("did-fail-load", (_e, code, desc) => reject(new Error(`load failed ${code} ${desc}`)));
  });
  for (let i = 0; i < 40 && !(await w.webContents.executeJavaScript(`!!document.querySelector('textarea#link')`)); i++) await new Promise((r) => setTimeout(r, 250));
  const info = (await w.webContents.executeJavaScript(`({
    field: !!document.querySelector('textarea#link'),
    heading: (document.querySelector('h1')||{}).textContent,
    font: getComputedStyle(document.body).fontFamily.slice(0, 40),
    api: typeof window.atrapo,
    buttons: document.querySelectorAll('button').length,
  })`)) as { field: boolean; heading: string; font: string; api: string; buttons: number };
  w.destroy();
  if (!info.field || info.api !== "object") throw new Error(`UI did not boot: ${JSON.stringify(info)}`);
  if (errors.length) throw new Error(`console errors: ${errors.join(" | ")}`);
  return `window renders (field, ${info.buttons} buttons, api ${info.api}, font ${info.font}), no console errors`;
}

// ------------------------------------------------------------------ lifecycle

void app.whenReady().then(async () => {
  app.setAppUserModelId("app.atrapo.desktop");
  nativeTheme.themeSource = getSettings().theme;

  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
          ],
        },
      });
    });
  }
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  if (wantsSelfTest()) {
    await cleanWorkDir();
    registerIpc();
    app.exit(await runSelfTest(uiSmokeTest));
    return;
  }

  registerIpc();
  buildMenu();
  createWindow();
  onJobsChanged(() => win?.webContents.send("jobs:update", listJobs()));

  await cleanWorkDir();
  await ensureTools().catch((e) => console.error("tools setup failed", e));
  // Keep yt-dlp current in the background: the video sites change often.
  setTimeout(() => void updateYtdlp().catch(() => undefined), 8000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

nativeTheme.on("updated", () => {
  if (isWin && win && !win.isDestroyed()) {
    const c = colors();
    win.setTitleBarOverlay({ color: c.bg, symbolColor: c.ink, height: 56 });
  }
});

app.on("window-all-closed", () => {
  if (!isMac && !wantsSelfTest()) app.quit();
});

let quitting = false;
app.on("before-quit", (e) => {
  if (quitting) return;
  if (activeJobCount() > 0 && !wantsSelfTest()) {
    const es = (getSettings().language === "auto" ? app.getLocale() : getSettings().language).toLowerCase().startsWith("es");
    const choice = dialog.showMessageBoxSync(win ?? (undefined as never), {
      type: "question",
      buttons: es ? ["Seguir descargando", "Salir y cancelar"] : ["Keep downloading", "Quit and cancel"],
      defaultId: 0,
      cancelId: 0,
      message: es ? "Hay descargas en curso" : "Downloads are in progress",
      detail: es ? "Si sales ahora, se cancelarán." : "If you quit now, they will be cancelled.",
    });
    if (choice === 0) {
      e.preventDefault();
      return;
    }
  }
  quitting = true;
  e.preventDefault();
  flushSettings();
  void stopAll().finally(() => app.exit(0));
});

