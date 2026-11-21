import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { limits } from "./paths";
import { sanitizeName, splitExt, uniqueName } from "./filenames";
import { AbortError } from "./proc";
import type { EntryInfo, MediaInfo } from "./ytdlp";
import { downloadWithYtdlp } from "./ytdlp";

/**
 * Pinterest through the same public JSON endpoints its own website uses, no login needed.
 * Originals only: the `orig` rendition of pictures and the best direct MP4 of videos.
 */

type Raw = Record<string, any>;

const ROOT = "https://www.pinterest.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function headers(): Record<string, string> {
  const csrf = randomBytes(16).toString("hex");
  return {
    "User-Agent": UA,
    Accept: "application/json, text/javascript, */*, q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: ROOT + "/",
    "X-Requested-With": "XMLHttpRequest",
    "X-APP-VERSION": "a89153f",
    "X-Pinterest-AppState": "active",
    "X-Pinterest-PWS-Handler": "www/[username].js",
    "X-CSRFToken": csrf,
    Cookie: `csrftoken=${csrf}`,
  };
}

/** About one request in twenty gets a random 403 or a 5xx from Pinterest's bot protection: retry with growing pauses. */
async function call(resource: string, options: Raw, signal?: AbortSignal): Promise<Raw> {
  const url = `${ROOT}/resource/${resource}Resource/get/?` + new URLSearchParams({ data: JSON.stringify({ options, context: {} }), source_url: "" });
  let lastStatus = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (signal?.aborted) throw new AbortError();
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(8000, 600 * 2 ** attempt)));
    let res: Response;
    try {
      res = await fetch(url, { headers: headers(), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) });
    } catch (err) {
      if (signal?.aborted) throw new AbortError();
      lastStatus = 0; // network hiccup: try again
      continue;
    }
    lastStatus = res.status;
    if (res.status === 404) throw new Error("No se encontró ese contenido de Pinterest (¿es privado o fue borrado?).");
    if (!res.ok) continue;
    try {
      return (await res.json()) as Raw;
    } catch {
      continue;
    }
  }
  throw new Error(lastStatus === 429 ? "Pinterest está limitando las peticiones. Espera unos minutos y reintenta." : "Pinterest no respondió. Inténtalo de nuevo en un momento.");
}

async function* paginate(resource: string, options: Raw, signal?: AbortSignal): AsyncGenerator<Raw> {
  const opts = { ...options };
  for (;;) {
    const data = await call(resource, opts, signal);
    let results = data.resource_response?.data;
    if (results && !Array.isArray(results)) results = results.results;
    for (const r of (results as Raw[] | undefined) ?? []) yield r;
    const bookmarks = data.resource?.options?.bookmarks as string[] | undefined;
    if (!bookmarks?.length || bookmarks[0] === "-end-" || bookmarks[0]!.startsWith("Y2JOb25lO")) return;
    opts.bookmarks = bookmarks;
  }
}

// ------------------------------------------------------------------ resolving the link

type Target =
  | { kind: "pin"; id: string }
  | { kind: "board"; user: string; slug: string }
  | { kind: "section"; user: string; slug: string; section: string }
  | { kind: "profile"; user: string };

async function resolveShort(url: string, signal?: AbortSignal): Promise<string> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const host = new URL(current).hostname;
    if (host !== "pin.it") return current;
    const res = await fetch(current, { redirect: "manual", headers: { "User-Agent": UA }, signal: signal ?? AbortSignal.timeout(20_000) });
    const loc = res.headers.get("location");
    if (!loc) return current;
    current = new URL(loc, current).toString();
  }
  return current;
}

export async function parsePinterest(raw: string, signal?: AbortSignal): Promise<Target> {
  const url = new URL(await resolveShort(raw, signal));
  const parts = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  if (parts[0] === "pin" && parts[1]) return { kind: "pin", id: parts[1].replace(/\D.*$/, "") || parts[1] };
  // Localized hosts sometimes prefix the path with a language ("/es/").
  while (parts[0] && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(parts[0]) && parts.length > 1 && parts[1] !== "pins" && parts[0] !== "pin") parts.shift();
  if (parts.length >= 3) return { kind: "section", user: parts[0]!, slug: parts[1]!, section: parts[2]! };
  if (parts.length === 2 && !["_created", "_saved", "pins"].includes(parts[1]!)) return { kind: "board", user: parts[0]!, slug: parts[1]! };
  if (parts.length >= 1) return { kind: "profile", user: parts[0]! };
  throw new Error("Este enlace de Pinterest no apunta a un pin, tablero o perfil.");
}

