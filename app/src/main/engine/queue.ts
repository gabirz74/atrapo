import { createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { ItemStatus, JobItem, JobState, Options, PreviewEntry, SourceId } from "@shared/types";
import { fetchCover, tagAudio } from "./audiotag";
import { sanitizeName, splitExt, uniqueName } from "./filenames";
import { limits, workDir } from "./paths";
import { AbortError } from "./proc";
import { downloadPinterest, inspectPinterest } from "./pinterest";
import { getSettings, saveSoon, setSettings } from "./settings";
import { enrichTrack, fetchSpotify, matchOnYoutube, type SpotifyCollection, type SpotifyTrack } from "./spotify";
import { parseSpotify, parseUrl } from "./sources";
import { downloadWithYtdlp, inspectWithYtdlp, type DownloadOptions } from "./ytdlp";

interface Record_ {
  state: JobState;
  abort: AbortController;
  dir: string;
}

const jobs = new Map<string, Record_>();
let listener: (() => void) | null = null;
let running = 0;
const waiting: (() => void)[] = [];

export function onJobsChanged(cb: () => void) {
  listener = cb;
}

let pending = false;
function notify() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    listener?.();
  }, 150);
}

/** Active jobs first (newest on top), then the saved history. */
export function listJobs(): JobState[] {
  const live = [...jobs.values()].map((r) => r.state);
  const liveIds = new Set(live.map((j) => j.id));
  const old = getSettings().history.filter((h) => !liveIds.has(h.id));
  return [...live, ...old].filter((j) => j.status !== "cancelled").sort((a, b) => b.createdAt - a.createdAt);
}

export function activeJobCount(): number {
  return [...jobs.values()].filter((r) => !["done", "error", "cancelled"].includes(r.state.status)).length;
}

async function acquire(signal: AbortSignal) {
  if (running < limits.maxConcurrentJobs) {
    running++;
    return;
  }
  await new Promise<void>((res) => waiting.push(res));
  running++;
  if (signal.aborted) throw new AbortError();
}
function release() {
  running--;
  waiting.shift()?.();
}

function remember(state: JobState) {
  const s = getSettings();
  const compact: JobState = { ...state, items: [] };
  const history = [compact, ...s.history.filter((h) => h.id !== state.id)].slice(0, 60);
  setSettings({ history });
  saveSoon();
}

export async function cancelJob(id: string): Promise<void> {
  const r = jobs.get(id);
  if (!r) return;
  r.abort.abort();
  if (!["done", "error", "cancelled"].includes(r.state.status)) {
    r.state.status = "cancelled";
    r.state.message = "Cancelado";
    notify();
  }
}

export async function removeJob(id: string): Promise<void> {
  const r = jobs.get(id);
  if (r) {
    r.abort.abort();
    await rm(r.dir, { recursive: true, force: true }).catch(() => undefined);
    jobs.delete(id);
  }
  const s = getSettings();
  setSettings({ history: s.history.filter((h) => h.id !== id) });
  notify();
}

export function clearFinished() {
  for (const [id, r] of jobs) if (["done", "error", "cancelled"].includes(r.state.status)) jobs.delete(id);
  setSettings({ history: [] });
  notify();
}

export async function stopAll(): Promise<void> {
  for (const r of jobs.values()) r.abort.abort();
  await rm(workDir(), { recursive: true, force: true }).catch(() => undefined);
}

export async function cleanWorkDir() {
  await rm(workDir(), { recursive: true, force: true }).catch(() => undefined);
  await mkdir(workDir(), { recursive: true }).catch(() => undefined);
}

export function createJob(urls: string[], options: Options, title: string): JobState {
  const id = randomBytes(8).toString("hex");
  const first = urls[0] ? parseUrl(urls[0]) : null;
  const sources = new Set(urls.map((u) => parseUrl(u)?.source));
  const state: JobState = {
    id,
    title: title || urls[0] || "Descarga",
    source: sources.size === 1 && first ? first.source : "mixed",
    status: "queued",
    message: "En cola…",
    progress: 0,
    items: [],
    failed: [],
    createdAt: Date.now(),
  };
  const record: Record_ = { state, abort: new AbortController(), dir: path.join(workDir(), id) };
  jobs.set(id, record);
  notify();
  void execute(record, urls, options);
  return state;
}

