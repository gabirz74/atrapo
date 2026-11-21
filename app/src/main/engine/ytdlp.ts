import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { AudioFormat, Container, SourceId } from "@shared/types";
import { limits, tools } from "./paths";
import { friendlyError, run } from "./proc";

export type { AudioFormat, Container };

export interface DownloadOptions {
  mode: "video" | "audio";
  height?: number;
  container: Container;
  audioFormat: AudioFormat;
  subtitles: boolean;
  thumbnail: boolean;
  chapters: boolean;
  trimStart?: string;
  trimEnd?: string;
  /** Embed title/artist/thumbnail written by yt-dlp. Off for Spotify (we tag ourselves). */
  embedMetadata?: boolean;
}

export interface EntryInfo {
  url: string;
  title: string;
  duration?: number;
  uploader?: string;
  thumbnail?: string;
}

export interface MediaInfo {
  source: SourceId;
  url: string;
  kind: "single" | "collection";
  title: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  count: number;
  entries: EntryInfo[];
  hasVideo: boolean;
  video?: { heights: number[]; maxFps: number };
  audio?: { ext: string; abr?: number; codec?: string };
}

type Raw = Record<string, any>;

/** yt-dlp needs a JavaScript engine for YouTube. We lend it Electron itself running in "node mode". */
const ytEnv = (): NodeJS.ProcessEnv => ({ ELECTRON_RUN_AS_NODE: "1" });

function baseArgs(): string[] {
  const args = [
    "--ignore-config",
    "--no-warnings",
    "--no-colors",
    "--cache-dir",
    tools.ytdlpCache,
    "--socket-timeout",
    "20",
    "--retries",
    "5",
    "--fragment-retries",
    "5",
    "--concurrent-fragments",
    "4",
    "--js-runtimes",
    `node:${process.execPath}`,
  ];
  if (existsSync(tools.ffmpeg)) args.push("--ffmpeg-location", tools.ffmpegDir);
  return args;
}

// ------------------------------------------------------------------ setup & updates

async function versionOf(bin: string): Promise<string | null> {
  try {
    const r = await run(bin, ["--version"], { timeoutMs: 20_000 });
    return r.code === 0 ? r.stdout.trim() : null;
  } catch {
    return null;
  }
}

let toolsReady: Promise<void> | undefined;

/** Makes sure a runnable yt-dlp exists in the user's data folder (newer of bundled and installed). Safe to call often. */
export function ensureTools(): Promise<void> {
  toolsReady ??= setupTools().catch((err) => {
    toolsReady = undefined; // try again next time
    throw err;
  });
  return toolsReady;
}

async function setupTools(): Promise<void> {
  mkdirSync(path.dirname(tools.ytdlp), { recursive: true });
  mkdirSync(tools.ytdlpCache, { recursive: true });
  if (existsSync(tools.bundledYtdlp)) {
    let copy = !existsSync(tools.ytdlp);
    if (!copy) {
      const [installed, bundled] = await Promise.all([versionOf(tools.ytdlp), versionOf(tools.bundledYtdlp)]);
      copy = !installed || (!!bundled && bundled > installed);
    }
    if (copy) {
      copyFileSync(tools.bundledYtdlp, tools.ytdlp);
      if (process.platform !== "win32") chmodSync(tools.ytdlp, 0o755);
    }
  }
  if (process.platform === "darwin") {
    // Files that arrive in a downloaded app carry a "quarantine" flag that would pop up a warning for each tool.
    for (const dir of [path.dirname(tools.ytdlp), tools.ffmpegDir]) {
      await run("/usr/bin/xattr", ["-cr", dir], { timeoutMs: 30_000 }).catch(() => undefined);
    }
  }
}

let cachedVersion: string | undefined;

/** Asking yt-dlp for its version takes a few seconds, so ask once and remember. */
export async function ytdlpVersion(): Promise<string> {
  cachedVersion ??= (await versionOf(tools.ytdlp)) ?? "—";
  return cachedVersion;
}

/** Updates the installed yt-dlp to the latest release. Returns a short message for the user. */
export async function updateYtdlp(): Promise<string> {
  await ensureTools();
  const before = await ytdlpVersion();
  const res = await run(tools.ytdlp, ["--ignore-config", "--no-colors", "-U"], { timeoutMs: 120_000, env: ytEnv() }).catch(() => null);
  cachedVersion = undefined;
  const after = await ytdlpVersion();
  if (!res || res.code !== 0) return `No se pudo actualizar (versión ${before}). Comprueba tu conexión.`;
  return after !== before ? `Actualizado: ${before} → ${after}` : `Ya tienes la última versión (${after}).`;
}