// ------------------------------------------------------------------ files of a pin

interface PinFile {
  url: string;
  ext: string;
  hls?: boolean;
}

function extOf(url: string): string {
  const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
  return (m?.[1] ?? "jpg").toLowerCase();
}

function videoFile(video: Raw): PinFile | null {
  const list = (video.video_list ?? {}) as Record<string, Raw>;
  const entries = Object.values(list).filter((v) => typeof v?.url === "string");
  const mp4 = entries.filter((v) => /\.mp4(\?|$)/i.test(v.url)).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  if (mp4) return { url: mp4.url, ext: "mp4" };
  const hls = entries.find((v) => /\.m3u8/i.test(v.url));
  return hls ? { url: hls.url, ext: "mp4", hls: true } : null;
}

function imageFile(images: Raw | undefined): PinFile | null {
  const orig = images?.orig?.url ?? (images ? (Object.values(images)[0] as Raw | undefined)?.url : undefined);
  return typeof orig === "string" ? { url: orig, ext: extOf(orig) } : null;
}

export function filesOfPin(pin: Raw): PinFile[] {
  const files: PinFile[] = [];
  const story = pin.story_pin_data as Raw | undefined;
  if (story?.pages?.length) {
    for (const page of story.pages as Raw[]) {
      for (const block of (page.blocks ?? []) as Raw[]) {
        if (block.video) {
          const v = videoFile(block.video);
          if (v) files.push(v);
        } else if (block.image) {
          const im = block.image?.images?.originals?.url ?? block.image?.images?.orig?.url;
          if (im) files.push({ url: im, ext: extOf(im) });
        }
      }
    }
    if (files.length) return files;
  }
  const slots = pin.carousel_data?.carousel_slots as Raw[] | undefined;
  if (slots?.length) {
    for (const slot of slots) {
      const [size, image] = Object.entries(slot.images ?? {})[0] ?? [];
      const u = (image as Raw | undefined)?.url as string | undefined;
      if (size && u) files.push({ url: u.replace(`/${size}/`, "/originals/"), ext: extOf(u) });
    }
    if (files.length) return files;
  }
  if (pin.videos) {
    const v = videoFile(pin.videos as Raw);
    if (v) return [v];
  }
  const im = imageFile(pin.images as Raw | undefined);
  return im ? [im] : [];
}

const pinTitle = (pin: Raw): string => String(pin.title || pin.grid_title || pin.description || pin.id || "pin").replace(/\s+/g, " ").trim();

// ------------------------------------------------------------------ inspecting

async function boardInfo(t: Extract<Target, { kind: "board" | "section" }>, signal?: AbortSignal): Promise<Raw> {
  const data = await call("Board", { slug: t.slug, username: t.user, field_set_key: "detailed" }, signal);
  const board = data.resource_response?.data as Raw | undefined;
  if (!board?.id) throw new Error("No se encontró ese tablero (¿es privado?).");
  return board;
}

async function sectionId(t: Extract<Target, { kind: "section" }>, signal?: AbortSignal): Promise<{ id: string; title: string }> {
  const data = await call("BoardSection", { board_slug: t.slug, section_slug: t.section, username: t.user }, signal);
  const s = data.resource_response?.data as Raw | undefined;
  if (!s?.id) throw new Error("No se encontró esa sección del tablero.");
  return { id: String(s.id), title: String(s.title ?? t.section) };
}

function pinsOf(target: Target, ids: { boardId?: string; sectionId?: string }, signal?: AbortSignal): AsyncGenerator<Raw> {
  if (target.kind === "board") return paginate("BoardFeed", { board_id: ids.boardId, field_set_key: "react_grid_pin", prepend: false, bookmarks: null }, signal);
  if (target.kind === "section") return paginate("BoardSectionPins", { section_id: ids.sectionId }, signal);
  if (target.kind === "profile")
    return paginate("UserPins", { is_own_profile_pins: false, username: target.user, field_set_key: "grid_item", pin_filter: null }, signal);
  throw new Error("unreachable");
}

