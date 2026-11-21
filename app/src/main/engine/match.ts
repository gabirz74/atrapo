// Pure logic for matching a Spotify song to a YouTube video (no Electron imports, so it can be unit tested).

export interface MatchTrack {
  title: string;
  artists: string[];
  album?: string;
  durationMs: number;
}

type Raw = Record<string, any>;

const clean = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const BAD_WORDS = ["live", "cover", "karaoke", "remix", "sped up", "slowed", "reverb", "8d", "instrumental", "nightcore", "tutorial", "reaction", "playing", "set", "mix"];

export function scoreCandidate(track: MatchTrack, c: Raw): number {
  const ctitle = String(c.title ?? "");
  const cchan = String(c.channel ?? c.uploader ?? "");
  const wanted = clean(track.title);
  const orig = (track.title + " " + (track.album ?? "")).toLowerCase();
  let score = 0;

  const dur = typeof c.duration === "number" ? c.duration : undefined;
  if (dur !== undefined && track.durationMs > 0) {
    const d = Math.abs(dur - track.durationMs / 1000);
    score += d <= 3 ? 50 : d <= 8 ? 30 : d <= 15 ? 10 : d > 40 ? -50 : -20;
  }
  const ct = clean(ctitle);
  if (wanted && ct.includes(wanted)) score += 25;
  const firstArtist = clean(track.artists[0] ?? "");
  if (firstArtist && (ct.includes(firstArtist) || clean(cchan).includes(firstArtist))) score += 15;
  if (/ - topic$/i.test(cchan)) score += 25;
  if (/official audio|audio oficial/i.test(ctitle)) score += 8;
  const lower = ` ${ctitle.toLowerCase()} `;
  for (const w of BAD_WORDS) if (lower.includes(` ${w} `) && !` ${orig} `.includes(` ${w} `)) score -= 25;
  if (/lyrics?|letra/i.test(ctitle)) score -= 3;
  // A video far longer than the song is a set or a compilation, whatever its title says.
  if (dur !== undefined && track.durationMs > 0 && dur > track.durationMs / 1000 * 2) score -= 40;
  return score;
}

/** Queries to try, in order. The second only runs when the first one gave nothing convincing. */
export function matchQueries(track: MatchTrack): string[] {
  const artist = track.artists[0] ?? "";
  return [`${artist} ${track.title} audio`.trim(), `${artist} - ${track.title}`.trim()];
}

export const CONFIDENT = 55;
export const ACCEPTABLE = 20;

export function pickBest(track: MatchTrack, results: Raw[]): { url: string; score: number } | null {
  let best: { url: string; score: number } | null = null;
  for (const r of results) {
    const url = String(r.url ?? (r.id ? `https://www.youtube.com/watch?v=${r.id}` : ""));
    if (!/^https:\/\/www\.youtube\.com\/watch\?v=/.test(url)) continue;
    const s = scoreCandidate(track, r);
    if (!best || s > best.score) best = { url, score: s };
  }
  return best;
}
