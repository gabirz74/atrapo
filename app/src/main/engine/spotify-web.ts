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
  /** How many songs Spotify says the playlist has (can exceed `tracks` when some are local files or unavailable). */
  declared: number | null;
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
  const drawn = [];
  for (const r of grid.querySelectorAll('[data-testid="tracklist-row"]')) {
    const a = r.querySelector('a[data-testid="internal-track-link"]');
    const idx = parseInt(r.parentElement && r.parentElement.getAttribute('aria-rowindex')) || null;
    if (idx) drawn.push(idx);
    if (!a) continue;
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
  return { rowcount: parseInt(grid.getAttribute('aria-rowcount')) || null, rows: out, drawn };
})()`;

/** Scrolls half a screen (smaller than what Spotify keeps drawn) and reports where it ended up. */
const SCROLL_STEP = `(() => {
  let e = document.querySelector('[data-testid="tracklist-row"]');
  while (e && !(e.scrollHeight > e.clientHeight + 50 && ['auto','scroll'].includes(getComputedStyle(e).overflowY))) e = e.parentElement;
  if (!e) return null;
  e.scrollBy(0, Math.max(200, Math.round(e.clientHeight * 0.5)));
  return { top: Math.round(e.scrollTop), max: Math.round(e.scrollHeight - e.clientHeight) };
})()`;

const SCROLL_TOP = `(() => {
  let e = document.querySelector('[data-testid="tracklist-row"]');
  while (e && !(e.scrollHeight > e.clientHeight + 50 && ['auto','scroll'].includes(getComputedStyle(e).overflowY))) e = e.parentElement;
  if (e) e.scrollTo(0, 0);
})()`;

/** First and last row position currently drawn: when it changes, Spotify has redrawn the list. */
const RANGE = `(() => {
  const idx = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]'))
    .map((r) => parseInt(r.parentElement && r.parentElement.getAttribute('aria-rowindex'))).filter(Boolean);
  return idx.length ? idx[0] + '-' + idx[idx.length - 1] : '';
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

    // Test aid: ATRAPO_SLOW_SPOTIFY=6 makes the hidden window 6x slower, like an old computer (set once the page exists).
    const slow = Number(process.env.ATRAPO_SLOW_SPOTIFY ?? 0);
    if (slow > 1) {
      win.webContents.debugger.attach("1.3");
      await win.webContents.debugger.sendCommand("Emulation.setCPUThrottlingRate", { rate: slow });
    }

    // Wait for the first rows to render.
    let ready = false;
    for (let i = 0; i < 80 && !ready; i++) {
      alive();
      ready = await ev<boolean>(`!!document.querySelector('[data-testid="tracklist-row"]')`);
      if (!ready) await sleep(500);
    }
    if (!ready) throw new Error("No se pudo abrir la playlist. Comprueba que es pública y que el enlace es correcto.");

    // The list is virtual (Spotify only draws the rows on screen), so we must visit every position.
    // Row positions run from 2 (1 is the header) to songs + 1.
    const seen = new Map<number, Row>();
    const drawn = new Set<number>();
    let total: number | null = null;
    const wanted = () => (total ? Math.min(total, opts.max) : null);
    const complete = () => {
      const w = wanted();
      if (!w) return false;
      for (let i = 2; i <= w + 1; i++) if (!drawn.has(i)) return false;
      return true;
    };
    const read = async () => {
      const got = await ev<{ rowcount: number | null; rows: Row[]; drawn: number[] } | null>(READ_ROWS);
      if (!got) return;
      if (got.rowcount) total = got.rowcount - 1; // the header row counts as one
      for (const i of got.drawn) drawn.add(i);
      for (const r of got.rows) if (r.id && r.idx && !seen.has(r.idx)) seen.set(r.idx, r);
      opts.onProgress?.(Math.min(drawn.size, wanted() ?? drawn.size), wanted());
    };

    scan: for (let pass = 0; pass < 4; pass++) {
      if (pass > 0) {
        // Something was skipped (a slow computer draws more slowly than we scroll): go back to the top, slower.
        await ev(SCROLL_TOP);
        await sleep(500 * pass);
      }
      let atBottom = 0;
      for (let step = 0; step < 3000; step++) {
        alive();
        await read();
        if (complete()) break scan;
        let before = await ev<string>(RANGE);
        const pos = await ev<{ top: number; max: number } | null>(SCROLL_STEP);
        // Wait until the list has been redrawn (longer on later passes) instead of a fixed pause.
        for (let w = 0; w < 25 * (pass + 1); w++) {
          await sleep(60);
          if ((await ev<string>(RANGE)) !== before) break;
        }
        await sleep(40 + 60 * pass);
        if (pos && pos.top >= pos.max - 2) {
          if (++atBottom >= 3) break; // reached the end of the list
        } else atBottom = 0;
        if (!pos) break;
      }
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
    return { declared: total, title, owner: m?.[2]?.trim(), cover: bigCover(head.cover ?? undefined) ?? tracks[0]?.cover, tracks };
  } catch (err) {
    if (opts.signal?.aborted) throw new AbortError();
    throw err;
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    if (!win.isDestroyed()) win.destroy();
  }
}
