"use client";

/**
 * Nokiatis MUC — global app context (v1.17.3-beta.1).
 *
 * One provider owns: auth/session, the local-first library, the AI listening
 * profile, the audio player, update notifications and the cloud sync loop.
 * Views consume via `useApp()`. Data is persisted to localStorage on every
 * mutation and mirrored to Nokiatis Cloud (union merge, tombstones) when
 * signed in, with a 2.5 s debounce and loop guards.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { useToast } from "@/hooks/use-toast";
import { audioEngine } from "@/lib/nokiatis-audio";
import { computeTasteProfile, buildSmartPlaylists, computeStats } from "@/lib/nokiatis-ai";
import {
  ARTISTS,
  TRACKS,
  SEED_PLAYLISTS,
  KEYS,
  safeGet,
  safeSet,
  defaultSettings,
  defaultProfile,
  defaultNotifications,
  hashPin,
  uid,
  trackById,
  encodeShareBase64,
  decodeShareBase64,
} from "@/lib/nokiatis-data";
import type {
  AppSettings,
  AiEngineStats,
  GuestBackup,
  ListeningEvent,
  NotificationItem,
  NotificationKind,
  PlayerQueue,
  ProfileIdentity,
  SharedPlaylistPayload,
  SmartPlaylist,
  SyncLogEntry,
  TasteProfile,
  UpdateInfo,
  VaultConfig,
} from "@/lib/nokiatis-types";
import type {
  CloudSnapshot,
  HistoryEntry,
  LocalLibrary,
  Playlist,
  Session,
} from "@/lib/nokiatis-cloud";
import {
  applyCloudSnapshot,
  asSnapshot,
  buildSnapshot,
  ensureFresh,
  fetchRow,
  mergeSnapshots,
  signIn as cloudSignIn,
  signOut as cloudSignOut,
  signUp as cloudSignUp,
  upsertRow,
  CloudError,
} from "@/lib/nokiatis-cloud";
import { APP_VERSION } from "@/lib/nokiatis-types";

// Re-export locally used shape (HistoryEntry already exists in cloud lib).
type HistoryLike = HistoryEntry;

const SESSION_KEY = "nmuc.session.v1";
const SYNC_DEBOUNCE_MS = 2500;
const UPDATE_POLL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Local-first persisted data (mirrored to cloud when signed in)
// ---------------------------------------------------------------------------

export interface LocalData {
  liked: string[];
  saved: string[];
  downloaded: string[];
  recents: string[];
  history: HistoryLike[];
  playlists: Playlist[];
  listenedSeconds: number;
  listeningEvents: ListeningEvent[];
  tasteProfile: TasteProfile | null;
  deletedPlaylists: string[];
  historyClearedAt: number | null;
}

function seedLocalData(): LocalData {
  return {
    liked: [],
    saved: [],
    downloaded: [],
    recents: [],
    history: [],
    playlists: SEED_PLAYLISTS.map((p) => ({ ...p, songIds: [...p.songIds] })),
    listenedSeconds: 0,
    listeningEvents: [],
    tasteProfile: null,
    deletedPlaylists: [],
    historyClearedAt: null,
  };
}

function lean(t: { id: string; title: string; artist: string }) {
  return { id: t.id, title: t.title, artist: t.artist };
}

function libFromData(data: LocalData): LocalLibrary {
  const catalogue = TRACKS.map((t) => lean(t));
  const byId = (id: string) => catalogue.find((t) => t.id === id);
  return {
    catalogue,
    liked: data.liked,
    saved: data.saved,
    downloaded: data.downloaded,
    recents: data.recents,
    history: data.history,
    playlists: data.playlists,
    bookmarks: [],
    follows: [],
    pins: [],
    folders: [],
    listenedSeconds: data.listenedSeconds,
    settings: { theme: "liquid-glass", updatedAt: 0 },
    tombstones: {
      unliked: [],
      unsaved: [],
      removedDownloads: [],
      deletedPlaylists: data.deletedPlaylists,
    },
    historyClearedAt: data.historyClearedAt,
    listeningEvents: data.listeningEvents,
    tasteProfile: data.tasteProfile,
  };
}

function dataFromLib(lib: LocalLibrary): LocalData {
  return {
    liked: lib.liked,
    saved: lib.saved,
    downloaded: lib.downloaded,
    recents: lib.recents,
    history: lib.history,
    playlists: lib.playlists.map((p) => ({ ...p, songIds: [...p.songIds] })),
    listenedSeconds: lib.listenedSeconds,
    listeningEvents: lib.listeningEvents,
    tasteProfile: lib.tasteProfile,
    deletedPlaylists: lib.tombstones.deletedPlaylists,
    historyClearedAt: lib.historyClearedAt,
  };
}

// ---------------------------------------------------------------------------
// View routing
// ---------------------------------------------------------------------------

export type AppView =
  | "home"
  | "library"
  | "playlists"
  | "ai"
  | "history"
  | "vault"
  | "settings"
  | "account"
  | "playlist"
  | "smart"
  | "artist"
  | "shared";

export interface AppUser {
  email: string;
  userId: string;
  guest: boolean;
}

interface PlayerUi {
  currentTrackId: string | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface AppCtxValue {
  version: string;
  stage: "boot" | "gate" | "app";
  user: AppUser | null;

  // library
  data: LocalData;
  likedSet: Set<string>;
  savedSet: Set<string>;
  downloadedSet: Set<string>;
  toggleLike: (trackId: string) => void;
  toggleSaved: (trackId: string) => void;
  toggleDownload: (trackId: string) => void;
  createPlaylist: (name: string, trackIds?: string[]) => void;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addToPlaylist: (playlistId: string, trackIds: string[]) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylist: (playlistId: string, newIds: string[]) => void;
  clearHistory: () => void;

  // AI
  profile: TasteProfile | null;
  smartPlaylists: SmartPlaylist[];
  stats: AiEngineStats;
  lastPlayed: Record<string, number>;
  artists: typeof ARTISTS;
  tracks: typeof TRACKS;

  // player
  player: PlayerUi;
  queue: PlayerQueue | null;
  playTrackIds: (ids: string[], startIndex: number, context: string) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // identity & settings
  identity: ProfileIdentity;
  setIdentity: (patch: Partial<ProfileIdentity>) => void;
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;

  // notifications & updates
  notifications: NotificationItem[];
  unreadCount: number;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  requestNotificationPermission: () => Promise<boolean>;
  updateInfo: { stable: UpdateInfo | null; beta: UpdateInfo | null } | null;
  checkUpdatesNow: () => Promise<void>;

  // sync
  sync: {
    busy: boolean;
    lastSyncAt: number | null;
    error: string | null;
    log: SyncLogEntry[];
    signedIn: boolean;
    guest: boolean;
  };
  doSignIn: (email: string, password: string) => Promise<boolean>;
  doSignUp: (email: string, password: string) => Promise<boolean>;
  continueAsGuest: () => void;
  doSignOut: () => Promise<void>;
  syncNow: () => Promise<void>;

  // vault
  vaultUnlocked: boolean;
  vaultConfig: VaultConfig;
  unlockVault: (secret: string) => Promise<boolean>;
  lockVault: () => void;
  setGuestPin: (pin: string, hint?: string) => void;
  wipeCloudData: () => Promise<void>;
  cloudRaw: CloudSnapshot | null;

  // share
  sharedIncoming: SharedPlaylistPayload | null;
  setSharedIncoming: (p: SharedPlaylistPayload | null) => void;
  importShared: () => void;
  buildShareLink: (playlistId: string) => string;
  shareTarget: ShareTarget | null;
  setShareTarget: (t: ShareTarget | null) => void;
  addToPlaylistTarget: string[] | null;
  openAddToPlaylist: (ids: string[]) => void;
  setAddToPlaylistTarget: (ids: string[] | null) => void;

  // guest backup
  exportBackup: () => GuestBackup;
  importBackup: (json: string) => boolean;

  // navigation
  view: AppView;
  playlistId: string | null;
  smartId: string | null;
  artistId: string | null;
  openPlaylist: (id: string) => void;
  openSmart: (id: string) => void;
  openArtist: (id: string) => void;
  setView: (v: AppView) => void;
}

const Ctx = createContext<AppCtxValue | null>(null);

/** Shape shared with the <ShareDialog/> component. */
export interface ShareTarget {
  title: string;
  subtitle?: string;
  link: string;
  lines: string[];
}

