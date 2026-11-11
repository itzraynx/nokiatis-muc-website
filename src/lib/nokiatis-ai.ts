/**
 * Nokiatis Intelligence — the taste-profile AI engine.
 *
 * Design goals (mirrors what a Spotify-grade recommender does, local-first):
 *  1. Every listening session becomes a compact ListeningEvent.
 *  2. Events are folded into a TasteProfile: per-artist, per-genre and
 *     per-track affinities with exponential recency decay, completion-ratio
 *     weighting, skip penalties and like bonuses.
 *  3. The profile drives five generated smart playlists (daily mix,
 *     discovery, rewind, energy, calm) plus similar-track suggestions.
 *  4. Cold start: with fewer than 5 events the engine falls back to a
 *     balanced "editorial" spread so recommendations feel smart from the
 *     very first session.
 *  5. The profile is small (a few KB) so it rides the existing cloud sync
 *     row and is remembered across devices — "the cloud remembers who you are".
 *
 * Everything is pure and deterministic for a given input + seed.
 */

import type {
  AiEngineStats,
  ArtistInfo,
  ListeningEvent,
  RichTrack,
  SmartPlaylist,
  TasteProfile,
} from "./nokiatis-types";
import { TRACKS, GENRE_PALETTE } from "./nokiatis-data";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) seeded from a string
// ---------------------------------------------------------------------------

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Profile computation
// ---------------------------------------------------------------------------

const HALF_LIFE_DAYS = 14; // a play from 2 weeks ago is worth ~half a fresh one
const EVENT_CAP = 800;

function recencyFactor(ts: number, now: number): number {
  const ageDays = Math.max(0, now - ts) / 86_400_000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Weight of a single event: completion drives everything, skips hurt. */
function eventWeight(e: ListeningEvent, isLiked: boolean, now: number): number {
  const ratio = e.durationSec > 0 ? Math.min(1, e.playedSec / e.durationSec) : 0;
  const completion = ratio * ratio; // exaggerate: finishing a song is a strong signal
  const skipPenalty = e.skipped ? 0.15 : 1;
  const likeBonus = isLiked ? 1.6 : 1;
  const fullBonus = e.completed ? 1.25 : 1;
  return completion * skipPenalty * likeBonus * fullBonus * recencyFactor(e.ts, now);
}

function normaliseMap(map: Map<string, number>): Record<string, number> {
  let max = 0;
  for (const v of map.values()) max = Math.max(max, v);
  const out: Record<string, number> = {};
  for (const [k, v] of map) out[k] = max > 0 ? Math.round((v / max) * 100) : 0;
  return out;
}

function shannonDiversity(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0 || counts.length === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log(p);
    }
  }
  const maxH = Math.log(counts.length);
  return maxH > 0 ? Math.min(1, h / maxH) : 0;
}

