/**
 * Nokiatis Cloud — test harness client for the documented v1.16 contract
 * (NOKIATIS-HANDOVER.md §9.3).
 *
 * Mirrors the production app architecture exactly:
 *  - fetch only, no extra dependencies;
 *  - ONLY the publishable key is used (public by design);
 *  - RLS on public.nokiatis_sync is what protects the data;
 *  - merge is a union by id, never a replace;
 *  - deletions win through tombstones + historyClearedAt;
 *  - snapshotsEqual compares canonically (sorted keys);
 *  - settings are stored with the account but NEVER applied silently.
 */

// ---------------------------------------------------------------------------
// Backend coordinates (publishable key is public by design — handover §9.3)
// ---------------------------------------------------------------------------

export const SB_URL = "https://ttpvquphlurjxwdpsmxo.supabase.co";
export const SB_PUBLISHABLE_KEY =
  "sb_publishable_ryQFjl_Y_g44LDqSJQD6SA_5-HFujVs";

// ---------------------------------------------------------------------------
// Domain model (subset of the v1.16 payload, same shape)
// ---------------------------------------------------------------------------

import type { ListeningEvent, TasteProfile } from "./nokiatis-types";
import { APP_VERSION } from "./nokiatis-types";

export interface Track {
  id: string;
  title: string;
  artist: string;
}

/** playedAt is epoch MILLISECONDS (handover trap list §11). */
export interface HistoryEntry {
  id: string;
  trackId: string;
  playedAt: number;
}

export interface Bookmark {
  trackId: string;
  at: number;
  label: string;
}

export interface Follow {
  artist: string;
  at: number;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  playlistIds: string[];
  updatedAt: number;
}

export interface PortableSettings {
  theme: "liquid-glass" | "classic";
  updatedAt: number;
}

export interface Tombstones {
  unliked: string[];
  unsaved: string[];
  removedDownloads: string[];
  deletedPlaylists: string[];
}

/** Nokiatis Intelligence payload — the cloud "remembers who you are". */
export interface AiPayload {
  events: ListeningEvent[];
  profile: TasteProfile | null;
  updatedAt: number;
}

export interface CloudSnapshot {
  v: 2;
  liked: Track[];
  saved: Track[];
  downloaded: Track[];
  recents: string[];
  history: HistoryEntry[];
  playlists: Playlist[];
  bookmarks: Bookmark[];
  follows: Follow[];
  pins: string[];
  folders: Folder[];
  listenedSeconds: number;
  settings: PortableSettings;
  tombstones: Tombstones;
  historyClearedAt: number | null;
  ai: AiPayload;
}

/** Local device library (harness model of LibraryService state). */
export interface LocalLibrary {
  catalogue: Track[];
  liked: string[];
  saved: string[];
  downloaded: string[];
  recents: string[];
  history: HistoryEntry[];
  playlists: Playlist[];
  bookmarks: Bookmark[];
  follows: Follow[];
  pins: string[];
  folders: Folder[];
  listenedSeconds: number;
  settings: PortableSettings;
  tombstones: Tombstones;
  historyClearedAt: number | null;
  listeningEvents: ListeningEvent[];
  tasteProfile: TasteProfile | null;
}

const HISTORY_CAP = 1200;
const RECENTS_CAP = 20;
const EVENTS_CAP = 800;

export function emptyTombstones(): Tombstones {
  return {
    unliked: [],
    unsaved: [],
    removedDownloads: [],
    deletedPlaylists: [],
  };
}

export function emptyLibrary(): LocalLibrary {
  return {
    catalogue: [],
    liked: [],
    saved: [],
    downloaded: [],
    recents: [],
    history: [],
    playlists: [],
    bookmarks: [],
    follows: [],
    pins: [],
    folders: [],
    listenedSeconds: 0,
    settings: { theme: "liquid-glass", updatedAt: 0 },
    tombstones: emptyTombstones(),
    historyClearedAt: null,
    listeningEvents: [],
    tasteProfile: null,
  };
}