export function useApp(): AppCtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <NokiatisAppProvider>");
  return v;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NokiatisAppProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // -- core state ------------------------------------------------------------
  const [stage, setStage] = useState<"boot" | "gate" | "app">("boot");
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [data, setData] = useState<LocalData>(seedLocalData);
  const [identity, setIdentityState] = useState<ProfileIdentity>(defaultProfile);
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(defaultNotifications);
  const [updateInfo, setUpdateInfo] = useState<{
    stable: UpdateInfo | null;
    beta: UpdateInfo | null;
  } | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultConfig, setVaultConfig] = useState<VaultConfig>({
    enabled: false,
    pinHash: "",
    hint: "",
  });
  const [cloudRaw, setCloudRaw] = useState<CloudSnapshot | null>(null);
  const [sharedIncoming, setSharedIncoming] = useState<SharedPlaylistPayload | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState<string[] | null>(null);

  // -- navigation --------------------------------------------------------------
  const [view, setView] = useState<AppView>("home");
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [smartId, setSmartId] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);

  // -- player ------------------------------------------------------------------
  const [player, setPlayer] = useState<PlayerUi>({
    currentTrackId: null,
    playing: false,
    positionSec: 0,
    durationSec: 0,
    volume: 0.85,
    muted: false,
    shuffle: false,
    repeat: "off",
  });
  const [queue, setQueue] = useState<PlayerQueue | null>(null);

  // -- sync ---------------------------------------------------------------------
  const [syncBusy, setSyncBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);

  // refs that must survive re-renders without triggering them
  const dataRef = useRef(data);
  const sessionRef = useRef<Session | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const queueRef = useRef<PlayerQueue | null>(null);
  const playerRef = useRef(player);
  const settingsRef = useRef(settings);
  const notificationsRef = useRef(notifications);

  dataRef.current = data;
  sessionRef.current = session;
  playerRef.current = player;
  settingsRef.current = settings;
  notificationsRef.current = notifications;

  // -- boot: hydrate persisted state ---------------------------------------------
  useEffect(() => {
    const storedData = safeGet<LocalData | null>(KEYS.guestData, null);
    setData(storedData && Array.isArray(storedData.playlists) ? storedData : seedLocalData());
    setIdentityState(safeGet<ProfileIdentity>(KEYS.profile, defaultProfile()));
    setSettingsState({ ...defaultSettings(), ...safeGet<Partial<AppSettings>>(KEYS.settings, {}) });
    setNotifications(safeGet<NotificationItem[]>(KEYS.notifications, []));
    setVaultConfig(safeGet<VaultConfig>(KEYS.vault, { enabled: false, pinHash: "", hint: "" }));
    setSyncLog(safeGet<SyncLogEntry[]>(KEYS.syncLog, []).slice(0, 20));

    // parse incoming share link (?share=...)
    try {
      const url = new URL(window.location.href);
      const share = url.searchParams.get("share");
      if (share) {
        const decoded = decodeShareBase64(decodeURIComponent(share));
        const json = decoded ? (JSON.parse(decoded) as SharedPlaylistPayload) : null;
        if (json && typeof json.n === "string" && Array.isArray(json.t)) {
          setSharedIncoming(json);
        }
      }
    } catch {
      /* malformed share payload — ignore */
    }

    const storedSession = safeGet<Session | null>(SESSION_KEY, null);
    if (storedSession?.access_token && storedSession.email) {
      // validate silently, then enter the app (or bounce to the gate)
      (async () => {
        try {
          const fresh = await ensureFresh(storedSession);
          await fetchRow(fresh);
          safeSet(SESSION_KEY, fresh);
          sessionRef.current = fresh; // flush immediately so runSync sees it
          setSession(fresh);
          setGuest(false);
          setStage("app");
          void runSyncRef.current();
        } catch {
          setSession(null);
          localStorage.removeItem(SESSION_KEY);
          setStage("gate");
        }
      })();
    } else {
      setStage("gate");
    }
  }, []);

  // -- persistence helpers -------------------------------------------------------
  const pushSyncLog = useCallback((entry: Omit<SyncLogEntry, "id" | "ts">) => {
    setSyncLog((prev) => {
      const next = [
        { ...entry, id: uid("log"), ts: Date.now() },
        ...prev,
      ].slice(0, 20);
      safeSet(KEYS.syncLog, next);
      return next;
    });
  }, []);

  // -- the sync engine --------------------------------------------------------------
  const runSync = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || busyRef.current) return;
    busyRef.current = true;
    setSyncBusy(true);
    const seq = ++seqRef.current;
    try {
      const fresh = await ensureFresh(s);
      if (seqRef.current !== seq) return;
      setSession(fresh);
      safeSet(SESSION_KEY, fresh);

      const row = await fetchRow(fresh);
      if (seqRef.current !== seq) return;

      const remote = row ? asSnapshot(row.payload) : null;
      if (remote) setCloudRaw(remote);

      const localSnap = buildSnapshot(libFromData(dataRef.current));
      const merged = remote ? mergeSnapshots(localSnap, remote) : localSnap;

      // apply the merged snapshot locally
      const applied = applyCloudSnapshot(libFromData(dataRef.current), merged);
      const nextData = dataFromLib(applied);
      setData(nextData);
      dataRef.current = nextData;
      safeSet(KEYS.guestData, nextData);

      // push the merged state up
      const toPush = buildSnapshot(applied);
      await upsertRow(fresh, toPush, "Nokiatis Web Launcher");
      if (seqRef.current !== seq) return;

      setLastSyncAt(Date.now());
      setSyncError(null);
      pushSyncLog({
        dir: "up",
        ok: true,
        summary: `مزامنة: ${nextData.playlists.length} قائمة · ${nextData.liked.length} مفضل · ${nextData.listeningEvents.length} حدث ذكاء`,
      });
    } catch (err) {
      if (err instanceof CloudError && (err.status === 401 || err.status === 403)) {
        setSyncError("انتهت الجلسة السحابية — سجّل الدخول مجددًا");
        pushSyncLog({ dir: "error", ok: false, summary: "401 — انتهت الجلسة" });
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        toast({
          title: "انقطع الاتصال بالسحابة",
          description: "سجّل الدخول من جديد لاستئناف المزامنة.",
          variant: "destructive",
        });
      } else {
        const msg = err instanceof Error ? err.message : "تعذر الاتصال";
        setSyncError(msg);
        pushSyncLog({ dir: "error", ok: false, summary: msg });
      }
    } finally {
      busyRef.current = false;
      setSyncBusy(false);
    }
  }, [pushSyncLog, toast]);

  // debounce binder — kept in a ref so persistData can call it before the
  // scheduler identity changes without stale closures
  const scheduleSyncRef = useRef<() => void>(() => {});
  const runSyncRef = useRef<typeof runSync>(runSync);
  runSyncRef.current = runSync;
  const scheduleSyncBound = useCallback(() => scheduleSyncRef.current(), []);
  // rebind after every runSync identity change
  useEffect(() => {
    scheduleSyncRef.current = () => {
      if (!sessionRef.current) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        void runSync();
      }, SYNC_DEBOUNCE_MS);
    };
  }, [runSync]);

  const persistData2 = useCallback(
    (next: LocalData, skipSync = false) => {
      setData(next);
      dataRef.current = next;
      safeSet(KEYS.guestData, next);
      if (!skipSync && sessionRef.current) scheduleSyncBound();
    },
    [scheduleSyncBound],
  );

  // -- derived AI values ---------------------------------------------------------------
  const likedSet = useMemo(() => new Set(data.liked), [data.liked]);
  const savedSet = useMemo(() => new Set(data.saved), [data.saved]);
  const downloadedSet = useMemo(() => new Set(data.downloaded), [data.downloaded]);

  const lastPlayed = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of data.listeningEvents) {
      const prev = map[e.trackId];
      if (prev === undefined || e.ts > prev) map[e.trackId] = e.ts;
    }
    return map;
  }, [data.listeningEvents]);

  const smartPlaylists = useMemo(
    () => buildSmartPlaylists(TRACKS, data.tasteProfile, lastPlayed),
    [data.tasteProfile, lastPlayed],
  );

  const stats = useMemo(
    () => computeStats(data.tasteProfile, data.listeningEvents, TRACKS),
    [data.tasteProfile, data.listeningEvents],
  );

  // -- library actions -------------------------------------------------------------------
  const toggleLike = useCallback(
    (trackId: string) => {
      const has = dataRef.current.liked.includes(trackId);
      const next: LocalData = {
        ...dataRef.current,
        liked: has
          ? dataRef.current.liked.filter((id) => id !== trackId)
          : [trackId, ...dataRef.current.liked],
      };
      // recompute profile likes influence immediately
      next.tasteProfile = computeTasteProfile(
        next.listeningEvents,
        next.liked,
      );
      persistData2(next);
      toast({
        title: has ? "أُزيلت من المفضلة" : "أُضيفت إلى المفضلة",
        description: trackById(trackId)?.title,
      });
    },
    [persistData2, toast],
  );

  const toggleSaved = useCallback(
    (trackId: string) => {
      const has = dataRef.current.saved.includes(trackId);
      persistData2({
        ...dataRef.current,
        saved: has
          ? dataRef.current.saved.filter((id) => id !== trackId)
          : [trackId, ...dataRef.current.saved],
      });
      toast({ title: has ? "أُزيل من المكتبة المحفوظة" : "حُفظ في المكتبة" });
    },
    [persistData2, toast],
  );

  const toggleDownload = useCallback(
    (trackId: string) => {
      const has = dataRef.current.downloaded.includes(trackId);
      persistData2({
        ...dataRef.current,
        downloaded: has
          ? dataRef.current.downloaded.filter((id) => id !== trackId)
          : [trackId, ...dataRef.current.downloaded],
      });
      toast({
        title: has ? "أُزيل من التنزيلات" : "تم التنزيل (محاكاة)",
        description: trackById(trackId)?.title,
      });
    },
    [persistData2, toast],
  );

  const createPlaylist = useCallback(
    (name: string, trackIds: string[] = []) => {
      const pl: Playlist = {
        id: uid("pl"),
        name: name.trim() || "قائمة جديدة",
        songIds: [...trackIds],
        updatedAt: Date.now(),
      };
      persistData2({ ...dataRef.current, playlists: [pl, ...dataRef.current.playlists] });
      toast({ title: "أُنشئت القائمة", description: pl.name });
    },
    [persistData2, toast],
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      const pl = dataRef.current.playlists.find((p) => p.id === id);
      persistData2({
        ...dataRef.current,
        playlists: dataRef.current.playlists.filter((p) => p.id !== id),
        // tombstone so the deletion wins the union merge
        deletedPlaylists: [...new Set([...dataRef.current.deletedPlaylists, id])],
      });
      if (pl) toast({ title: "حُذفت القائمة", description: pl.name, variant: "destructive" });
      setPlaylistId(null);
    },
    [persistData2, toast],
  );

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      persistData2({
        ...dataRef.current,
        playlists: dataRef.current.playlists.map((p) =>
          p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p,
        ),
      });
    },
    [persistData2],
  );

  const addToPlaylist = useCallback(
    (playlistId: string, trackIds: string[]) => {
      const pl = dataRef.current.playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const merged = [...new Set([...pl.songIds, ...trackIds])];
      persistData2({
        ...dataRef.current,
        playlists: dataRef.current.playlists.map((p) =>
          p.id === playlistId ? { ...p, songIds: merged, updatedAt: Date.now() } : p,
        ),
      });
      toast({
        title: `أُضيفت إلى «${pl.name}»`,
        description: `${trackIds.length} أغنية`,
      });
    },
    [persistData2, toast],
  );

  const removeFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      persistData2({
        ...dataRef.current,
        playlists: dataRef.current.playlists.map((p) =>
          p.id === playlistId
            ? { ...p, songIds: p.songIds.filter((id) => id !== trackId), updatedAt: Date.now() }
            : p,
        ),
      });
    },
    [persistData2],
  );

  const reorderPlaylist = useCallback(
    (playlistId: string, newIds: string[]) => {
      persistData2({
        ...dataRef.current,
        playlists: dataRef.current.playlists.map((p) =>
          p.id === playlistId ? { ...p, songIds: newIds, updatedAt: Date.now() } : p,
        ),
      });
    },
    [persistData2],
  );

  const clearHistory = useCallback(() => {
    persistData2({
      ...dataRef.current,
      history: [],
      recents: [],
      historyClearedAt: Date.now(),
    });
    toast({ title: "سُجل الاستماع", description: "حُذف السجل بالكامل", variant: "destructive" });
  }, [persistData2, toast]);

  // -- listening event recorder ------------------------------------------------------------
  const recordEvent = useCallback(
    (trackId: string, playedSec: number, completed: boolean, skipped: boolean) => {
      if (playedSec < 2) return; // ignore accidental plays
      const track = trackById(trackId);
      if (!track) return;
      const ev: ListeningEvent = {
        id: uid("ev"),
        trackId,
        ts: Date.now(),
        playedSec: Math.round(playedSec),
        durationSec: track.durationSec,
        completed,
        skipped,
      };
      const next: LocalData = {
        ...dataRef.current,
        listeningEvents: [ev, ...dataRef.current.listeningEvents].slice(0, 800),
        listenedSeconds: dataRef.current.listenedSeconds + Math.round(playedSec),
      };
      next.tasteProfile = computeTasteProfile(next.listeningEvents, next.liked);
      persistData2(next);
    },
    [persistData2],
  );

  // -- player -------------------------------------------------------------------------------
  const startTrack = useCallback(
    (trackId: string, q: PlayerQueue | null) => {
      const track = trackById(trackId);
      if (!track) return;

      // close out the previous track's listening event
      const prev = playerRef.current.currentTrackId;
      if (prev && prev !== trackId) {
        recordEvent(prev, audioEngine.position(), false, false);
      }

      // history entry: written at play time, like the Android app
      const he: HistoryLike = { id: uid("h"), trackId, playedAt: Date.now() };
      const nextData: LocalData = {
        ...dataRef.current,
        history: [he, ...dataRef.current.history].slice(0, 1200),
        recents: [trackId, ...dataRef.current.recents.filter((r) => r !== trackId)].slice(0, 20),
      };
      persistData2(nextData);

      if (q) {
        setQueue(q);
        queueRef.current = q;
      }
      setPlayer((p) => ({
        ...p,
        currentTrackId: trackId,
        playing: true,
        positionSec: 0,
        durationSec: track.durationSec,
      }));
      audioEngine.setVolume(playerRef.current.muted ? 0 : playerRef.current.volume);
      void audioEngine.playTrack(track, 0);
    },
    [persistData2, recordEvent],
  );

  const playTrackIds = useCallback(
    (ids: string[], startIndex: number, context: string) => {
      const valid = ids.filter((id) => trackById(id));
      if (valid.length === 0) return;
      const idx = Math.max(0, Math.min(valid.length - 1, startIndex));
      const q: PlayerQueue = { trackIds: valid, index: idx, context };
      startTrack(valid[idx], q);
    },
    [startTrack],
  );

  const advance = useCallback(
    (auto: boolean) => {
      const q = queueRef.current;
      const cur = playerRef.current;
      if (cur.currentTrackId) {
        if (auto) {
          recordEvent(cur.currentTrackId, cur.durationSec, true, false);
        } else {
          recordEvent(cur.currentTrackId, Math.max(audioEngine.position(), 0), false, true);
        }
      }
      if (!q || q.trackIds.length === 0) {
        audioEngine.stop();
        setPlayer((p) => ({ ...p, playing: false, currentTrackId: null, positionSec: 0 }));
        return;
      }
      let nextIdx: number;
      if (cur.repeat === "one" && auto) {
        nextIdx = q.index;
      } else if (cur.shuffle) {
        nextIdx = q.trackIds.length > 1 ? Math.floor(Math.random() * q.trackIds.length) : 0;
        if (q.trackIds[nextIdx] === cur.currentTrackId && q.trackIds.length > 1) {
          nextIdx = (nextIdx + 1) % q.trackIds.length;
        }
      } else {
        nextIdx = q.index + 1;
        if (nextIdx >= q.trackIds.length) {
          if (cur.repeat === "all") nextIdx = 0;
          else {
            audioEngine.stop();
            setPlayer((p) => ({ ...p, playing: false, currentTrackId: null }));
            return;
          }
        }
      }
      const nq: PlayerQueue = { ...q, index: nextIdx };
      setQueue(nq);
      queueRef.current = nq;
      startTrack(q.trackIds[nextIdx], nq);
    },
    [recordEvent, startTrack],
  );

  // natural end-of-track hook from the engine
  useEffect(() => {
    audioEngine.onEnded = () => {
      advance(true);
    };
    return () => {
      audioEngine.onEnded = null;
    };
  }, [advance]);

  // position ticker
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p.playing || !p.currentTrackId) return;
      const pos = audioEngine.position();
      setPlayer((prev) =>
        Math.abs(prev.positionSec - pos) > 0.24 ? { ...prev, positionSec: pos } : prev,
      );
    }, 300);
    return () => clearInterval(t);
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p.currentTrackId) return;
    if (p.playing) {
      void audioEngine.pause();
      setPlayer((prev) => ({ ...prev, playing: false }));
    } else {
      void audioEngine.resume();
      setPlayer((prev) => ({ ...prev, playing: true }));
    }
  }, []);

  const next = useCallback(() => advance(false), [advance]);

  const prev = useCallback(() => {
    const p = playerRef.current;
    if (p.positionSec > 3) {
      void audioEngine.seek(0);
      setPlayer((prev) => ({ ...prev, positionSec: 0 }));
      return;
    }
    const q = queueRef.current;
    if (!q) return;
    const idx = q.index - 1;
    if (idx < 0) {
      void audioEngine.seek(0);
      setPlayer((prev) => ({ ...prev, positionSec: 0 }));
      return;
    }
    const nq: PlayerQueue = { ...q, index: idx };
    setQueue(nq);
    queueRef.current = nq;
    startTrack(q.trackIds[idx], nq);
  }, [startTrack]);

  const seek = useCallback((sec: number) => {
    void audioEngine.seek(sec);
    setPlayer((prev) => ({ ...prev, positionSec: sec }));
  }, []);

  const setVolume = useCallback((v: number) => {
    const vol = Math.max(0, Math.min(1, v));
    audioEngine.setVolume(vol);
    setPlayer((prev) => ({ ...prev, volume: vol, muted: vol === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    const vol = p.muted ? p.volume || 0.85 : 0;
    audioEngine.setVolume(vol);
    setPlayer((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayer((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const cycleRepeat = useCallback(() => {
    setPlayer((prev) => ({
      ...prev,
      repeat: prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  // apply audio settings whenever they change
  useEffect(() => {
    audioEngine.applySettings(settings);
  }, [settings]);

  // -- identity & settings -------------------------------------------------------------
  const setIdentity = useCallback((patch: Partial<ProfileIdentity>) => {
    setIdentityState((prev) => {
      const next = { ...prev, ...patch };
      safeSet(KEYS.profile, next);
      return next;
    });
  }, []);

  const setSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      safeSet(KEYS.settings, next);
      return next;
    });
  }, []);

  // -- notifications ---------------------------------------------------------------------
  const pushNotificationInternal = useCallback((item: NotificationItem) => {
    setNotifications((prev) => {
      const next = [item, ...prev].slice(0, 50);
      safeSet(KEYS.notifications, next);
      return next;
    });
  }, []);

  const browserNotify = useCallback((title: string, body: string) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/logo.svg" });
      }
    } catch {
      /* notification API unavailable */
    }
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      safeSet(KEYS.notifications, next);
      return next;
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      safeSet(KEYS.notifications, next);
      return next;
    });
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    try {
      if (typeof Notification === "undefined") return false;
      const res = await Notification.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }, []);

  // -- update channel checking ------------------------------------------------------------
  const versionGreater = (a: string, b: string): boolean => {
    const parse = (v: string) => v.replace(/[^0-9.]/g, "").split(".").map((x) => parseInt(x, 10) || 0);
    const [av, bv] = [parse(a), parse(b)];
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const x = av[i] ?? 0;
      const y = bv[i] ?? 0;
      if (x !== y) return x > y;
    }
    return false;
  };

  const checkUpdatesNow = useCallback(async () => {
    try {
      const res = await fetch("/api/updates", { cache: "no-store" });
      const body = (await res.json()) as {
        ok: boolean;
        stable: UpdateInfo | null;
        beta: UpdateInfo | null;
      };
      setUpdateInfo({ stable: body.stable, beta: body.beta });
      const s = settingsRef.current;

      const consider = (info: UpdateInfo | null, enabled: boolean, kind: NotificationKind) => {
        if (!info || !enabled) return;
        if (!versionGreater(info.versionName, APP_VERSION)) return;
        const already = notificationsRef.current.some(
          (n) => n.version === info.versionName && n.kind === kind,
        );
        if (already) return;
        const item: NotificationItem = {
          id: uid("nt"),
          ts: Date.now(),
          kind,
          title: `تحديث جديد: ${info.versionName}`,
          body: info.notes || "إصدار جديد من Nokiatis MUC متوفر للتنزيل.",
          read: false,
          version: info.versionName,
        };
        pushNotificationInternal(item);
        browserNotify(item.title, item.body);
      };
      consider(body.beta, s.notifyBeta && s.betaChannelEnabled, "update-beta");
      consider(body.stable, s.notifyUpdates, "update-stable");
    } catch {
      /* offline — next poll retries */
    }
  }, [browserNotify, pushNotificationInternal]);

  // first-launch notification for THIS version + update polling
  useEffect(() => {
    if (stage !== "app") return;
    const seen = safeGet<string>(KEYS.seenVersion, "");
    if (seen !== APP_VERSION) {
      safeSet(KEYS.seenVersion, APP_VERSION);
      const item: NotificationItem = {
        id: uid("nt"),
        ts: Date.now(),
        kind: "info",
        title: "Nokiatis Intelligence وصل",
        body: `الإصدار ${APP_VERSION} — محرك ذوقك الموسيقي الجديد، مشغّل ويب كامل، خزنة سحابية، وإشعارات تحديث. جرّب قسم «الذكاء» الآن.`,
        read: false,
        version: APP_VERSION,
      };
      pushNotificationInternal(item);
      if (settingsRef.current.notifyBeta || settingsRef.current.notifyUpdates) {
        browserNotify("Nokiatis MUC — 1.17.3-beta.1", "وصل التحديث الجديد: الذكاء الموسيقي، الخزنة، والمشغّل الكامل.");
      }
    }
    void checkUpdatesNow();
    const t = setInterval(() => {
      void checkUpdatesNow();
    }, UPDATE_POLL_MS);
    return () => clearInterval(t);
  }, [stage, browserNotify, checkUpdatesNow, pushNotificationInternal]);

  // -- auth ------------------------------------------------------------------------------
  const enterApp = useCallback(
    (s: Session) => {
      sessionRef.current = s; // flush immediately so runSync sees the session
      setSession(s);
      setGuest(false);
      safeSet(SESSION_KEY, s);
      setStage("app");
      void runSync();
    },
    [runSync],
  );

  const doSignIn = useCallback(
    async (email: string, password: string) => {
      try {
        const s = await cloudSignIn(email.trim(), password);
        enterApp(s);
        toast({ title: "أهلًا بك مجددًا", description: "جارٍ مزامنة مكتبتك من Nokiatis Cloud…" });
        return true;
      } catch (err) {
        const msg = err instanceof CloudError ? err.message : "تعذر تسجيل الدخول";
        toast({
          title: "فشل تسجيل الدخول",
          description: msg,
          variant: "destructive",
        });
        return false;
      }
    },
    [enterApp, toast],
  );

  const doSignUp = useCallback(
    async (email: string, password: string) => {
      try {
        const s = await cloudSignUp(email.trim(), password);
        if (!s) {
          toast({ title: "تحقق من بريدك", description: "أُرسل رابط التأكيد إلى بريدك الإلكتروني." });
          return false;
        }
        enterApp(s);
        toast({ title: "أُنشئ حسابك", description: "بدأت مزامنة مكتبتك الأولى." });
        return true;
      } catch (err) {
        const msg = err instanceof CloudError ? err.message : "تعذر إنشاء الحساب";
        toast({ title: "فشل إنشاء الحساب", description: msg, variant: "destructive" });
        return false;
      }
    },
    [enterApp, toast],
  );

  const continueAsGuest = useCallback(() => {
    setGuest(true);
    setSession(null);
    setStage("app");
    toast({
      title: "وضع الزائر مفعّل",
      description: "بياناتك على هذا الجهاز فقط — إن حذفت التطبيق تُفقد. سجّل دخولك لاحقًا لحفظ كل شيء.",
    });
  }, [toast]);

  const doSignOut = useCallback(async () => {
    const s = sessionRef.current;
    if (s) {
      try {
        await cloudSignOut(s);
      } catch {
        /* best-effort remote logout */
      }
    }
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setGuest(false);
    setStage("gate");
    setVaultUnlocked(false);
    toast({ title: "تم تسجيل الخروج", description: "بياناتك محفوظة في السحابة." });
  }, [toast]);

  const syncNow = useCallback(async () => {
    if (!sessionRef.current) {
      toast({ title: "أنت في وضع الزائر", description: "سجّل الدخول للمزامنة السحابية." });
      return;
    }
    toast({ title: "جارٍ المزامنة…", description: "دمج بيانات هذا الجهاز مع السحابة." });
    await runSync();
  }, [runSync, toast]);

  // -- vault -----------------------------------------------------------------------------
  const unlockVault = useCallback(
    async (secret: string) => {
      const s = sessionRef.current;
      if (s) {
        // signed-in: re-authenticate against Supabase with the account password
        try {
          const fresh = await cloudSignIn(s.email, secret);
          safeSet(SESSION_KEY, fresh); // rotate to the fresh session
          setSession(fresh);
          setVaultUnlocked(true);
          return true;
        } catch {
          return false;
        }
      }
      // guest: compare the local PIN hash
      const ok =
        vaultConfig.enabled && String(hashPin(secret)) === vaultConfig.pinHash;
      if (ok) setVaultUnlocked(true);
      return ok;
    },
    [vaultConfig],
  );

  const lockVault = useCallback(() => setVaultUnlocked(false), []);

  const setGuestPin = useCallback((pin: string, hint = "") => {
    const cfg: VaultConfig = { enabled: true, pinHash: String(hashPin(pin)), hint };
    safeSet(KEYS.vault, cfg);
    setVaultConfig(cfg);
  }, []);

  const wipeCloudData = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    // Replace the cloud payload with the seed-empty local data (tombstones keep
    // deletions winning on other devices after the next merge).
    const empty = seedLocalData();
    empty.deletedPlaylists = [...dataRef.current.playlists.map((p) => p.id)];
    persistData2(empty, true);
    await runSync();
    setCloudRaw(null);
    toast({
      title: "أُفرغت الخزنة السحابية",
      description: "كل بيانات الحساب حُذفت من السحابة.",
      variant: "destructive",
    });
  }, [persistData2, runSync, toast]);

  // -- share -----------------------------------------------------------------------------
  const buildShareLink = useCallback((playlistIdInput: string) => {
    const pl = dataRef.current.playlists.find((p) => p.id === playlistIdInput);
    if (!pl) return "";
    const payload: SharedPlaylistPayload = {
      n: pl.name,
      t: pl.songIds.map((id) => {
        const t = trackById(id);
        return t ? `${t.title} — ${t.artist}` : id;
      }),
      by: identity.name,
      v: 1,
    };
    const encoded = encodeURIComponent(encodeShareBase64(JSON.stringify(payload)));
    return `${window.location.origin}/?share=${encoded}`;
  }, [identity.name]);

  const importShared = useCallback(() => {
    const p = sharedIncoming;
    if (!p) return;
    const trackIds: string[] = [];
    for (const entry of p.t) {
      const title = entry.split(" — ")[0]?.trim();
      const found = TRACKS.find((x) => x.title === title);
      if (found) trackIds.push(found.id);
    }
    const pl: Playlist = {
      id: uid("pl"),
      name: p.n,
      songIds: trackIds,
      updatedAt: Date.now(),
    };
    persistData2({ ...dataRef.current, playlists: [pl, ...dataRef.current.playlists] });
    setSharedIncoming(null);
    setPlaylistId(pl.id);
    setView("playlist");
    toast({
      title: "أُضيفت القائمة المشتركة",
      description: `${pl.name} · ${trackIds.length} أغنية`,
    });
  }, [persistData2, sharedIncoming, toast]);

  // -- guest backup -----------------------------------------------------------------------
  const exportBackup = useCallback((): GuestBackup => {
    const d = dataRef.current;
    return {
      kind: "nokiatis-guest-backup",
      version: 1,
      createdAt: Date.now(),
      library: {
        liked: d.liked.map((id) => lean(trackById(id) ?? { id, title: id, artist: "" })),
        saved: d.saved.map((id) => lean(trackById(id) ?? { id, title: id, artist: "" })),
        downloaded: d.downloaded.map((id) => lean(trackById(id) ?? { id, title: id, artist: "" })),
        history: d.history,
        playlists: d.playlists,
        listenedSeconds: d.listenedSeconds,
        listeningEvents: d.listeningEvents,
      },
      profile: d.tasteProfile,
    };
  }, []);

  const importBackup = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as GuestBackup;
      if (parsed.kind !== "nokiatis-guest-backup") return false;
      const d = dataRef.current;
      const next: LocalData = {
        ...d,
        liked: [...new Set([...parsed.library.liked.map((t) => t.id), ...d.liked])],
        saved: [...new Set([...parsed.library.saved.map((t) => t.id), ...d.saved])],
        downloaded: [...new Set([...parsed.library.downloaded.map((t) => t.id), ...d.downloaded])],
        playlists: [...d.playlists, ...parsed.library.playlists.filter((p) => !d.playlists.some((x) => x.id === p.id))],
        history: [...d.history, ...parsed.library.history.filter((h) => !d.history.some((x) => x.id === h.id))],
        listeningEvents: [...d.listeningEvents, ...parsed.library.listeningEvents.filter((e) => !d.listeningEvents.some((x) => x.id === e.id))].slice(0, 800),
        listenedSeconds: d.listenedSeconds + parsed.library.listenedSeconds,
      };
      next.tasteProfile = computeTasteProfile(next.listeningEvents, next.liked);
      persistData2(next);
      toast({ title: "استُورد النسخة الاحتياطية", description: "تمت استعادة بياناتك." });
      return true;
    } catch {
      return false;
    }
  }, [persistData2, toast]);

  // -- navigation helpers ------------------------------------------------------------------
  const openPlaylist = useCallback((id: string) => {
    setPlaylistId(id);
    setView("playlist");
  }, []);
  const openSmart = useCallback((id: string) => {
    setSmartId(id);
    setView("smart");
  }, []);
  const openArtist = useCallback((id: string) => {
    setArtistId(id);
    setView("artist");
  }, []);

  // open the shared-import view automatically once hydrated
  useEffect(() => {
    if (stage === "app" && sharedIncoming) {
      setView("shared");
    }
  }, [stage]);

  // cleanup pending sync timer
  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  // -- value ------------------------------------------------------------------------------
  const value: AppCtxValue = useMemo(
    () => ({
      version: APP_VERSION,
      stage,
      user: session
        ? { email: session.email, userId: session.user_id, guest: false }
        : guest
          ? { email: "guest@nokiatis.local", userId: "guest", guest: true }
          : null,

      data,
      likedSet,
      savedSet,
      downloadedSet,
      toggleLike,
      toggleSaved,
      toggleDownload,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
      clearHistory,

      profile: data.tasteProfile,
      smartPlaylists,
      stats,
      lastPlayed,
      artists: ARTISTS,
      tracks: TRACKS,

      player,
      queue,
      playTrackIds,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,

      identity,
      setIdentity,
      settings,
      setSettings,

      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markAllNotificationsRead,
      dismissNotification,
      requestNotificationPermission,
      updateInfo,
      checkUpdatesNow,

      sync: {
        busy: syncBusy,
        lastSyncAt,
        error: syncError,
        log: syncLog,
        signedIn: Boolean(session),
        guest,
      },
      doSignIn,
      doSignUp,
      continueAsGuest,
      doSignOut,
      syncNow,

      vaultUnlocked,
      vaultConfig,
      unlockVault,
      lockVault,
      setGuestPin,
      wipeCloudData,
      cloudRaw,

      sharedIncoming,
      setSharedIncoming,
      importShared,
      buildShareLink,
      shareTarget,
      setShareTarget,
      addToPlaylistTarget,
      openAddToPlaylist: setAddToPlaylistTarget,
      setAddToPlaylistTarget,

      exportBackup,
      importBackup,

      view,
      playlistId,
      smartId,
      artistId,
      openPlaylist,
      openSmart,
      openArtist,
      setView,
    }),
    [
      stage, session, guest, data, likedSet, savedSet, downloadedSet,
      toggleLike, toggleSaved, toggleDownload, createPlaylist, deletePlaylist,
      renamePlaylist, addToPlaylist, removeFromPlaylist, reorderPlaylist,
      clearHistory, smartPlaylists, stats, lastPlayed, player, queue,
      playTrackIds, togglePlay, next, prev, seek, setVolume, toggleMute,
      toggleShuffle, cycleRepeat, identity, setIdentity, settings, setSettings,
      notifications, updateInfo, checkUpdatesNow, syncBusy, lastSyncAt,
      syncError, syncLog, doSignIn, doSignUp, continueAsGuest, doSignOut,
      syncNow, vaultUnlocked, vaultConfig, unlockVault, setGuestPin,
      wipeCloudData, cloudRaw, sharedIncoming, importShared, buildShareLink,
      exportBackup, importBackup, view, playlistId, smartId, artistId,
      openPlaylist, openSmart, openArtist, requestNotificationPermission,
      markAllNotificationsRead, dismissNotification, shareTarget, addToPlaylistTarget,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