export function computeTasteProfile(
  eventsIn: ListeningEvent[],
  likedIds: string[],
  now: number = Date.now(),
): TasteProfile {
  const events = eventsIn.slice(0, EVENT_CAP);
  const liked = new Set(likedIds);

  const artistRaw = new Map<string, number>();
  const genreRaw = new Map<string, number>();
  const trackRaw = new Map<string, number>();
  const hourHist = new Array(24).fill(0);
  const daySet = new Set<string>();
  const firstTimeArtists = new Set<string>();
  const seenArtistsBefore = new Set<string>();

  const eventsAsc = [...events].sort((a, b) => a.ts - b.ts);
  let totalPlays = 0;
  let totalSeconds = 0;
  let completionSum = 0;
  let newArtistPlays = 0;

  const trackMap = new Map(TRACKS.map((t) => [t.id, t]));

  for (const e of eventsAsc) {
    const track = trackMap.get(e.trackId);
    // Cross-platform guard: events can arrive from the Android app (the two
    // clients share one cloud row and the AI block unions across devices).
    // A listen for a song this catalogue does not know carries no artist or
    // genre signal — skip it rather than scoring it as "مجهول".
    if (!track) continue;
    const artistName = track.artist;
    const genre = track.genre;
    const w = eventWeight(e, liked.has(e.trackId), now);

    if (!firstTimeArtists.has(artistName)) {
      if (!seenArtistsBefore.has(artistName)) {
        firstTimeArtists.add(artistName); // first time ever in this event log
        newArtistPlays += 1;
      }
      seenArtistsBefore.add(artistName);
    }

    artistRaw.set(artistName, (artistRaw.get(artistName) ?? 0) + w);
    genreRaw.set(genre, (genreRaw.get(genre) ?? 0) + w);
    trackRaw.set(e.trackId, (trackRaw.get(e.trackId) ?? 0) + w);

    const d = new Date(e.ts);
    hourHist[d.getHours()] += 1;
    daySet.add(d.toISOString().slice(0, 10));

    totalPlays += 1;
    totalSeconds += e.playedSec;
    completionSum += e.durationSec > 0 ? Math.min(1, e.playedSec / e.durationSec) : 0;
  }

  // Streak: consecutive days ending today or yesterday
  const days = [...daySet].sort();
  let streak = 0;
  if (days.length > 0) {
    const today = new Date(now);
    const todayKey = today.toISOString().slice(0, 10);
    const yKey = new Date(now - 86_400_000).toISOString().slice(0, 10);
    let cursor = days[days.length - 1];
    if (cursor === todayKey || cursor === yKey) {
      streak = 1;
      for (let i = days.length - 2; i >= 0; i--) {
        const prev = new Date(cursor);
        prev.setDate(prev.getDate() - 1);
        const prevKey = prev.toISOString().slice(0, 10);
        if (days[i] === prevKey) {
          streak += 1;
          cursor = prevKey;
        } else break;
      }
    }
  }

  // Loyalty: play-share concentration of the top 3 artists
  const artistPlayCounts = [...artistRaw.values()];
  const sorted = [...artistPlayCounts].sort((a, b) => b - a);
  const sum = artistPlayCounts.reduce((a, b) => a + b, 0);
  const top3 = sorted.slice(0, 3).reduce((a, b) => a + b, 0);
  const loyalty = sum > 0 ? Math.min(1, top3 / sum) : 0;

  let topHour = 21;
  let best = -1;
  hourHist.forEach((v, h) => {
    if (v > best) {
      best = v;
      topHour = h;
    }
  });

  return {
    version: 1,
    updatedAt: now,
    totalPlays,
    totalSeconds,
    avgCompletion: totalPlays > 0 ? completionSum / totalPlays : 0,
    likedTracks: liked.size,
    artistAffinity: normaliseMap(artistRaw),
    genreAffinity: normaliseMap(genreRaw),
    trackAffinity: normaliseMap(trackRaw),
    topHour,
    diversity: shannonDiversity([...artistRaw.values()]),
    exploration: totalPlays > 0 ? Math.min(1, newArtistPlays / totalPlays) : 0,
    loyalty,
    streakDays: streak,
  };
}

// ---------------------------------------------------------------------------
// Recommendation scoring
// ---------------------------------------------------------------------------

export interface RecommendOpts {
  mode: "daily" | "discover" | "energy" | "calm" | "rewind";
  seed: string;
  limit: number;
  /** trackId -> epoch ms of its most recent play */
  lastPlayed?: Record<string, number>;
  now?: number;
}

interface TrackScore {
  track: RichTrack;
  score: number;
}

function freshnessOf(
  trackId: string,
  lastPlayed: Record<string, number>,
  now: number,
): number {
  const t = lastPlayed[trackId];
  if (!t) return 1; // never played — maximally fresh
  const ageH = (now - t) / 3_600_000;
  if (ageH >= 168) return 1; // older than a week → fresh again
  if (ageH <= 2) return 0; // played in the last 2 hours → stale
  return (ageH - 2) / 166;
}

function affinityFor(
  track: RichTrack,
  profile: TasteProfile | null,
): { artist: number; genre: number; track: number } {
  if (!profile) return { artist: 0, genre: 0, track: 0 };
  return {
    artist: profile.artistAffinity[track.artist] ?? 0,
    genre: profile.genreAffinity[track.genre] ?? 0,
    track: profile.trackAffinity[track.id] ?? 0,
  };
}