const thumbOf = (pin: Raw): string | undefined => pin.images?.["236x"]?.url ?? pin.images?.["474x"]?.url ?? pin.images?.orig?.url;

export async function inspectPinterest(url: string, signal?: AbortSignal): Promise<MediaInfo> {
  const target = await parsePinterest(url, signal);

  if (target.kind === "pin") {
    const data = await call("Pin", { id: target.id, field_set_key: "detailed" }, signal);
    const pin = data.resource_response?.data as Raw | undefined;
    if (!pin?.id) throw new Error("No se encontró ese pin (¿es privado o fue borrado?).");
    const files = filesOfPin(pin);
    if (!files.length) throw new Error("Ese pin no tiene imágenes ni vídeos que descargar.");
    const title = pinTitle(pin).slice(0, 120);
    return {
      source: "pinterest",
      url,
      kind: files.length > 1 ? "collection" : "single",
      title,
      uploader: pin.pinner?.username,
      thumbnail: thumbOf(pin) ?? files[0]!.url,
      count: files.length,
      entries: files.slice(0, 60).map((f, i) => ({ url: f.url, title: `${i + 1}`, thumbnail: f.ext === "mp4" ? thumbOf(pin) : f.url })),
      hasVideo: files.some((f) => f.ext === "mp4"),
    };
  }

  let title = target.kind === "profile" ? `@${target.user}` : "";
  let uploader: string | undefined;
  let total = 0;
  const ids: { boardId?: string; sectionId?: string } = {};
  if (target.kind === "board" || target.kind === "section") {
    const board = await boardInfo(target, signal);
    ids.boardId = String(board.id);
    title = String(board.name ?? target.slug);
    uploader = board.owner?.username ?? target.user;
    total = Number(board.pin_count ?? 0);
    if (target.kind === "section") {
      const s = await sectionId(target, signal);
      ids.sectionId = s.id;
      title = `${title} · ${s.title}`;
      total = 0;
    }
  } else {
    uploader = target.user;
  }

  const entries: EntryInfo[] = [];
  let count = 0;
  let thumb: string | undefined;
  for await (const pin of pinsOf(target, ids, signal)) {
    const files = filesOfPin(pin);
    if (!files.length) continue;
    count += files.length;
    thumb ??= thumbOf(pin);
    if (entries.length < 60) entries.push({ url: files[0]!.url, title: pinTitle(pin), thumbnail: thumbOf(pin) });
    if (entries.length >= 60 && total) break; // enough for the preview when the board announces its size
    if (count >= limits.maxItemsPerJob) break;
  }
  if (!count) throw new Error("No se encontraron imágenes en ese enlace (¿está vacío o es privado?).");
  return {
    source: "pinterest",
    url,
    kind: "collection",
    title: title.slice(0, 120) || "Pinterest",
    uploader,
    thumbnail: thumb,
    count: total && total >= count ? total : count,
    entries,
    hasVideo: false,
  };
}

// ------------------------------------------------------------------ downloading

async function fetchTo(url: string, target: string, signal?: AbortSignal): Promise<number> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: ROOT + "/" },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10 * 60_000)]) : AbortSignal.timeout(10 * 60_000),
  });
  if (!res.ok || !res.body) return res.status;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(target));
  return 200;
}

/**
 * Story-pin pictures are announced as ".jpg" even when the original is a .png or .webp. When the announced address
 * is refused, the same file under the other extensions is tried. Returns the extension that actually worked.
 */
