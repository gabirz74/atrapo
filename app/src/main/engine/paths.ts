import { app } from "electron";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const exe = process.platform === "win32" ? ".exe" : "";

/** Folder with the tools that ship inside the app (yt-dlp, ffmpeg, ffprobe). */
export function binDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(app.getAppPath(), "resources", "bin", `${process.platform}-${process.arch}`);
}

export const tools = {
  get ffmpegDir(): string {
    return binDir();
  },
  get ffmpeg(): string {
    return path.join(binDir(), "ffmpeg" + exe);
  },
  get bundledYtdlp(): string {
    return path.join(binDir(), "yt-dlp" + exe);
  },
  /** yt-dlp lives in the user's data folder so it can update itself (the app folder may be read-only). */
  get ytdlp(): string {
    return path.join(app.getPath("userData"), "bin", "yt-dlp" + exe);
  },
  get ytdlpCache(): string {
    return path.join(app.getPath("userData"), "yt-dlp-cache");
  },
};

export const workDir = (): string => path.join(app.getPath("temp"), "atrapo-jobs");

export const limits = {
  maxItemsPerJob: 1000,
  maxConcurrentJobs: 2,
  itemConcurrency: 4,
  pinterestConcurrency: 4,
};

/** Spotify keys that ship with the app (resources/spotify.json, never committed to git). */
export function bundledSpotifyKeys(): { clientId?: string; clientSecret?: string } {
  const file = app.isPackaged ? path.join(process.resourcesPath, "spotify.json") : path.join(app.getAppPath(), "resources", "spotify.json");
  try {
    if (!existsSync(file)) return {};
    const j = JSON.parse(readFileSync(file, "utf8")) as { clientId?: string; clientSecret?: string };
    return { clientId: j.clientId, clientSecret: j.clientSecret };
  } catch {
    return {};
  }
}
