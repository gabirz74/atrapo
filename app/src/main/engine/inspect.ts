import type { Mode, Preview, SourceId } from "@shared/types";
import { limits } from "./paths";
import { inspectPinterest } from "./pinterest";
import { cacheSpotify, spotifyCollection } from "./queue";
import { parseSpotify, parseUrl, SOURCE_LABELS } from "./sources";
import { inspectWithYtdlp, type MediaInfo } from "./ytdlp";

const MODES: Record<SourceId, Mode[]> = {
  youtube: ["video", "audio"],
  spotify: ["audio"],
  pinterest: [],
  soundcloud: ["audio"],
  tiktok: ["video", "audio"],
  instagram: ["video", "audio"],
  twitter: ["video", "audio"],
  reddit: ["video", "audio"],
  vimeo: ["video", "audio"],
  bandcamp: ["audio"],
  twitch: ["video", "audio"],
  facebook: ["video", "audio"],
};

const cache = new Map<string, { at: number; value: Preview }>();

/** What the preview card shows for a pasted link. */
export async function inspect(rawUrl: string, signal?: AbortSignal): Promise<Preview> {
  const parsed = parseUrl(rawUrl);
  if (!parsed) throw new Error("Este enlace todavía no es compatible.");
  const hit = cache.get(parsed.url);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;

  let base: Omit<Preview, "sourceLabel" | "modes" | "limit">;
  if (parsed.source === "spotify") {
    const sp = parseSpotify(parsed.url);
    if (!sp) throw new Error("Enlace de Spotify no válido");
    const col = await spotifyCollection(sp.kind, sp.id, signal);
    if (!col.declared || col.tracks.length >= col.declared) cacheSpotify(`${sp.kind}:${sp.id}`, col);
    base = {
      source: "spotify",
      url: parsed.url,
      kind: col.tracks.length > 1 ? "collection" : "single",
      title: col.title,
      uploader: col.owner,
      thumbnail: col.cover,
      count: col.tracks.length,
      entries: col.tracks.map((t) => ({ title: t.title, uploader: t.artists.join(", "), duration: t.durationMs / 1000, thumbnail: t.cover })),
      audio: { ext: "m4a/opus" },
      partial: col.declared && col.tracks.length < col.declared ? { declared: col.declared, read: col.tracks.length } : undefined,
    };
  } else {
    const info: MediaInfo = parsed.source === "pinterest" ? await inspectPinterest(parsed.url, signal) : await inspectWithYtdlp(parsed.source, parsed.url, signal);
    base = { ...info, entries: info.entries.slice(0, limits.maxItemsPerJob) };
  }
  const value: Preview = { ...base, url: parsed.url, source: parsed.source, sourceLabel: SOURCE_LABELS[parsed.source], modes: MODES[parsed.source], limit: limits.maxItemsPerJob };
  cache.set(parsed.url, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return value;
}