async function saveFile(url: string, base: string, ext: string, signal?: AbortSignal): Promise<string> {
  const tries = [ext, ...["jpg", "png", "webp", "jpeg", "gif"].filter((e) => e !== ext)];
  let status = 0;
  for (const [i, e] of tries.entries()) {
    if (i > 0 && !/i\.pinimg\.com\/originals\//.test(url)) break; // only pictures hosted as originals have this ambiguity
    status = await fetchTo(i === 0 ? url : url.replace(/\.[a-z0-9]+$/i, "." + e), `${base}.${e}`, signal);
    if (status === 200) return e;
    await rm(`${base}.${e}`, { force: true });
    if (status !== 403 && status !== 404) break;
  }
  throw new Error(`HTTP ${status}`);
}

async function mapLimit<T>(list: T[], limit: number, fn: (item: T, i: number) => Promise<void>, signal?: AbortSignal) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        if (signal?.aborted) return;
        const i = next++;
        await fn(list[i]!, i);
      }
    }),
  );
}

/** Downloads every picture/video of a pin, board, section or profile into `dir`. Returns file paths with clean names. */
export async function downloadPinterest(
  url: string,
  dir: string,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
  onFail?: (title: string, error: string) => void,
): Promise<string[]> {
  const target = await parsePinterest(url, signal);
  await mkdir(dir, { recursive: true });

  // 1. Collect every file to fetch, with the name it will get.
  interface Job {
    file: PinFile;
    base: string;
  }
  const jobs: Job[] = [];
  const addPin = (pin: Raw) => {
    const files = filesOfPin(pin);
    const base = sanitizeName(pinTitle(pin), "pin", 150);
    files.forEach((f, i) => jobs.push({ file: f, base: files.length > 1 ? `${base} (${i + 1})` : base }));
  };
  if (target.kind === "pin") {
    const data = await call("Pin", { id: target.id, field_set_key: "detailed" }, signal);
    const pin = data.resource_response?.data as Raw | undefined;
    if (!pin?.id) throw new Error("No se encontró ese pin.");
    addPin(pin);
  } else {
    const ids: { boardId?: string; sectionId?: string } = {};
    if (target.kind === "board" || target.kind === "section") ids.boardId = String((await boardInfo(target, signal)).id);
    if (target.kind === "section") ids.sectionId = (await sectionId(target, signal)).id;
    for await (const pin of pinsOf(target, ids, signal)) {
      addPin(pin);
      if (jobs.length >= limits.maxItemsPerJob) break;
    }
  }
  if (!jobs.length) throw new Error("No se encontró nada que descargar en ese enlace.");

  // 2. Download them in parallel.
  let done = 0;
  const saved = new Map<number, string>(); // job index -> file name on disk
  await mapLimit(
    jobs,
    limits.pinterestConcurrency,
    async (job, i) => {
      const base = path.join(dir, String(i).padStart(5, "0"));
      try {
        if (job.file.hls) {
          const sub = path.join(dir, `hls-${i}`);
          const [out] = await downloadWithYtdlp(
            job.file.url,
            sub,
            { mode: "video", container: "mp4", audioFormat: "original", subtitles: false, thumbnail: false, chapters: false },
            () => undefined,
            signal,
          );
          await rename(out!, `${base}.mp4`);
          await rm(sub, { recursive: true, force: true });
          saved.set(i, `${path.basename(base)}.mp4`);
        } else {
          let ext = "";
          for (let attempt = 0; ; attempt++) {
            try {
              ext = await saveFile(job.file.url, base, job.file.ext, signal);
              break;
            } catch (err) {
              if (signal?.aborted || attempt >= 2) throw err;
              await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
            }
          }
          saved.set(i, `${path.basename(base)}.${ext}`);
        }
      } catch (err) {
        if (signal?.aborted) throw new AbortError();
        onFail?.(job.base, err instanceof Error ? err.message : "Error");
      }
      onProgress(++done, jobs.length);
    },
    signal,
  );
  if (signal?.aborted) throw new AbortError();

  // 3. Give every file its clean final name.
  const used = new Set<string>();
  const out: string[] = [];
  for (const [i, job] of jobs.entries()) {
    const file = saved.get(i);
    if (!file) continue;
    const { ext } = splitExt(file);
    const target = path.join(dir, "out-" + uniqueName(job.base + ext.toLowerCase(), used));
    await rename(path.join(dir, file), target);
    out.push(target);
  }
  if (!out.length) throw new Error("No se pudo descargar nada de Pinterest.");
  return out;
}
