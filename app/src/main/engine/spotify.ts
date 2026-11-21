import { bundledSpotifyKeys, limits } from "./paths";
import { getSettings } from "./settings";
import { ACCEPTABLE, CONFIDENT, matchQueries, pickBest } from "./match";
import { searchYoutube } from "./ytdlp";
import { scrapePlaylist, bigCover } from "./spotify-web";
import type { SpotifyKind } from "./sources";

export interface SpotifyTrack {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  year?: string;
  trackNumber?: number;
  durationMs: number;
  cover?: string;
}

export interface SpotifyCollection {
  kind: SpotifyKind;
  id: string;
  title: string;
  owner?: string;
  cover?: string;
  tracks: SpotifyTrack[];
}

type Raw = Record<string, any>;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/** The user's own keys win over the ones that ship with the app. */
export function spotifyKeys(): { clientId?: string; clientSecret?: string } {
  const s = getSettings();
  if (s.spotifyClientId?.trim() && s.spotifyClientSecret?.trim()) return { clientId: s.spotifyClientId.trim(), clientSecret: s.spotifyClientSecret.trim() };
  return bundledSpotifyKeys();
}

let tokenCache: { key: string; token: string; exp: number } | null = null;

async function apiToken(): Promise<string | null> {
  const { clientId, clientSecret } = spotifyKeys();
  if (!clientId || !clientSecret) return null;
  const key = clientId + ":" + clientSecret;
  if (tokenCache && tokenCache.key === key && tokenCache.exp > Date.now() + 30_000) return tokenCache.token;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(key).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as Raw;
  tokenCache = { key, token: String(j.access_token), exp: Date.now() + Number(j.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

async function api<T = Raw>(token: string, pathOrUrl: string): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `https://api.spotify.com/v1${pathOrUrl}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Spotify API ${res.status}`);
  return (await res.json()) as T;
}

function apiTrack(t: Raw, album?: Raw): SpotifyTrack {
  const alb = album ?? t.album ?? {};
  return {
    id: String(t.id),
    title: String(t.name),
    artists: (t.artists ?? []).map((a: Raw) => String(a.name)),
    album: alb.name ? String(alb.name) : undefined,
    year: typeof alb.release_date === "string" ? alb.release_date.slice(0, 4) : undefined,
    trackNumber: typeof t.track_number === "number" ? t.track_number : undefined,
    durationMs: Number(t.duration_ms ?? 0),
    cover: alb.images?.[0]?.url,
  };
}

// ---------------------------------------------------------------- tracks and albums (official API)

async function fetchViaApi(kind: "track" | "album", id: string, token: string): Promise<SpotifyCollection> {
  if (kind === "track") {
    const tr = apiTrack(await api(token, `/tracks/${id}`));
    return { kind, id, title: tr.title, owner: tr.artists.join(", "), cover: tr.cover, tracks: [tr] };
  }
  const a = await api(token, `/albums/${id}`);
  let items: Raw[] = a.tracks?.items ?? [];
  let next: string | null = a.tracks?.next ?? null;
  while (next && items.length < limits.maxItemsPerJob) {
    const page = await api(token, next);
    items = items.concat(page.items ?? []);
    next = page.next ?? null;
  }
  return {
    kind,
    id,
    title: String(a.name),
    owner: (a.artists ?? []).map((x: Raw) => x.name).join(", "),
    cover: a.images?.[0]?.url,
    tracks: items.map((t) => apiTrack(t, a)),
  };
}

// ---------------------------------------------------------------- public embed page (fallback, up to 100 songs)

async function fetchViaEmbed(kind: SpotifyKind, id: string): Promise<SpotifyCollection> {
  const res = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error("No se pudo leer ese enlace de Spotify (¿es privado?)");
  const html = await res.text();
  const m = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(html);
  if (!m) throw new Error("Spotify cambió su página y no se pudo leer la lista");
  const entity = (JSON.parse(m[1]!) as Raw)?.props?.pageProps?.state?.data?.entity as Raw | undefined;
  if (!entity) throw new Error("Spotify no devolvió datos para este enlace");

  const cover: string | undefined = entity.coverArt?.sources?.[0]?.url ?? entity.visualIdentity?.image?.[0]?.url ?? undefined;

  if (kind === "track") {
    const artists = (entity.artists ?? []).map((a: Raw) => String(a.name));
    const tr: SpotifyTrack = {
      id,
      title: String(entity.title ?? entity.name),
      artists,
      year: typeof entity.releaseDate?.isoString === "string" ? entity.releaseDate.isoString.slice(0, 4) : undefined,
      durationMs: Number(entity.duration ?? 0),
      cover,
    };
    return { kind, id, title: tr.title, owner: artists.join(", "), cover, tracks: [tr] };
  }

  const list: Raw[] = Array.isArray(entity.trackList) ? entity.trackList : [];
  const tracks: SpotifyTrack[] = list
    .filter((t) => typeof t.uri === "string" && t.uri.startsWith("spotify:track:"))
    .slice(0, limits.maxItemsPerJob)
    .map((t, i) => ({
      id: String(t.uri).split(":").pop()!,
      title: String(t.title),
      artists: String(t.subtitle ?? "").split(/,\s*/).filter(Boolean),
      album: kind === "album" ? String(entity.title) : undefined,
      trackNumber: kind === "album" ? i + 1 : undefined,
      durationMs: Number(t.duration ?? 0),
      cover: kind === "album" ? cover : undefined,
    }));
  if (!tracks.length) throw new Error("La lista no tiene canciones accesibles");
  return { kind, id, title: String(entity.title ?? entity.name), owner: entity.subtitle, cover, tracks };
}

/**
 * Songs and albums: official API (best metadata), then the embed page.
 * Playlists: the web player page (no 100-song limit), then the embed page.
 */
export async function fetchSpotify(
  kind: SpotifyKind,
  id: string,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number | null) => void } = {},
): Promise<SpotifyCollection> {
  if (kind !== "playlist") {
    try {
      const token = await apiToken();
      if (token) return await fetchViaApi(kind, id, token);
    } catch {
      /* fall through to the embed page */
    }
    return fetchViaEmbed(kind, id);
  }
  try {
    const p = await scrapePlaylist(id, { signal: opts.signal, max: limits.maxItemsPerJob, onProgress: opts.onProgress });
    return { kind, id, title: p.title, owner: p.owner, cover: p.cover, tracks: p.tracks };
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    try {
      return await fetchViaEmbed(kind, id);
    } catch {
      throw err instanceof Error ? err : new Error("No se pudo leer la playlist");
    }
  }
}

/** Fills in year, album and track number from the official API for a song that came from a playlist page. */
export async function enrichTrack(t: SpotifyTrack): Promise<SpotifyTrack> {
  if (t.year && t.trackNumber) return t;
  try {
    const token = await apiToken();
    if (!token) return t;
    const full = apiTrack(await api(token, `/tracks/${t.id}`));
    return {
      ...t,
      album: full.album ?? t.album,
      year: full.year ?? t.year,
      trackNumber: full.trackNumber ?? t.trackNumber,
      cover: bigCover(full.cover) ?? t.cover,
    };
  } catch {
    return t;
  }
}

// ---------------------------------------------------------------- matching a Spotify track to a YouTube video

export async function matchOnYoutube(track: SpotifyTrack, signal?: AbortSignal): Promise<string | null> {
  let best: { url: string; score: number } | null = null;
  const seen: Raw[] = [];
  for (const q of matchQueries(track)) {
    seen.push(...(await searchYoutube(q, 8, signal)));
    best = pickBest(track, seen);
    if (best && best.score >= CONFIDENT) break; // convincing: no need for a second search
  }
  return best && best.score >= ACCEPTABLE ? best.url : null;
}
