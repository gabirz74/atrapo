import type { SourceId } from "@shared/types";
export type { SourceId };

const RULES: { id: SourceId; test: (host: string) => boolean }[] = [
  { id: "youtube", test: (h) => is(h, "youtube.com") || h === "youtu.be" || is(h, "youtube-nocookie.com") },
  { id: "spotify", test: (h) => h === "open.spotify.com" },
  { id: "pinterest", test: (h) => /(^|\.)pinterest\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h) || h === "pin.it" },
  { id: "soundcloud", test: (h) => is(h, "soundcloud.com") || h === "on.soundcloud.com" },
  { id: "tiktok", test: (h) => is(h, "tiktok.com") },
  { id: "instagram", test: (h) => is(h, "instagram.com") },
  { id: "twitter", test: (h) => is(h, "twitter.com") || is(h, "x.com") },
  { id: "reddit", test: (h) => is(h, "reddit.com") || h === "redd.it" || h === "v.redd.it" },
  { id: "vimeo", test: (h) => is(h, "vimeo.com") },
  { id: "bandcamp", test: (h) => is(h, "bandcamp.com") },
  { id: "twitch", test: (h) => is(h, "twitch.tv") || h === "clips.twitch.tv" },
  { id: "facebook", test: (h) => is(h, "facebook.com") || h === "fb.watch" },
];

function is(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

export const SOURCE_LABELS: Record<SourceId, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  pinterest: "Pinterest",
  soundcloud: "SoundCloud",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X / Twitter",
  reddit: "Reddit",
  vimeo: "Vimeo",
  bandcamp: "Bandcamp",
  twitch: "Twitch",
  facebook: "Facebook",
};

export interface ParsedUrl {
  source: SourceId;
  url: string;
}

/**
 * Only http(s) URLs whose host is on the allow-list are accepted. This is the SSRF guard:
 * nothing else is ever handed to yt-dlp.
 */
export function parseUrl(raw: string): ParsedUrl | null {
  let text = raw.trim();
  if (!text || text.length > 2048) return null;
  if (!/^https?:\/\//i.test(text)) text = "https://" + text;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "443" && u.port !== "80") return null;
  const host = u.hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":") || host === "localhost") return null;
  const rule = RULES.find((r) => r.test(host));
  if (!rule) return null;
  u.protocol = "https:";
  u.hash = "";
  return { source: rule.id, url: u.toString() };
}

export type SpotifyKind = "track" | "album" | "playlist";

export function parseSpotify(url: string): { kind: SpotifyKind; id: string } | null {
  const m = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist)\/([A-Za-z0-9]{10,30})/.exec(url);
  if (!m) return null;
  return { kind: m[1] as SpotifyKind, id: m[2]! };
}

/** Extract every URL from a pasted block of text (one per line, or separated by spaces). */
export function extractUrls(text: string): string[] {
  const parts = text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return [...new Set(parts)];
}