// ------------------------------------------------------------------ reading links

function pickThumb(r: Raw): string | undefined {
  if (typeof r.thumbnail === "string") return r.thumbnail;
  const t = Array.isArray(r.thumbnails) ? r.thumbnails : [];
  const last = t[t.length - 1];
  return typeof last?.url === "string" ? last.url : undefined;
}

export async function inspectWithYtdlp(source: SourceId, url: string, signal?: AbortSignal): Promise<MediaInfo> {
  await ensureTools();
  const res = await run(tools.ytdlp, [...baseArgs(), "-J", "--flat-playlist", "--playlist-end", String(limits.maxItemsPerJob), url], {
    signal,
    timeoutMs: 120_000,
    env: ytEnv(),
  });
  if (res.code !== 0 || !res.stdout.trim()) throw new Error(friendlyError(res.stderr, "No se pudo leer el enlace"));
  const raw = JSON.parse(res.stdout) as Raw;

  if (raw._type === "playlist" || Array.isArray(raw.entries)) {
    const flat: Raw[] = (raw.entries as Raw[]).flatMap((e) => (Array.isArray(e?.entries) ? (e.entries as Raw[]) : [e]));
    const entries: EntryInfo[] = flat
      .filter((e) => e && (e.url || e.webpage_url || e.id))
      .map((e) => ({
        url: String(e.url ?? e.webpage_url ?? e.id),
        title: String(e.title ?? e.id ?? "Sin título"),
        duration: typeof e.duration === "number" ? e.duration : undefined,
        uploader: e.uploader ?? e.channel ?? undefined,
        thumbnail: pickThumb(e),
      }))
      .filter((e) => /^https?:\/\//.test(e.url));
    return {
      source,
      url,
      kind: "collection",
      title: String(raw.title ?? "Colección"),
      uploader: raw.uploader ?? raw.channel ?? undefined,
      thumbnail: pickThumb(raw) ?? entries[0]?.thumbnail,
      count: entries.length,
      entries,
      hasVideo: true,
    };
  }

  const formats: Raw[] = Array.isArray(raw.formats) ? raw.formats : [];
  const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== "none" && typeof f.height === "number");
  const heights = [...new Set(videoFormats.map((f) => f.height as number))].sort((a, b) => b - a);
  const maxFps = Math.max(0, ...videoFormats.map((f) => (typeof f.fps === "number" ? f.fps : 0)));
  const audioOnly = formats
    .filter((f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
    .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));
  const bestAudio = audioOnly[0];

  return {
    source,
    url,
    kind: "single",
    title: String(raw.title ?? "Sin título"),
    uploader: raw.uploader ?? raw.channel ?? undefined,
    thumbnail: pickThumb(raw),
    duration: typeof raw.duration === "number" ? raw.duration : undefined,
    count: 1,
    entries: [
      {
        url,
        title: String(raw.title ?? "Sin título"),
        duration: typeof raw.duration === "number" ? raw.duration : undefined,
        uploader: raw.uploader ?? undefined,
        thumbnail: pickThumb(raw),
      },
    ],
    hasVideo: heights.length > 0,
    video: heights.length ? { heights, maxFps } : undefined,
    audio: bestAudio
      ? {
          ext: String(bestAudio.ext ?? "m4a"),
          abr: typeof bestAudio.abr === "number" ? Math.round(bestAudio.abr) : undefined,
          codec: typeof bestAudio.acodec === "string" ? bestAudio.acodec.split(".")[0] : undefined,
        }
      : undefined,
  };
}

// ------------------------------------------------------------------ downloading

const MEDIA_EXT = new Set([
  "mp4", "mkv", "webm", "mov", "m4v", "mp3", "m4a", "opus", "ogg", "flac", "wav", "aac", "jpg", "jpeg", "png", "webp", "srt", "vtt", "ass",
]);