// ------------------------------------------------------------------ pipeline

type Unit =
  | { kind: "ytdlp"; title: string; url: string; source: SourceId }
  | { kind: "spotify"; title: string; track: SpotifyTrack }
  | { kind: "pinterest"; title: string; url: string };

interface Collected {
  path: string;
  name: string;
}

async function mapLimit<T>(list: T[], limit: number, fn: (item: T, i: number) => Promise<void>, signal: AbortSignal) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      if (signal.aborted) return;
      const i = next++;
      await fn(list[i]!, i);
    }
  });
  await Promise.all(workers);
}

function resolveMode(source: SourceId, requested: Options["mode"]): "video" | "audio" {
  if (source === "spotify" || source === "soundcloud" || source === "bandcamp") return "audio";
  return requested === "audio" ? "audio" : "video";
}

/** A Spotify playlist can take several seconds to read; the preview step already did it, so reuse that. */
const spotifyCache = new Map<string, { at: number; value: SpotifyCollection }>();
export function cacheSpotify(key: string, value: SpotifyCollection) {
  spotifyCache.set(key, { at: Date.now(), value });
  if (spotifyCache.size > 20) spotifyCache.delete(spotifyCache.keys().next().value!);
}
export async function spotifyCollection(kind: "track" | "album" | "playlist", id: string, signal?: AbortSignal, onProgress?: (d: number, t: number | null) => void) {
  const key = `${kind}:${id}`;
  const hit = spotifyCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const value = await fetchSpotify(kind, id, { signal, onProgress });
  cacheSpotify(key, value);
  return value;
}

