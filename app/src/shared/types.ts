// Types shared by the main process (engine) and the window (renderer).

export type SourceId =
  | "youtube"
  | "spotify"
  | "pinterest"
  | "soundcloud"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "reddit"
  | "vimeo"
  | "bandcamp"
  | "twitch"
  | "facebook";

export type AudioFormat = "original" | "mp3" | "m4a" | "opus" | "flac" | "wav";
export type Container = "mp4" | "mkv" | "webm";
export type Mode = "video" | "audio";

export interface Options {
  mode: "auto" | Mode;
  height?: number;
  container: Container;
  audioFormat: AudioFormat;
  subtitles: boolean;
  thumbnail: boolean;
  chapters: boolean;
  trimStart?: string;
  trimEnd?: string;
}

export interface PreviewEntry {
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
}

export interface Preview {
  source: SourceId;
  sourceLabel: string;
  url: string;
  kind: "single" | "collection";
  title: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  count: number;
  entries: PreviewEntry[];
  modes: Mode[];
  video?: { heights: number[]; maxFps: number };
  audio?: { ext: string; abr?: number; codec?: string };
  /** Most items a single download will fetch. */
  limit: number;
  /** Set when the source announces more items than could be read (e.g. a Spotify playlist with unavailable songs). */
  partial?: { declared: number; read: number };
}

export type ItemStatus = "queued" | "searching" | "downloading" | "converting" | "done" | "failed";

export interface JobItem {
  title: string;
  status: ItemStatus;
  progress: number;
  error?: string;
}

export type JobStatus = "queued" | "preparing" | "running" | "zipping" | "done" | "error" | "cancelled";

export interface JobResult {
  /** Absolute path of the file, zip or folder that was saved. */
  path: string;
  name: string;
  size: number;
  kind: "file" | "zip" | "folder";
}

export interface JobState {
  id: string;
  title: string;
  source: SourceId | "mixed";
  status: JobStatus;
  message: string;
  progress: number;
  items: JobItem[];
  failed: { title: string; error: string }[];
  result?: JobResult;
  createdAt: number;
}

export type Language = "auto" | "es" | "en";
export type ThemeChoice = "system" | "light" | "dark";

export interface Settings {
  language: Language;
  theme: ThemeChoice;
  outputDir: string;
  /** What to do with playlists, albums and boards: one .zip, or a folder. */
  collectionsAs: "zip" | "folder";
  /** Optional personal Spotify keys; the app ships with its own. */
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  /** Default audio format for Spotify songs. */
  spotifyFormat: AudioFormat;
  history: JobState[];
}

export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
  ytdlpVersion: string;
  spotifyApi: boolean;
  defaultOutputDir: string;
}

export interface UpdateInfo {
  available: boolean;
  version?: string;
  url?: string;
}

export interface AtrapoApi {
  inspect(url: string): Promise<Preview>;
  cancelInspect(): Promise<void>;
  startJob(urls: string[], options: Options, title: string): Promise<{ id: string }>;
  cancelJob(id: string): Promise<void>;
  removeJob(id: string): Promise<void>;
  clearHistory(): Promise<void>;
  listJobs(): Promise<JobState[]>;
  onJobs(cb: (jobs: JobState[]) => void): () => void;
  reveal(id: string): Promise<boolean>;
  openFolder(): Promise<void>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  chooseFolder(): Promise<string | null>;
  readClipboard(): Promise<string>;
  openExternal(url: string): Promise<void>;
  getInfo(): Promise<AppInfo>;
  updateYtdlp(): Promise<string>;
  checkAppUpdate(): Promise<UpdateInfo>;
  setTitleBarTheme(dark: boolean): Promise<void>;
}

declare global {
  interface Window {
    atrapo: AtrapoApi;
  }
}
