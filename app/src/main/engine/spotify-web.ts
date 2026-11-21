import { BrowserWindow, session } from "electron";
import { AbortError } from "./proc";
import type { SpotifyTrack } from "./spotify";

/**
 * Spotify's public API no longer lists the songs of a playlist for apps like this one, and the public embed
 * page stops at 100. The playlist page of the web player does show them all, so we open it in a hidden window,
 * scroll the list and read each row, exactly as a person would.
 */

interface Row {
  idx: number | null;
  id?: string;
  title: string;
  artists: string[];
  album?: string;
  img?: string;
  dur?: string;
}

export interface ScrapedPlaylist {
  title: string;
  owner?: string;
  cover?: string;
  tracks: SpotifyTrack[];
}

function chromeUserAgent(): string {
  const platform = process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : "X11; Linux x86_64";
  const major = (process.versions.chrome ?? "130").split(".")[0];
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const READ_ROWS = `(() => {
  const first = document.querySelector('[data-testid="tracklist-row"]');
  const grid = first && first.closest('[role="grid"]');
  if (!grid) return null;
  const out = [];
  for (const r of grid.querySelectorAll('[data-testid="tracklist-row"]')) {
    const a = r.querySelector('a[data-testid="internal-track-link"]');
    if (!a) continue;
    const idx = parseInt(r.parentElement && r.parentElement.getAttribute('aria-rowindex')) || null;
    const href = a.getAttribute('href') || '';
    const m = href.match(/track\\/([A-Za-z0-9]+)/);
    const cells = Array.from(r.querySelectorAll('[role="gridcell"]')).map((c) => c.innerText.trim());
    out.push({
      idx,
      id: m ? m[1] : undefined,
      title: a.textContent.trim(),
      artists: Array.from(r.querySelectorAll('[aria-colindex="2"] a[href*="/artist/"]')).map((x) => x.textContent.trim()),
      album: (r.querySelector('[aria-colindex="3"] a') || {}).textContent,
      img: (r.querySelector('img') || {}).src,
      dur: cells.reverse().find((t) => /^\\d+:\\d{2}$/.test(t)),
    });
  }
  return { rowcount: parseInt(grid.getAttribute('aria-rowcount')) || null, rows: out };
})()`;

const SCROLL = `(() => {
  let e = document.querySelector('[data-testid="tracklist-row"]');
  while (e && !(e.scrollHeight > e.clientHeight + 50 && ['auto','scroll'].includes(getComputedStyle(e).overflowY))) e = e.parentElement;
  if (e) { e.scrollBy(0, 700); return true; }
  return false;
})()`;

const HEADER = `(() => {
  const imgs = Array.from(document.querySelectorAll('img[src*="i.scdn.co/image"], img[src*="mosaic.scdn.co"], img[src*="image-cdn"]'))
    .filter((i) => !i.closest('[data-testid="tracklist-row"]'));
  imgs.sort((a, b) => (b.naturalWidth || 0) - (a.naturalWidth || 0));
  return { title: document.title, cover: imgs[0] ? imgs[0].src : null };
})()`;

/** Spotify serves several sizes of the same picture, picked by a prefix of the file name: ask for the large one. */
export function bigCover(url: string | undefined): string | undefined {
  return url?.replace(/ab67616d0000(?:4851|1e02)/, "ab67616d0000b273");
}

const parseDuration = (s?: string): number => {
  if (!s) return 0;
  const p = s.split(":").map(Number);
  return ((p[0] ?? 0) * 60 + (p[1] ?? 0)) * 1000;
};

export async function scrapePlaylist(
  id: string,
  opts: { signal?: AbortSignal; max: number; onProgress?: (done: number, total: number | null) => void },
): Promise<ScrapedPlaylist> {
  if (opts.signal?.aborted) throw new AbortError();
  const ses = session.fromPartition("atrapo-spotify"); // in memory, never shared with the app window
  // Spotify only serves its full player to a browser that looks like Chrome, so drop the "Electron" parts of the user agent.
  // It must be set before the window exists, or the page still sees the original one.
  ses.setUserAgent(chromeUserAgent(), "en-US,en");
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1000,
    webPreferences: { session: ses, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const onAbort = () => {
    if (!win.isDestroyed()) win.destroy();
  };
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  const ev = <T>(code: string): Promise<T> => win.webContents.executeJavaScript(code, true) as Promise<T>;
  const alive = () => {
    if (opts.signal?.aborted || win.isDestroyed()) throw new AbortError();
  };

  try {
    await Promise.race([
      win.loadURL(`https://open.spotify.com/playlist/${id}`),
      sleep(40_000).then(() => {
        throw new Error("Spotify tardó demasiado en responder.");
      }),
    ]);

    // Wait for the first rows to render.
    let ready = false;
    for (let i = 0; i < 80 && !ready; i++) {
      alive();
      ready = await ev<boolean>(`!!document.querySelector('[data-testid="tracklist-row"]')`);
      if (!ready) await sleep(500);
    }
    if (!ready) throw new Error("No se pudo abrir la playlist. Comprueba que es pública y que el enlace es correcto.");

    const seen = new Map<number, Row>();
    let total: number | null = null;
    let stale = 0;
    for (let step = 0; step < 4000 && stale < 10; step++) {
      alive();
      const got = await ev<{ rowcount: number | null; rows: Row[] } | null>(READ_ROWS);
      if (got?.rowcount) total = Math.min(got.rowcount - 1, opts.max); // the header row counts as one
      const before = seen.size;
      for (const r of got?.rows ?? []) if (r.id && r.idx && !seen.has(r.idx)) seen.set(r.idx, r);
      stale = seen.size === before ? stale + 1 : 0;
      opts.onProgress?.(seen.size, total);
      if ((total && seen.size >= total) || seen.size >= opts.max) break;
      await ev<boolean>(SCROLL);
      await sleep(stale ? 250 : 110);
    }

    const head = await ev<{ title: string; cover: string | null }>(HEADER).catch(() => ({ title: "", cover: null }));
    const rows = [...seen.values()].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0)).slice(0, opts.max);
    if (!rows.length) throw new Error("La playlist no tiene canciones accesibles.");

    const m = /^(.*?)\s+-\s+(?:playlist|lista)\b.*?\s(?:by|de)\s+(.*?)\s+\|\s+Spotify$/i.exec(head.title);
    const title = (m?.[1] ?? head.title.replace(/\s*\|\s*Spotify$/i, "")).trim() || "Playlist de Spotify";
    const tracks: SpotifyTrack[] = rows.map((r) => ({
      id: r.id!,
      title: r.title,
      artists: r.artists.length ? r.artists : ["Desconocido"],
      album: r.album?.trim() || undefined,
      durationMs: parseDuration(r.dur),
      cover: bigCover(r.img),
    }));
    return { title, owner: m?.[2]?.trim(), cover: bigCover(head.cover ?? undefined) ?? tracks[0]?.cover, tracks };
  } catch (err) {
    if (opts.signal?.aborted) throw new AbortError();
    throw err;
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    if (!win.isDestroyed()) win.destroy();
  }
}