async function execute(r: Record_, rawUrls: string[], options: Options) {
  const job = r.state;
  const signal = r.abort.signal;
  const emit = notify;
  try {
    await acquire(signal);
    if (signal.aborted) throw new AbortError();
    job.status = "preparing";
    job.message = "Leyendo enlaces…";
    emit();
    await mkdir(r.dir, { recursive: true });

    // 1. Expand every URL into work units.
    const units: Unit[] = [];
    let collectionTitle: string | undefined;
    for (const raw of rawUrls) {
      const parsed = parseUrl(raw);
      if (!parsed) throw new Error("Enlace no compatible: " + raw.slice(0, 80));
      if (parsed.source === "spotify") {
        const sp = parseSpotify(parsed.url);
        if (!sp) throw new Error("Enlace de Spotify no válido");
        const col = await spotifyCollection(sp.kind, sp.id, signal, (d, t) => {
          job.message = t ? `Leyendo la playlist… ${d}/${t}` : `Leyendo la playlist… ${d}`;
          emit();
        });
        if (rawUrls.length === 1 && col.tracks.length > 1) collectionTitle = col.title;
        for (const t of col.tracks) units.push({ kind: "spotify", title: `${t.artists.join(", ")} - ${t.title}`, track: t });
      } else if (parsed.source === "pinterest") {
        const info = await inspectPinterest(parsed.url, signal);
        if (rawUrls.length === 1) collectionTitle = info.count > 1 ? info.title : undefined;
        units.push({ kind: "pinterest", title: info.title, url: parsed.url });
      } else {
        const info = await inspectWithYtdlp(parsed.source, parsed.url, signal);
        if (rawUrls.length === 1 && info.kind === "collection") collectionTitle = info.title;
        for (const e of info.entries) units.push({ kind: "ytdlp", title: e.title, url: e.url, source: parsed.source });
      }
    }
    if (units.length > limits.maxItemsPerJob) units.length = limits.maxItemsPerJob;
    if (!units.length) throw new Error("No se encontró nada que descargar");

    job.items = units.map<JobItem>((u) => ({ title: u.title, status: "queued", progress: 0 }));
    job.status = "running";
    job.message = `Descargando ${units.length} ${units.length === 1 ? "elemento" : "elementos"}…`;
    emit();

    // 2. Download.
    const collected: Collected[] = [];
    const used = new Set<string>();
    const recompute = () => {
      const total = job.items.length || 1;
      let sum = 0;
      for (const it of job.items) sum += it.status === "done" || it.status === "failed" ? 100 : it.progress;
      job.progress = Math.round(sum / total);
      emit();
    };

    await mapLimit(
      units,
      units.some((u) => u.kind === "pinterest") ? 1 : limits.itemConcurrency,
      async (unit, i) => {
        const item = job.items[i]!;
        const itemDir = path.join(r.dir, String(i));
        try {
          const files = await runUnit(
            unit,
            itemDir,
            options,
            signal,
            (status, pct) => {
              item.status = status;
              if (pct !== undefined) item.progress = Math.max(item.progress, pct);
              recompute();
            },
            (title, error) => job.failed.push({ title, error }),
          );
          for (const f of files) collected.push({ path: f, name: uniqueName(path.basename(f).replace(/^out-/, ""), used) });
          item.status = "done";
          item.progress = 100;
        } catch (err) {
          if (signal.aborted) throw new AbortError();
          item.status = "failed";
          item.error = err instanceof Error ? err.message : "Error desconocido";
          job.failed.push({ title: unit.title, error: item.error });
        }
        recompute();
      },
      signal,
    );
    if (signal.aborted) throw new AbortError();
    if (!collected.length) throw new Error(job.failed[0]?.error ?? "No se pudo descargar ningún archivo");

    // 3. Save into the user's folder: one file stays a file; several become a zip (or a folder, if preferred).
    const out = getSettings().outputDir;
    await mkdir(out, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", ".");
    const collName = sanitizeName(collectionTitle ?? `Atrapo ${stamp}`, "Atrapo");
    if (collected.length === 1 && !job.failed.length) {
      const only = collected[0]!;
      const target = freeName(out, only.name);
      await moveFile(only.path, target);
      job.result = { path: target, name: path.basename(target), size: (await stat(target)).size, kind: "file" };
    } else if (getSettings().collectionsAs === "folder") {
      const folder = freeName(out, collName);
      await mkdir(folder, { recursive: true });
      for (const f of collected) await moveFile(f.path, path.join(folder, f.name));
      if (job.failed.length) await writeFile(path.join(folder, "_no-descargados.txt"), failureReport(job.failed));
      job.result = { path: folder, name: path.basename(folder), size: await folderSize(folder), kind: "folder" };
    } else {
      job.status = "zipping";
      job.message = "Creando el .zip…";
      emit();
      const zipTarget = freeName(out, collName + ".zip");
      await zip(collected, zipTarget, job.failed, signal);
      job.result = { path: zipTarget, name: path.basename(zipTarget), size: (await stat(zipTarget)).size, kind: "zip" };
    }

    job.status = "done";
    job.progress = 100;
    job.message = job.failed.length ? `Listo, con ${job.failed.length} fallo(s)` : "Listo";
    emit();
    remember(job);
  } catch (err) {
    if (err instanceof AbortError || signal.aborted) {
      job.status = "cancelled";
      job.message = "Cancelado";
    } else {
      job.status = "error";
      job.message = err instanceof Error ? err.message : "Error inesperado";
      remember(job);
    }
    emit();
  } finally {
    await rm(r.dir, { recursive: true, force: true }).catch(() => undefined);
    if (job.status === "cancelled") jobs.delete(job.id);
    release();
    emit();
  }
}

/** Errors that retrying cannot fix: the content itself is the problem, not the connection. */
const PERMANENT = /privado|no está disponible|no es compatible|coincidencia fiable|Cancelado|no se encontr/i;

/** YouTube and friends refuse an odd request now and then; trying again a moment later almost always works. */
async function withRetry<T>(fn: () => Promise<T>, signal: AbortSignal, onRetry: () => Promise<void>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (signal.aborted || i >= attempts || PERMANENT.test(err instanceof Error ? err.message : "")) throw err;
      await new Promise((r) => setTimeout(r, 2500 * i));
      if (signal.aborted) throw err;
      await onRetry();
    }
  }
}

