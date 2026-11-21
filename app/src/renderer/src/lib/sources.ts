export const SOURCES = [
  { id: "youtube", label: "YouTube", test: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/ },
  { id: "spotify", label: "Spotify", test: /^open\.spotify\.com$/ },
  { id: "pinterest", label: "Pinterest", test: /(^|\.)pinterest\.[a-z]{2,3}(\.[a-z]{2})?$|^pin\.it$/ },
  { id: "soundcloud", label: "SoundCloud", test: /(^|\.)soundcloud\.com$/ },
  { id: "tiktok", label: "TikTok", test: /(^|\.)tiktok\.com$/ },
  { id: "instagram", label: "Instagram", test: /(^|\.)instagram\.com$/ },
  { id: "twitter", label: "X", test: /(^|\.)(twitter|x)\.com$/ },
  { id: "reddit", label: "Reddit", test: /(^|\.)(reddit\.com|redd\.it)$/ },
  { id: "vimeo", label: "Vimeo", test: /(^|\.)vimeo\.com$/ },
  { id: "bandcamp", label: "Bandcamp", test: /(^|\.)bandcamp\.com$/ },
  { id: "twitch", label: "Twitch", test: /(^|\.)twitch\.tv$/ },
  { id: "facebook", label: "Facebook", test: /(^|\.)(facebook\.com|fb\.watch)$/ },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export const labelOf = (id: string): string => SOURCES.find((s) => s.id === id)?.label ?? "";

export function extractUrls(text: string): string[] {
  const parts = text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

function hostOf(raw: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function detectSource(raw: string | undefined): SourceId | null {
  if (!raw) return null;
  const host = hostOf(raw);
  if (!host || !host.includes(".")) return null;
  return SOURCES.find((s) => s.test.test(host))?.id ?? null;
}

export function formatDuration(sec: number | undefined): string {
  if (!sec || sec < 1) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