/** Core scorer — see the header comment for the intuition behind each term. */
function scoreTracks(
  tracks: RichTrack[],
  profile: TasteProfile | null,
  opts: RecommendOpts,
): TrackScore[] {
  const now = opts.now ?? Date.now();
  const lastPlayed = opts.lastPlayed ?? {};
  const rand = seededRandom(opts.seed + "|" + opts.mode);
  const warm = (profile?.totalPlays ?? 0) >= 5;

  // Target energy curve per mode (daily wobbles per-seed for variety)
  const targetEnergy =
    opts.mode === "energy"
      ? 0.88
      : opts.mode === "calm"
        ? 0.22
        : opts.mode === "discover"
          ? 0.45 + rand() * 0.3
          : 0.4 + rand() * 0.35;

  const scores: TrackScore[] = tracks.map((track) => {
    const aff = affinityFor(track, profile);
    const fresh = freshnessOf(track.id, lastPlayed, now);
    const energyMatch = 1 - Math.min(1, Math.abs(track.energy - targetEnergy));
    const jitter = rand();
    const affScore = 0.42 * (aff.artist / 100) + 0.22 * (aff.genre / 100) + 0.12 * (aff.track / 100);

    let score: number;
    if (opts.mode === "discover") {
      // Flip the affinity: prefer artists we have NOT worn out, but stay
      // roughly inside the genres the listener already tolerates.
      const novelArtist = 1 - aff.artist / 100;
      const novelGenre = 1 - Math.abs(aff.genre / 100 - 0.45);
      score = 0.35 * novelArtist + 0.25 * novelGenre + 0.2 * jitter + 0.2 * energyMatch;
      // Filter is applied by caller for hard "known artist" exclusion.
    } else if (!warm) {
      // Cold start: balanced editorial spread — every artist equally valid,
      // jitter keeps it lively, freshness and energy still personalise.
      const artistBias = 0.15 + 0.1 * jitter;
      score = artistBias + 0.25 * energyMatch + 0.3 * fresh + 0.3 * jitter;
    } else {
      score = 0.5 * affScore + 0.18 * energyMatch + 0.14 * fresh;
      if (opts.mode === "rewind") {
        // Rewind: ignore freshness, lean hard on affinity + played-before
        score = 0.7 * affScore + 0.1 * energyMatch + 0.2 * (1 - fresh);
      }
      score += (opts.mode === "daily" ? 0.12 : 0.06) * jitter;
    }
    return { track, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

/** Recommend an ordered list of track ids. */
export function recommendTrackIds(
  tracks: RichTrack[],
  profile: TasteProfile | null,
  opts: RecommendOpts,
): string[] {
  let pool = tracks;

  if (opts.mode === "discover" && profile) {
    // Discovery pool: artists below the affinity ceiling (not worn-out),
    // keeping at least 8 candidates even for a very loyal listener.
    const ceiling = 60;
    let filtered = tracks.filter((t) => (profile.artistAffinity[t.artist] ?? 0) < ceiling);
    if (filtered.length < 8) {
      filtered = tracks
        .slice()
        .sort((a, b) => (profile.artistAffinity[a.artist] ?? 0) - (profile.artistAffinity[b.artist] ?? 0))
        .slice(0, Math.max(8, Math.ceil(tracks.length / 3)));
    }
    pool = filtered;
  }

  const scored = scoreTracks(pool, profile, opts);

  // Daily mix: cap 3 tracks per artist so one favorite can't flood the list.
  if (opts.mode === "daily" || opts.mode === "energy" || opts.mode === "calm") {
    const perArtist = new Map<string, number>();
    const picked: string[] = [];
    for (const s of scored) {
      const c = perArtist.get(s.track.artist) ?? 0;
      if (c >= 3) continue;
      perArtist.set(s.track.artist, c + 1);
      picked.push(s.track.id);
      if (picked.length >= opts.limit) break;
    }
    // Top up if the cap starved us
    for (const s of scored) {
      if (picked.length >= opts.limit) break;
      if (!picked.includes(s.track.id)) picked.push(s.track.id);
    }
    return picked;
  }

  return scored.slice(0, opts.limit).map((s) => s.track.id);
}

// ---------------------------------------------------------------------------
// Smart playlists (the "Made for you" row)
// ---------------------------------------------------------------------------

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export function buildSmartPlaylists(
  tracks: RichTrack[],
  profile: TasteProfile | null,
  lastPlayed: Record<string, number>,
  seedSalt = "",
): SmartPlaylist[] {
  const seed = dayKey() + seedSalt;

  const daily = recommendTrackIds(tracks, profile, { mode: "daily", seed, limit: 25, lastPlayed });
  const discover = recommendTrackIds(tracks, profile, { mode: "discover", seed, limit: 15, lastPlayed });
  const rewind = recommendTrackIds(tracks, profile, { mode: "rewind", seed, limit: 15, lastPlayed });
  const energy = recommendTrackIds(tracks, profile, { mode: "energy", seed, limit: 15, lastPlayed });
  const calm = recommendTrackIds(tracks, profile, { mode: "calm", seed, limit: 15, lastPlayed });

  return [
    {
      id: "smart-daily",
      kind: "daily",
      title: "مزيج اليوم",
      subtitle: "قائمة تتجدد كل يوم حسب ذوقك",
      trackIds: daily,
      accent: "#10b981",
      icon: "sparkles",
    },
    {
      id: "smart-discover",
      kind: "discover",
      title: "اكتشاف الأسبوع",
      subtitle: "فنانون لم تسمعهم كثيرًا — قد تعشقهم",
      trackIds: discover,
      accent: "#f59e0b",
      icon: "compass",
    },
    {
      id: "smart-rewind",
      title: "استمع مجددًا",
      subtitle: "أغانيك التي أحببتها أكثر",
      kind: "rewind",
      trackIds: rewind,
      accent: "#f43f5e",
      icon: "rotate-ccw",
    },
    {
      id: "smart-energy",
      kind: "energy",
      title: "طاقة عالية",
      subtitle: "إيقاعات تشحن يومك",
      trackIds: energy,
      accent: "#84cc16",
      icon: "zap",
    },
    {
      id: "smart-calm",
      kind: "calm",
      title: "هدوء",
      subtitle: "للليل الهادئ والتركيز",
      trackIds: calm,
      accent: "#2dd4bf",
      icon: "moon",
    },
  ];
}

/** Similar tracks to a seed track (the "بسبب أنك استمعت إلى..." row). */
export function similarTrackIds(
  track: RichTrack,
  tracks: RichTrack[],
  profile: TasteProfile | null,
  limit = 8,
): string[] {
  const rand = seededRandom("similar:" + track.id);
  const scored = tracks
    .filter((t) => t.id !== track.id)
    .map((t) => {
      let s = 0;
      if (t.artist === track.artist) s += 0.34;
      if (t.genre === track.genre) s += 0.26;
      s += 0.14 * (1 - Math.min(1, Math.abs(t.energy - track.energy)));
      s += 0.08 * (1 - Math.min(1, Math.abs(t.year - track.year) / 10));
      if (profile) s += 0.12 * ((profile.trackAffinity[t.id] ?? 0) / 100);
      s += 0.12 * rand();
      return { id: t.id, s };
    });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.id);
}

// ---------------------------------------------------------------------------
// Stats for the AI hub + the LLM insights prompt
// ---------------------------------------------------------------------------

export function computeStats(
  profile: TasteProfile | null,
  events: ListeningEvent[],
  tracks: RichTrack[],
): AiEngineStats {
  const heard = new Set(events.map((e) => e.trackId));
  const artistsHeard = new Set(
    events.map((e) => tracks.find((t) => t.id === e.trackId)?.artist).filter(Boolean),
  );
  const genresHeard = new Set(
    events.map((e) => tracks.find((t) => t.id === e.trackId)?.genre).filter(Boolean),
  );

  const artistPlays = new Map<string, number>();
  for (const e of events) {
    const t = tracks.find((x) => x.id === e.trackId);
    if (t) artistPlays.set(t.artist, (artistPlays.get(t.artist) ?? 0) + 1);
  }

  const genrePlays = new Map<string, number>();
  for (const e of events) {
    const t = tracks.find((x) => x.id === e.trackId);
    if (t) genrePlays.set(t.genre, (genrePlays.get(t.genre) ?? 0) + 1);
  }

  const topArtists = [...artistPlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, plays]) => ({
      name,
      plays,
      score: profile?.artistAffinity[name] ?? 0,
    }));

  const topGenres = [...genrePlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, plays]) => ({
      name,
      plays,
      score: profile?.genreAffinity[name] ?? 0,
    }));

  const hourLabel = (h: number) => {
    if (h >= 5 && h < 12) return "الصباح";
    if (h >= 12 && h < 17) return "بعد الظهر";
    if (h >= 17 && h < 21) return "المساء";
    return "الليل";
  };

  const completionLabel = ((c: number | null) => {
    const v = c ?? 0;
    if (v >= 0.8) return "تستمع للأغاني حتى النهاية — إشارة ولاء قوية";
    if (v >= 0.55) return "تُكمل معظم الأغاني";
    if (v >= 0.3) return "تتخطى جزءًا من الأغاني";
    return "تتخطى كثيرًا — نرشّح لك أغانيًا أقصر وأسرع";
  })(profile ? profile.avgCompletion : null);

  return {
    totalEvents: events.length,
    tracksHeard: heard.size,
    catalogCoverage: tracks.length > 0 ? heard.size / tracks.length : 0,
    artistsHeard: artistsHeard.size,
    genresHeard: genresHeard.size,
    topArtists,
    topGenres,
    favoriteHourLabel: profile ? hourLabel(profile.topHour) : "—",
    completionLabel,
  };
}