async function runUnit(
  unit: Unit,
  dir: string,
  options: Options,
  signal: AbortSignal,
  set: (status: ItemStatus, pct?: number) => void,
  fail: (title: string, error: string) => void,
): Promise<string[]> {
  if (unit.kind === "pinterest") {
    set("downloading", 1);
    return downloadPinterest(unit.url, dir, (done, total) => set("downloading", Math.round((done / total) * 98)), signal, fail);
  }

  const mode = unit.kind === "spotify" ? "audio" : resolveMode(unit.source, options.mode);
  const dl: DownloadOptions = {
    mode,
    height: options.height,
    container: options.container,
    audioFormat: options.audioFormat,
    subtitles: options.subtitles,
    thumbnail: options.thumbnail,
    chapters: options.chapters,
    trimStart: options.trimStart,
    trimEnd: options.trimEnd,
  };

  const clean = () => rm(dir, { recursive: true, force: true }).then(() => undefined);

  if (unit.kind === "ytdlp") {
    return withRetry(
      async () => {
        set("downloading", 1);
        return downloadWithYtdlp(unit.url, dir, dl, (p) => set(p > 95 ? "converting" : "downloading", p), signal);
      },
      signal,
      clean,
    );
  }

  // Spotify: find the same song on YouTube, download the best audio, then write tags + cover.
  const t = await enrichTrack(unit.track);
  return withRetry(
    async () => {
      set("searching", 2);
      const ytUrl = await matchOnYoutube(t, signal);
      if (!ytUrl) throw new Error("No se encontró una coincidencia fiable de esta canción");
      set("downloading", 5);
      const files = await downloadWithYtdlp(ytUrl, dir, { ...dl, mode: "audio", embedMetadata: !t.cover, thumbnail: false, chapters: false }, (p) => set("downloading", Math.round(5 + p * 0.8)), signal);
      const file = files[0]!;
      set("converting", 90);
      const cover = await fetchCover(t.cover, dir);
      await tagAudio(file, t, cover);
      const ext = splitExt(file).ext || ".mp3";
      const target = path.join(dir, `out-${sanitizeName(`${t.artists.join(", ")} - ${t.title}`, "cancion", 190)}${ext}`);
      await rename(file, target);
      return [target];
    },
    signal,
    clean,
  );
}

// ------------------------------------------------------------------ saving

/** `name` if free in `dir`, otherwise "name (2)", "name (3)"… so nothing the user already has is ever overwritten. */
function freeName(dir: string, name: string): string {
  const { name: base, ext } = splitExt(name);
  let candidate = path.join(dir, name);
  for (let n = 2; existsSync(candidate); n++) candidate = path.join(dir, `${base} (${n})${ext}`);
  return candidate;
}

/** rename() fails across drives (e.g. temp on C:, downloads on D:), so fall back to copy + delete. */
async function moveFile(from: string, to: string) {
  try {
    await rename(from, to);
  } catch {
    await copyFile(from, to);
    await rm(from, { force: true });
  }
}

async function folderSize(dir: string): Promise<number> {
  let total = 0;
  for (const n of await readdir(dir)) total += (await stat(path.join(dir, n))).size;
  return total;
}

const failureReport = (failed: { title: string; error: string }[]) =>
  "Estas descargas fallaron:\n\n" + failed.map((f) => `- ${f.title}: ${f.error}`).join("\n") + "\n";

function zip(files: Collected[], out: string, failed: { title: string; error: string }[], signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const part = out + ".part";
    const output = createWriteStream(part);
    // Media is already compressed: store, don't deflate.
    const archive = new ZipArchive({ store: true, forceZip64: true });
    const fail = async (e: unknown) => {
      await rm(part, { force: true }).catch(() => undefined);
      reject(e);
    };
    output.on("close", () => {
      if (signal.aborted) return void fail(new AbortError());
      rename(part, out).then(() => resolve(), fail);
    });
    output.on("error", fail);
    archive.on("error", fail);
    signal.addEventListener("abort", () => archive.abort(), { once: true });
    archive.pipe(output);
    for (const f of files) archive.file(f.path, { name: f.name });
    if (failed.length) archive.append(failureReport(failed), { name: "_no-descargados.txt" });
    void archive.finalize();
  });
}

export type { PreviewEntry };