/** PORTABLE_SETTING_KEYS of the harness (mirrors the documented subset). */
export const PORTABLE_SETTING_KEYS = ["theme"] as const;

// ---------------------------------------------------------------------------
// Canonical equality (sorted keys) — handover §9.3 snapshotsEqual
// ---------------------------------------------------------------------------

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(",")}}`;
}

export function snapshotsEqual(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

// ---------------------------------------------------------------------------
// Defensive normalisation of an unknown payload into a CloudSnapshot
// ---------------------------------------------------------------------------

function asTracks(input: unknown): Track[] {
  if (!Array.isArray(input)) return [];
  const out: Track[] = [];
  for (const raw of input) {
    if (typeof raw === "object" && raw !== null) {
      const t = raw as Partial<Track>;
      if (typeof t.id === "string" && typeof t.title === "string") {
        out.push({
          id: t.id,
          title: t.title,
          artist: typeof t.artist === "string" ? t.artist : "",
        });
        continue;
      }
      // The Android app stores compact tracks {i, t, a} in the same row —
      // reading them lets a phone account's cloud show up in the Vault.
      const c = raw as { i?: unknown; t?: unknown; a?: unknown };
      if (typeof c.i === "string" && typeof c.t === "string") {
        out.push({
          id: c.i,
          title: c.t,
          artist: typeof c.a === "string" ? c.a : "",
        });
      }
    }
  }
  return out;
}

/** Track-id list that also accepts the Android app's compact track objects. */
function asTrackIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of input) {
    let id: string | undefined;
    if (typeof x === "string") id = x;
    else if (typeof x === "object" && x !== null) {
      const obj = x as { i?: unknown; id?: unknown };
      if (typeof obj.i === "string") id = obj.i;
      else if (typeof obj.id === "string") id = obj.id;
    }
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function asStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of input) {
    if (typeof x === "string" && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function asHistory(input: unknown): HistoryEntry[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, HistoryEntry>();
  for (const raw of input) {
    if (typeof raw === "object" && raw !== null) {
      const h = raw as Partial<HistoryEntry>;
      if (
        typeof h.id === "string" &&
        typeof h.trackId === "string" &&
        typeof h.playedAt === "number"
      ) {
        if (!byId.has(h.id)) {
          byId.set(h.id, { id: h.id, trackId: h.trackId, playedAt: h.playedAt });
        }
        continue;
      }
      // Android form: { id, at, track: { i, t, a } }
      const c = raw as {
        id?: unknown;
        at?: unknown;
        track?: { i?: unknown } | null;
      };
      if (
        typeof c.id === "string" &&
        typeof c.at === "number" &&
        typeof c.track?.i === "string" &&
        !byId.has(c.id)
      ) {
        byId.set(c.id, { id: c.id, trackId: c.track.i, playedAt: c.at });
      }
    }
  }
  return [...byId.values()];
}

function asPlaylists(input: unknown): Playlist[] {
  if (!Array.isArray(input)) return [];
  const out: Playlist[] = [];
  for (const raw of input) {
    if (typeof raw === "object" && raw !== null) {
      const p = raw as Partial<Playlist>;
      if (
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.updatedAt === "number"
      ) {
        out.push({
          id: p.id,
          name: p.name,
          songIds: asStrings(p.songIds),
          updatedAt: p.updatedAt,
        });
        continue;
      }
      // Android form: { id, name, tracks: [{ i, t, a }, ...], updatedAt? }
      const c = raw as {
        id?: unknown;
        name?: unknown;
        tracks?: unknown;
        updatedAt?: unknown;
      };
      if (typeof c.id === "string" && typeof c.name === "string") {
        out.push({
          id: c.id,
          name: c.name,
          songIds: asTrackIds(c.tracks),
          updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : 0,
        });
      }
    }
  }
  return out;
}

function asFolders(input: unknown): Folder[] {
  const out: Folder[] = [];
  if (Array.isArray(input)) {
    for (const raw of input) {
      if (typeof raw === "object" && raw !== null) {
        const f = raw as Partial<Folder>;
        if (
          typeof f.id === "string" &&
          typeof f.name === "string" &&
          typeof f.updatedAt === "number"
        ) {
          out.push({
            id: f.id,
            name: f.name,
            playlistIds: asStrings(f.playlistIds),
            updatedAt: f.updatedAt,
          });
        }
      }
    }
    return out;
  }
  // Android form: Record<playlistId, folderName>
  if (typeof input === "object" && input !== null) {
    const byName = new Map<string, string[]>();
    for (const [playlistId, name] of Object.entries(
      input as Record<string, unknown>,
    )) {
      if (typeof name === "string" && playlistId) {
        const ids = byName.get(name) ?? [];
        ids.push(playlistId);
        byName.set(name, ids);
      }
    }
    let n = 0;
    for (const [name, playlistIds] of byName) {
      out.push({ id: `folder:${name}`, name, playlistIds, updatedAt: 0 });
      n += 1;
      if (n >= 50) break;
    }
  }
  return out;
}

function asBookmarks(input: unknown): Bookmark[] {
  const out: Bookmark[] = [];
  if (Array.isArray(input)) {
    for (const raw of input) {
      if (typeof raw === "object" && raw !== null) {
        const b = raw as Partial<Bookmark>;
        if (
          typeof b.trackId === "string" &&
          typeof b.at === "number" &&
          typeof b.label === "string"
        ) {
          out.push({ trackId: b.trackId, at: b.at, label: b.label });
        }
      }
    }
    return out;
  }
  // Android form: Record<trackId, { id, seconds, label, createdAt }[]>
  if (typeof input === "object" && input !== null) {
    for (const [trackId, list] of Object.entries(input as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        if (typeof raw === "object" && raw !== null) {
          const b = raw as {
            seconds?: unknown;
            label?: unknown;
            createdAt?: unknown;
          };
          if (
            typeof b.seconds === "number" &&
            typeof b.createdAt === "number"
          ) {
            out.push({
              trackId,
              at: b.createdAt,
              label: typeof b.label === "string" ? b.label : "",
            });
          }
        }
      }
      if (out.length > 500) break;
    }
  }
  return out;
}

function asFollows(input: unknown): Follow[] {
  if (!Array.isArray(input)) return [];
  const out: Follow[] = [];
  for (const raw of input) {
    if (typeof raw === "object" && raw !== null) {
      const f = raw as Partial<Follow>;
      if (typeof f.artist === "string" && typeof f.at === "number") {
        out.push({ artist: f.artist, at: f.at });
        continue;
      }
      // Android form: { key, name, followedAt }
      const c = raw as {
        name?: unknown;
        artist?: unknown;
        followedAt?: unknown;
        at?: unknown;
      };
      if (typeof (c.name ?? c.artist) === "string") {
        out.push({
          artist: (c.name ?? c.artist) as string,
          at:
            typeof c.followedAt === "number"
              ? c.followedAt
              : typeof c.at === "number"
                ? c.at
                : 0,
        });
      }
    }
  }
  return out;
}

function asEvents(input: unknown): ListeningEvent[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, ListeningEvent>();
  for (const raw of input) {
    if (typeof raw === "object" && raw !== null) {
      const e = raw as Partial<ListeningEvent>;
      if (
        typeof e.id === "string" &&
        typeof e.trackId === "string" &&
        typeof e.ts === "number" &&
        typeof e.playedSec === "number"
      ) {
        if (!byId.has(e.id)) {
          byId.set(e.id, {
            id: e.id,
            trackId: e.trackId,
            ts: e.ts,
            playedSec: e.playedSec,
            durationSec: typeof e.durationSec === "number" ? e.durationSec : 0,
            completed: Boolean(e.completed),
            skipped: Boolean(e.skipped),
          });
        }
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, EVENTS_CAP);
}

function asProfile(input: unknown): TasteProfile | null {
  if (typeof input !== "object" || input === null) return null;
  const p = input as Partial<TasteProfile>;
  if (typeof p.updatedAt !== "number" || typeof p.totalPlays !== "number") {
    return null;
  }
  const mapOr = (x: unknown): Record<string, number> => {
    if (typeof x !== "object" || x === null) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  };
  return {
    version: 1,
    updatedAt: p.updatedAt,
    totalPlays: p.totalPlays,
    totalSeconds: typeof p.totalSeconds === "number" ? p.totalSeconds : 0,
    avgCompletion: typeof p.avgCompletion === "number" ? p.avgCompletion : 0,
    likedTracks: typeof p.likedTracks === "number" ? p.likedTracks : 0,
    artistAffinity: mapOr(p.artistAffinity),
    genreAffinity: mapOr(p.genreAffinity),
    trackAffinity: mapOr(p.trackAffinity),
    topHour: typeof p.topHour === "number" ? p.topHour : 21,
    diversity: typeof p.diversity === "number" ? p.diversity : 0,
    exploration: typeof p.exploration === "number" ? p.exploration : 0,
    loyalty: typeof p.loyalty === "number" ? p.loyalty : 0,
    streakDays: typeof p.streakDays === "number" ? p.streakDays : 0,
  };
}

function asAiPayload(input: unknown): AiPayload {
  if (typeof input !== "object" || input === null) {
    return { events: [], profile: null, updatedAt: 0 };
  }
  const raw = input as Record<string, unknown>;
  return {
    events: asEvents(raw.events),
    profile: asProfile(raw.profile),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

export function asSnapshot(input: unknown): CloudSnapshot {
  const raw =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const tRaw =
    typeof raw.tombstones === "object" && raw.tombstones !== null
      ? (raw.tombstones as Record<string, unknown>)
      : {};
  const sRaw =
    typeof raw.settings === "object" && raw.settings !== null
      ? (raw.settings as Record<string, unknown>)
      : {};
  const theme =
    sRaw.theme === "classic" || sRaw.theme === "liquid-glass"
      ? sRaw.theme
      : "liquid-glass";
  return {
    v: 2,
    liked: asTracks(raw.liked),
    saved: asTracks(raw.saved),
    downloaded: asTracks(raw.downloaded),
    recents: asTrackIds(raw.recents).slice(0, RECENTS_CAP),
    history: asHistory(raw.history),
    playlists: asPlaylists(raw.playlists),
    bookmarks: asBookmarks(raw.bookmarks),
    follows: asFollows(raw.follows),
    pins: asTrackIds(raw.pins),
    folders: asFolders(raw.folders),
    listenedSeconds:
      typeof raw.listenedSeconds === "number" ? raw.listenedSeconds : 0,
    settings: {
      theme,
      updatedAt: typeof sRaw.updatedAt === "number" ? sRaw.updatedAt : 0,
    },
    tombstones: {
      // Both key families: the web's (unliked/…) and the Android app's
      // (liked/saved/downloaded/playlists) — they mean the same things.
      unliked: asStrings([...(tRaw.unliked ?? []), ...(tRaw.liked ?? [])]),
      unsaved: asStrings([...(tRaw.unsaved ?? []), ...(tRaw.saved ?? [])]),
      removedDownloads: asStrings([
        ...(tRaw.removedDownloads ?? []),
        ...(tRaw.downloaded ?? []),
      ]),
      deletedPlaylists: asStrings([
        ...(tRaw.deletedPlaylists ?? []),
        ...(tRaw.playlists ?? []),
      ]),
    },
    historyClearedAt:
      typeof raw.historyClearedAt === "number" ? raw.historyClearedAt : null,
    ai: asAiPayload(raw.ai),
  };
}

// ---------------------------------------------------------------------------
// Snapshot builder + merge engine (documented rules, §9.3)
// ---------------------------------------------------------------------------

export function buildSnapshot(lib: LocalLibrary): CloudSnapshot {
  const byId = (id: string): Track | undefined =>
    lib.catalogue.find((t) => t.id === id);
  return {
    v: 2,
    liked: lib.liked.map(byId).filter((t): t is Track => Boolean(t)),
    saved: lib.saved.map(byId).filter((t): t is Track => Boolean(t)),
    downloaded: lib.downloaded.map(byId).filter((t): t is Track => Boolean(t)),
    recents: [...lib.recents].slice(0, RECENTS_CAP),
    history: [...lib.history].slice(0, HISTORY_CAP),
    playlists: lib.playlists.map((p) => ({ ...p, songIds: [...p.songIds] })),
    bookmarks: lib.bookmarks.map((b) => ({ ...b })),
    follows: lib.follows.map((f) => ({ ...f })),
    pins: [...lib.pins],
    folders: lib.folders.map((f) => ({ ...f, playlistIds: [...f.playlistIds] })),
    listenedSeconds: lib.listenedSeconds,
    settings: { ...lib.settings },
    tombstones: {
      unliked: [...lib.tombstones.unliked],
      unsaved: [...lib.tombstones.unsaved],
      removedDownloads: [...lib.tombstones.removedDownloads],
      deletedPlaylists: [...lib.tombstones.deletedPlaylists],
    },
    historyClearedAt: lib.historyClearedAt,
    ai: {
      events: [...lib.listeningEvents]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, EVENTS_CAP),
      profile: lib.tasteProfile ? { ...lib.tasteProfile } : null,
      updatedAt: lib.tasteProfile?.updatedAt ?? 0,
    },
  };
}

function unionTracks(local: Track[], remote: Track[], tomb: Set<string>): Track[] {
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const t of local) {
    if (!tomb.has(t.id) && !seen.has(t.id)) {
      out.push(t);
      seen.add(t.id);
    }
  }
  for (const t of remote) {
    if (!tomb.has(t.id) && !seen.has(t.id)) {
      out.push(t);
      seen.add(t.id);
    }
  }
  return out;
}

function unionStrings(local: string[], remote: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...local, ...remote]) {
    if (!seen.has(s)) {
      out.push(s);
      seen.add(s);
    }
  }
  return out;
}

/** Union by id; songs unioned; metadata from the newer updatedAt. */
function mergePlaylists(local: Playlist[], remote: Playlist[], tomb: Set<string>): Playlist[] {
  const byId = new Map<string, Playlist>();
  for (const p of [...local, ...remote]) {
    if (tomb.has(p.id)) {
      byId.delete(p.id);
      continue;
    }
    const existing = byId.get(p.id);
    if (!existing) {
      byId.set(p.id, { ...p, songIds: [...p.songIds] });
      continue;
    }
    const metaFrom = existing.updatedAt >= p.updatedAt ? existing : p;
    byId.set(p.id, {
      ...metaFrom,
      songIds: unionStrings(existing.songIds, p.songIds),
    });
  }
  return [...byId.values()];
}

function mergeFolders(local: Folder[], remote: Folder[]): Folder[] {
  const byId = new Map<string, Folder>();
  for (const f of [...local, ...remote]) {
    const existing = byId.get(f.id);
    if (!existing) {
      byId.set(f.id, { ...f, playlistIds: [...f.playlistIds] });
      continue;
    }
    const metaFrom = existing.updatedAt >= f.updatedAt ? existing : f;
    byId.set(f.id, {
      ...metaFrom,
      playlistIds: unionStrings(existing.playlistIds, f.playlistIds),
    });
  }
  return [...byId.values()];
}

/** Union by entry id, newest first, cap 1200, honouring historyClearedAt. */
function mergeHistory(
  local: HistoryEntry[],
  remote: HistoryEntry[],
  clearedAt: number | null,
): HistoryEntry[] {
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const h of [...local, ...remote]) {
    if (!seen.has(h.id) && h.playedAt >= (clearedAt ?? 0)) {
      seen.add(h.id);
      out.push(h);
    }
  }
  out.sort((a, b) => b.playedAt - a.playedAt);
  return out.slice(0, HISTORY_CAP);
}

/** Same second on two devices = one moment (union by trackId + at). */
function mergeBookmarks(local: Bookmark[], remote: Bookmark[]): Bookmark[] {
  const key = (b: Bookmark) => `${b.trackId}@${b.at}`;
  const byKey = new Map<string, Bookmark>();
  for (const b of [...local, ...remote]) byKey.set(key(b), b);
  return [...byKey.values()].sort((a, b) => b.at - a.at);
}

/** Union by artist, newest wins. */
function mergeFollows(local: Follow[], remote: Follow[]): Follow[] {
  const byArtist = new Map<string, Follow>();
  for (const f of [...local, ...remote]) {
    const existing = byArtist.get(f.artist);
    if (!existing || f.at > existing.at) byArtist.set(f.artist, f);
  }
  return [...byArtist.values()].sort((a, b) => b.at - a.at);
}

/** Union by event id, newest first, cap 800. Profile: newer updatedAt wins. */
function mergeAi(local: AiPayload, remote: AiPayload): AiPayload {
  const byId = new Map<string, ListeningEvent>();
  for (const e of [...local.events, ...remote.events]) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const events = [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, EVENTS_CAP);
  const profile =
    (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)
      ? remote.profile
      : local.profile;
  return {
    events,
    profile,
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
  };
}

/** The documented merge: union by id, deletions win, never a replace. */
export function mergeSnapshots(local: CloudSnapshot, remote: CloudSnapshot): CloudSnapshot {
  const tombUnliked = new Set([
    ...local.tombstones.unliked,
    ...remote.tombstones.unliked,
  ]);
  const tombUnsaved = new Set([
    ...local.tombstones.unsaved,
    ...remote.tombstones.unsaved,
  ]);
  const tombDownloads = new Set([
    ...local.tombstones.removedDownloads,
    ...remote.tombstones.removedDownloads,
  ]);
  const tombPlaylists = new Set([
    ...local.tombstones.deletedPlaylists,
    ...remote.tombstones.deletedPlaylists,
  ]);
  const clearedAt =
    Math.max(local.historyClearedAt ?? 0, remote.historyClearedAt ?? 0) || null;

  const settingsFrom =
    local.settings.updatedAt >= remote.settings.updatedAt
      ? local.settings
      : remote.settings;

  return {
    v: 2,
    liked: unionTracks(local.liked, remote.liked, tombUnliked),
    saved: unionTracks(local.saved, remote.saved, tombUnsaved),
    downloaded: unionTracks(
      local.downloaded,
      remote.downloaded,
      tombDownloads,
    ),
    recents: unionStrings(local.recents, remote.recents).slice(0, RECENTS_CAP),
    history: mergeHistory(local.history, remote.history, clearedAt),
    playlists: mergePlaylists(local.playlists, remote.playlists, tombPlaylists),
    bookmarks: mergeBookmarks(local.bookmarks, remote.bookmarks),
    follows: mergeFollows(local.follows, remote.follows),
    pins: unionStrings(local.pins, remote.pins),
    folders: mergeFolders(local.folders, remote.folders),
    // listenedSeconds: max
    listenedSeconds: Math.max(
      local.listenedSeconds,
      remote.listenedSeconds,
    ),
    settings: settingsFrom,
    tombstones: {
      unliked: [...tombUnliked],
      unsaved: [...tombUnsaved],
      removedDownloads: [...tombDownloads],
      deletedPlaylists: [...tombPlaylists],
    },
    historyClearedAt: clearedAt,
    ai: mergeAi(local.ai ?? { events: [], profile: null, updatedAt: 0 }, remote.ai ?? { events: [], profile: null, updatedAt: 0 }),
  };
}

/** Apply a merged snapshot to the local library (settings excluded —
 *  adoption is manual by contract; the caller decides). */
export function applyCloudSnapshot(
  lib: LocalLibrary,
  snap: CloudSnapshot,
): LocalLibrary {
  const catalogue = [...lib.catalogue];
  const known = new Set(catalogue.map((t) => t.id));
  for (const t of [...snap.liked, ...snap.saved, ...snap.downloaded]) {
    if (!known.has(t.id)) {
      catalogue.push(t);
      known.add(t.id);
    }
  }
  const historyById = new Map<string, HistoryEntry>();
  for (const h of snap.history) {
    if (!historyById.has(h.id)) historyById.set(h.id, h);
  }
  const idOf = (t: Track) => t.id;
  return {
    catalogue,
    liked: snap.liked.map(idOf),
    saved: snap.saved.map(idOf),
    downloaded: snap.downloaded.map(idOf),
    recents: [...new Set(snap.recents)],
    history: [...historyById.values()],
    playlists: snap.playlists.map((p) => ({ ...p, songIds: [...p.songIds] })),
    bookmarks: snap.bookmarks.map((b) => ({ ...b })),
    follows: snap.follows.map((f) => ({ ...f })),
    pins: [...new Set(snap.pins)],
    folders: snap.folders.map((f) => ({ ...f, playlistIds: [...f.playlistIds] })),
    listenedSeconds: snap.listenedSeconds,
    // device settings are deliberately NOT overwritten (never silently applied)
    settings: lib.settings,
    tombstones: {
      unliked: [...snap.tombstones.unliked],
      unsaved: [...snap.tombstones.unsaved],
      removedDownloads: [...snap.tombstones.removedDownloads],
      deletedPlaylists: [...snap.tombstones.deletedPlaylists],
    },
    historyClearedAt: snap.historyClearedAt,
    listeningEvents: snap.ai.events.slice(0, EVENTS_CAP),
    tasteProfile: snap.ai.profile ? { ...snap.ai.profile } : null,
  };
}

/** PORTABLE keys only — used by the explicit "adopt cloud settings" action. */
export function adoptSettings(
  lib: LocalLibrary,
  snap: CloudSnapshot,
): LocalLibrary {
  const next = { ...lib };
  for (const key of PORTABLE_SETTING_KEYS) {
    if (key in snap.settings) {
      next.settings = {
        ...next.settings,
        [key]: snap.settings[key],
      } as LocalLibrary["settings"];
    }
  }
  next.settings = {
    theme: snap.settings.theme,
    updatedAt: snap.settings.updatedAt,
  };
  return next;
}

// ---------------------------------------------------------------------------
// Session + auth (email + password, autoconfirm ON, refresh rotation)
// ---------------------------------------------------------------------------

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  user_id: string;
  email: string;
}

export class CloudError extends Error {
  status: number;
  hint?: string;
  constructor(message: string, status = 0, hint?: string) {
    super(message);
    this.name = "CloudError";
    this.status = status;
    this.hint = hint;
  }
}

async function sbFetch(
  path: string,
  init: RequestInit,
  bearer: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", SB_PUBLISHABLE_KEY);
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  return fetch(`${SB_URL}${path}`, { ...init, headers });
}

async function readError(res: Response): Promise<CloudError> {
  let message = `${res.status} ${res.statusText}`;
  let hint: string | undefined;
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.msg === "string") message = body.msg;
    if (typeof body.message === "string") message = body.message;
    if (typeof body.hint === "string") hint = body.hint;
    if (typeof body.error_description === "string") message = body.error_description;
    if (body.error instanceof Object && "message" in (body.error as object)) {
      message = String((body.error as Record<string, unknown>).message);
    }
  } catch {
    /* body was not JSON — keep the status text */
  }
  return new CloudError(message, res.status, hint);
}

function toSession(payload: Record<string, unknown>): Session {
  const session = (payload.session ?? payload) as Record<string, unknown>;
  const user = (session.user ?? payload.user ?? {}) as Record<string, unknown>;
  const expiresIn =
    typeof session.expires_in === "number" ? session.expires_in : 3600;
  return {
    access_token: String(session.access_token ?? ""),
    refresh_token: String(session.refresh_token ?? ""),
    expires_at: Date.now() + expiresIn * 1000,
    user_id: String(user.id ?? ""),
    email: String(user.email ?? ""),
  };
}

export async function signUp(
  email: string,
  password: string,
): Promise<Session | null> {
  const res = await sbFetch(
    "/auth/v1/signup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    SB_PUBLISHABLE_KEY,
  );
  if (!res.ok) throw await readError(res);
  const payload = (await res.json()) as Record<string, unknown>;
  // Supabase returns the session FLAT on the top level (and sometimes nested
  // under `session`); autoconfirm ON means a session should be present.
  const hasSession = Boolean(payload.session ?? payload.access_token);
  if (hasSession) return toSession(payload);
  return null;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const res = await sbFetch(
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    SB_PUBLISHABLE_KEY,
  );
  if (!res.ok) throw await readError(res);
  return toSession((await res.json()) as Record<string, unknown>);
}

export async function refreshSession(session: Session): Promise<Session> {
  const res = await sbFetch(
    "/auth/v1/token?grant_type=refresh_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    },
    SB_PUBLISHABLE_KEY,
  );
  if (!res.ok) throw await readError(res);
  return toSession((await res.json()) as Record<string, unknown>);
}

/** Refresh 90 s before expiry (documented behaviour). */
export async function ensureFresh(session: Session): Promise<Session> {
  if (session.expires_at - 90_000 > Date.now()) return session;
  return refreshSession(session);
}

export async function signOut(session: Session): Promise<void> {
  const res = await sbFetch(
    "/auth/v1/logout",
    { method: "POST" },
    session.access_token,
  );
  if (!res.ok && res.status !== 204) throw await readError(res);
}

export async function changePassword(
  session: Session,
  newPassword: string,
): Promise<void> {
  const res = await sbFetch(
    "/auth/v1/user",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    },
    session.access_token,
  );
  if (!res.ok) throw await readError(res);
}

// ---------------------------------------------------------------------------
// Data access (RLS: own-row only)
// ---------------------------------------------------------------------------

export interface SyncRow {
  user_id: string;
  payload: unknown;
  revision: number;
  app_version: string | null;
  device_label: string | null;
  updated_at: string;
}

export async function fetchRow(session: Session): Promise<SyncRow | null> {
  const res = await sbFetch(
    "/rest/v1/nokiatis_sync?select=user_id,payload,revision,app_version,device_label,updated_at&limit=1",
    { method: "GET" },
    session.access_token,
  );
  if (!res.ok) throw await readError(res);
  const rows = (await res.json()) as SyncRow[];
  return rows.length > 0 ? rows[0] : null;
}

export async function upsertRow(
  session: Session,
  snapshot: CloudSnapshot,
  deviceLabel: string,
  appVersion: string = APP_VERSION,
): Promise<SyncRow> {
  const res = await sbFetch(
    "/rest/v1/nokiatis_sync?on_conflict=user_id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_id: session.user_id,
        payload: snapshot,
        app_version: appVersion,
        device_label: deviceLabel,
      }),
    },
    session.access_token,
  );
  if (!res.ok) throw await readError(res);
  const rows = (await res.json()) as SyncRow[];
  if (rows.length === 0) throw new CloudError("upsert returned no row");
  return rows[0];
}

export async function deleteRow(session: Session): Promise<void> {
  const res = await sbFetch(
    `/rest/v1/nokiatis_sync?user_id=eq.${encodeURIComponent(session.user_id)}`,
    { method: "DELETE" },
    session.access_token,
  );
  if (!res.ok) throw await readError(res);
}

/** RLS proof: same table, publishable key, NO user session → must be denied. */
export async function rlsProof(): Promise<{
  status: number;
  message: string;
}> {
  const res = await sbFetch(
    "/rest/v1/nokiatis_sync?select=user_id",
    { method: "GET" },
    SB_PUBLISHABLE_KEY,
  );
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.message === "string") message = body.message;
  } catch {
    /* not JSON */
  }
  return { status: res.status, message };
}