/** Compact JSON payload sent to /api/ai/insights (the LLM writes Arabic text). */
export function insightsRequestPayload(
  profile: TasteProfile | null,
  stats: AiEngineStats,
  tracks: RichTrack[],
  favoriteTrackIds: string[],
): Record<string, unknown> {
  const favoriteTracks = favoriteTrackIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter(Boolean)
    .slice(0, 5)
    .map((t) => ({ title: t!.title, artist: t!.artist, genre: t!.genre }));

  const genreLabels = stats.topGenres.map((g) => g.name);
  const palette = Object.keys(GENRE_PALETTE).slice(0, 8);

  return {
    topArtists: stats.topArtists.map((a) => ({ name: a.name, plays: a.plays, affinity: a.score })),
    topGenres: genreLabels.length > 0 ? genreLabels : palette.slice(0, 2),
    favoriteTracks: favoriteTracks.length > 0 ? favoriteTracks : [],
    stats: {
      totalPlays: profile?.totalPlays ?? 0,
      totalHours: Math.round(((profile?.totalSeconds ?? 0) / 3600) * 10) / 10,
      avgCompletion: profile ? Math.round(profile.avgCompletion * 100) : 0,
      diversity: profile ? Math.round(profile.diversity * 100) : 0,
      exploration: profile ? Math.round(profile.exploration * 100) : 0,
      loyalty: profile ? Math.round(profile.loyalty * 100) : 0,
      streakDays: profile?.streakDays ?? 0,
      favoriteHour: stats.favoriteHourLabel,
      tracksHeard: stats.tracksHeard,
      catalogSize: tracks.length,
    },
  };
}

