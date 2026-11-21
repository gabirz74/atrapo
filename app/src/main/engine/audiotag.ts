import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tools } from "./paths";
import { run } from "./proc";
import type { SpotifyTrack } from "./spotify";

const COVER_HOSTS = new Set(["i.scdn.co", "mosaic.scdn.co", "image-cdn-ak.spotifycdn.com", "image-cdn-fa.spotifycdn.com"]);

export async function fetchCover(url: string | undefined, dir: string): Promise<string | null> {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !COVER_HOSTS.has(u.hostname)) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const file = path.join(dir, "cover.jpg");
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    return file;
  } catch {
    return null;
  }
}

/** Writes title/artist/album/year/track number and the cover into `file` (in place). */
export async function tagAudio(file: string, t: SpotifyTrack, cover: string | null): Promise<void> {
  const ext = path.extname(file).slice(1).toLowerCase();
  const out = file + ".tagged." + ext;
  const meta: string[] = ["-metadata", `title=${t.title}`, "-metadata", `artist=${t.artists.join(", ")}`];
  if (t.album) meta.push("-metadata", `album=${t.album}`);
  if (t.year) meta.push("-metadata", `date=${t.year}`);
  if (t.trackNumber) meta.push("-metadata", `track=${t.trackNumber}`);

  const canCover = cover && ["mp3", "m4a", "flac"].includes(ext);
  const args = ["-y", "-v", "error", "-i", file];
  if (canCover) args.push("-i", cover!);
  // Keep the artwork yt-dlp may already have embedded when we have no Spotify cover.
  args.push("-map", "0:a", ...(canCover ? ["-map", "1:v"] : ["-map", "0:v?"]), "-c", "copy");
  if (canCover || ["mp3", "m4a", "flac"].includes(ext)) {
    args.push("-disposition:v:0", "attached_pic");
    if (ext === "mp3") args.push("-id3v2_version", "3", "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)");
  }
  args.push("-map_metadata", "-1", ...meta, out);
  const res = await run(tools.ffmpeg, args, { timeoutMs: 120_000 });
  if (res.code !== 0) {
    await rm(out, { force: true });
    return; // tagging is best-effort: the audio file is still valid
  }
  await rename(out, file);
}