export function buildArgs(url: string, dir: string, o: DownloadOptions): string[] {
  const args = [
    ...baseArgs(),
    "--newline",
    "--progress",
    "--progress-template",
    "download:PROG %(progress._percent_str)s",
    "-q",
    "--no-playlist",
    "--windows-filenames",
    "--trim-filenames",
    "200",
    "-P",
    dir,
    "-o",
    "%(title)s.%(ext)s",
  ];

  if (o.mode === "audio") {
    const wantsCover = o.embedMetadata !== false;
    if (o.audioFormat === "m4a") args.push("-f", "ba[ext=m4a]/ba/b");
    else args.push("-f", "ba/b");
    args.push("-x");
    if (o.audioFormat === "original") args.push("--audio-format", "best");
    else {
      args.push("--audio-format", o.audioFormat);
      if (o.audioFormat === "mp3") args.push("--audio-quality", "320K");
      else if (o.audioFormat === "m4a") args.push("--audio-quality", "0");
    }
    if (wantsCover) {
      args.push("--embed-metadata");
      if (["mp3", "m4a", "flac", "opus", "original"].includes(o.audioFormat)) {
        args.push("--embed-thumbnail", "--convert-thumbnails", "jpg");
      }
    }
  } else {
    const h = o.height;
    args.push("-f", h ? `bv*[height<=${h}]+ba/b[height<=${h}]` : "bv*+ba/b");
    // Highest resolution first; at equal resolution prefer H.264/AAC so the result fits an MP4 whenever the source allows it.
    if (o.container === "mp4") args.push("-S", "res,vcodec:h264,acodec:aac");
    args.push("--merge-output-format", o.container === "mp4" ? "mp4/mkv" : o.container === "webm" ? "webm/mkv" : "mkv");
    args.push("--embed-metadata", "--embed-chapters");
    if (o.container !== "webm") args.push("--embed-thumbnail", "--convert-thumbnails", "jpg");
    if (o.subtitles) {
      args.push("--write-subs", "--write-auto-subs", "--sub-langs", "es.*,en.*,-live_chat");
      if (o.container !== "webm") args.push("--embed-subs");
    }
  }

  if (o.thumbnail) args.push("--write-thumbnail", "--convert-thumbnails", "jpg");

  if (o.trimStart || o.trimEnd) {
    args.push("--download-sections", `*${o.trimStart ?? "0"}-${o.trimEnd ?? "inf"}`, "--force-keyframes-at-cuts");
  }
  if (o.chapters) {
    args.push("--split-chapters", "-o", "chapter:__chapter__%(section_number)03d - %(section_title)s.%(ext)s");
  }

  args.push(url);
  return args;
}

/** Downloads one URL into `dir` and returns the produced files (absolute paths). */
export async function downloadWithYtdlp(
  url: string,
  dir: string,
  o: DownloadOptions,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<string[]> {
  await ensureTools();
  await mkdir(dir, { recursive: true });
  const res = await run(tools.ytdlp, buildArgs(url, dir, o), {
    signal,
    timeoutMs: 3 * 60 * 60 * 1000,
    env: ytEnv(),
    onStdoutLine: (line) => {
      const m = /PROG\s+([\d.]+)%/.exec(line);
      if (m) onProgress(Math.min(99, Number(m[1])));
    },
  });
  if (res.code !== 0) throw new Error(friendlyError(res.stderr));

  let names = await readdir(dir);
  // Chapter split: keep only chapter files, drop the prefix.
  const chapters = names.filter((n) => n.startsWith("__chapter__"));
  if (chapters.length) {
    for (const n of names) if (!n.startsWith("__chapter__")) await rm(path.join(dir, n), { force: true });
    for (const n of chapters) await rename(path.join(dir, n), path.join(dir, n.replace("__chapter__", "")));
    names = await readdir(dir);
  }
  const files = names
    .filter((n) => MEDIA_EXT.has(n.split(".").pop()!.toLowerCase()) && !n.endsWith(".part"))
    .sort()
    .map((n) => path.join(dir, n));
  // When the user did not ask for a separate thumbnail/subtitle file, ignore leftovers.
  const filtered = files.filter((f) => {
    const ext = f.split(".").pop()!.toLowerCase();
    if (ext === "jpg" || ext === "png" || ext === "webp") return o.thumbnail;
    if (ext === "srt" || ext === "vtt" || ext === "ass") return o.subtitles && o.container === "webm";
    return true;
  });
  if (!filtered.length) throw new Error("No se generó ningún archivo");
  return filtered;
}

/** Flat search on YouTube, used to match Spotify tracks. */
export async function searchYoutube(query: string, n: number, signal?: AbortSignal): Promise<Raw[]> {
  await ensureTools();
  const res = await run(tools.ytdlp, [...baseArgs(), "-J", "--flat-playlist", `ytsearch${n}:${query}`], {
    signal,
    timeoutMs: 60_000,
    env: ytEnv(),
  });
  if (res.code !== 0 || !res.stdout.trim()) throw new Error(friendlyError(res.stderr, "Búsqueda fallida"));
  const raw = JSON.parse(res.stdout) as Raw;
  return Array.isArray(raw.entries) ? (raw.entries as Raw[]) : [];
}