/** Artist of the week — highest affinity artist with a portrait available. */
export function artistOfTheWeek(
  profile: TasteProfile | null,
  artists: ArtistInfo[],
): ArtistInfo | null {
  if (!profile) return null;
  const ranked = artists
    .map((a) => ({ a, score: profile.artistAffinity[a.name] ?? 0 }))
    .sort((x, y) => y.score - x.score);
  return ranked.length > 0 ? ranked[0].a : null;
}

/** Radar chart data: genre affinity as {genre, score} for recharts. */
export function genreRadarData(profile: TasteProfile | null): { genre: string; score: number }[] {
  if (!profile) return [];
  return Object.entries(profile.genreAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([genre, score]) => ({ genre, score }));
}

/** Trend data for the last 14 days of listening minutes (recharts line). */
export function listeningTrend(
  events: ListeningEvent[],
  days = 14,
): { day: string; minutes: number }[] {
  const now = new Date();
  const buckets: { day: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ day: key.slice(5), minutes: 0 });
  }
  const index = new Map(buckets.map((b) => [b.day, b]));
  for (const e of events) {
    const key = new Date(e.ts).toISOString().slice(0, 10).slice(5);
    const b = index.get(key);
    if (b) b.minutes += e.playedSec / 60;
  }
  return buckets.map((b) => ({ day: b.day, minutes: Math.round(b.minutes) }));
}
