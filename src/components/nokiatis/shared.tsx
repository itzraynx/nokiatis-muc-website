"use client";

/**
 * Nokiatis MUC — shared UI building blocks (v1.17.3-beta.1).
 *
 * Design contract (owner's explicit demands):
 *  - The "green halo" behind avatars/covers is attached to a rounded-full
 *    element through box-shadow, so it can NEVER degenerate into a square
 *    when views switch or data re-renders.
 *  - Action buttons (share / remove download / delete / like) are always
 *    visible, never hidden behind hover.
 *  - Emerald + amber + rose + neutral palette only. No blue / indigo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  Heart,
  ListPlus,
  Music2,
  Pause,
  Play,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "./app-context";
import type { ShareTarget } from "./app-context";
import { AVATAR_COLORS, COVER_GRADIENTS, GENRE_PALETTE, formatDuration, formatRelativeTime, trackById, encodeShareBase64 } from "@/lib/nokiatis-data";
import type { RichTrack } from "@/lib/nokiatis-types";

// ---------------------------------------------------------------------------
// Circular glow wrapper — the halo that can never become a square
// ---------------------------------------------------------------------------

export function CircularGlow({
  children,
  size = 44,
  color = "rgba(16,185,129,0.35)",
  className = "",
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 22px 2px ${color}, 0 0 44px 6px ${color.replace("0.", "0.")} `,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover art — deterministic gradient per track
// ---------------------------------------------------------------------------

export function TrackCover({
  track,
  size = 48,
  rounded = "rounded-lg",
  className = "",
}: {
  track: RichTrack;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const g = COVER_GRADIENTS[track.coverSeed % COVER_GRADIENTS.length];
  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${rounded} ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
      }}
      aria-hidden
    >
      <div className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,.14) 0 2px, transparent 2px 9px)",
        }}
      />
      <span
        className="absolute font-extrabold text-neutral-950/40 select-none"
        style={{ fontSize: size * 0.52, lineHeight: 1 }}
      >
        {track.title.slice(0, 1)}
      </span>
      <Music2
        className="absolute bottom-1 left-1 text-neutral-950/50"
        style={{ width: size * 0.22, height: size * 0.22 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artist avatar — always circular, glow baked into box-shadow
// ---------------------------------------------------------------------------

export function ArtistAvatar({
  image,
  name,
  size = 56,
  glow = true,
  className = "",
}: {
  image: string;
  name: string;
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 ring-2 ring-emerald-500/30 ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: glow ? "0 0 18px 2px rgba(16,185,129,.4)" : undefined,
      }}
    >
     
      <img
        src={image}
        alt={name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile avatar (initials + local-saved color/emoji)
// ---------------------------------------------------------------------------

export function ProfileAvatar({
  name,
  colorIndex,
  emoji,
  size = 40,
  glow = true,
  className = "",
}: {
  name: string;
  colorIndex: number;
  emoji: string;
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initials = name.trim().slice(0, 2) || "ن";
  return (
    <div
      className={`relative rounded-full shrink-0 flex items-center justify-center font-extrabold ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: "#0a0a0a",
        fontSize: size * 0.4,
        boxShadow: glow ? "0 0 20px 3px rgba(16,185,129,.45)" : undefined,
        border: `2px solid ${color}`,
      }}
      aria-label={name}
    >
      {initials}
      <span
        className="absolute -bottom-1 -left-1 rounded-full bg-neutral-950 flex items-center justify-center"
        style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.22 }}
      >
        {emoji}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon ? <span className="text-emerald-400">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-extrabold text-neutral-50 truncate">{title}</h2>
          {subtitle ? (
            <p className="text-xs md:text-sm text-neutral-400 truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl border border-dashed border-white/10 bg-neutral-900/40">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-neutral-100">{title}</h3>
      <p className="text-sm text-neutral-400 mt-1 max-w-sm leading-relaxed">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Like / Download / Share — always-visible action buttons
// ---------------------------------------------------------------------------

export function LikeButton({
  trackId,
  compact = false,
}: {
  trackId: string;
  compact?: boolean;
}) {
  const { likedSet, toggleLike } = useApp();
  const liked = likedSet.has(trackId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleLike(trackId);
      }}
      aria-label={liked ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      className={`h-11 w-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
        liked
          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
          : "bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
      }`}
    >
      <Heart className={liked ? "fill-emerald-400" : ""} style={{ width: compact ? 16 : 20, height: compact ? 16 : 20 }} />
    </button>
  );
}

export function DownloadButton({ trackId }: { trackId: string }) {
  const { downloadedSet, toggleDownload } = useApp();
  const downloaded = downloadedSet.has(trackId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleDownload(trackId);
      }}
      aria-label={downloaded ? "إزالة من التنزيلات" : "تنزيل"}
      title={downloaded ? "إزالة من التنزيلات" : "تنزيل (محاكاة)"}
      className={`h-11 w-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
        downloaded
          ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
          : "bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
      }`}
    >
      <Download className={downloaded ? "fill-amber-400/60" : ""} style={{ width: 20, height: 20 }} />
    </button>
  );
}

export function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="مشاركة"
      title="مشاركة"
      className="h-11 w-11 rounded-full flex items-center justify-center bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700 hover:text-white transition-all active:scale-90"
    >
      <Share2 style={{ width: 20, height: 20 }} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Track row (list) — full player + visible actions
// ---------------------------------------------------------------------------

export function TrackRow({
  track,
  index,
  contextIds,
  context,
  showCover = true,
  onRemove,
  removeLabel,
}: {
  track: RichTrack;
  index: number;
  contextIds: string[];
  context: string;
  showCover?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const { player, playTrackIds, togglePlay, setShareTarget, openAddToPlaylist } = useApp();
  const isCurrent = player.currentTrackId === track.id;
  const isPlaying = isCurrent && player.playing;
  const genreColor = GENRE_PALETTE[track.genre] ?? GENRE_PALETTE["أخرى"];

  return (
    <div
      className={`group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2.5 py-2 cursor-pointer transition-colors ${
        isCurrent ? "bg-emerald-500/10" : "hover:bg-white/5"
      }`}
      onClick={() =>
        isCurrent ? togglePlay() : playTrackIds(contextIds, index, context)
      }
      role="button"
      aria-label={`تشغيل ${track.title}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showCover ? <TrackCover track={track} size={48} /> : null}
        <div className="min-w-0 hidden sm:block">
          <p className={`text-sm font-bold truncate ${isCurrent ? "text-emerald-400" : "text-neutral-100"}`}>
            {track.title}
          </p>
          <p className="text-xs text-neutral-400 truncate">
            {track.artist} · {genreColor.label}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-0 sm:min-w-0 justify-end">
        <div className="flex items-center gap-2">
          <LikeButton trackId={track.id} compact />
          <DownloadButton trackId={track.id} />
          <ShareButton
            onClick={() =>
              setShareTarget({
                title: track.title,
                subtitle: `${track.artist} · ${track.album}`,
                link: buildTrackLink(track),
                lines: [`${track.title} — ${track.artist}`],
              })
            }
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              openAddToPlaylist([track.id]);
            }}
            aria-label="أضِف إلى قائمة"
            title="أضِف إلى قائمة"
            className="h-11 w-11 rounded-full flex items-center justify-center bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700 hover:text-white transition-all active:scale-90"
          >
            <ListPlus style={{ width: 20, height: 20 }} />
          </button>
          {onRemove ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={removeLabel ?? "حذف"}
              title={removeLabel ?? "حذف"}
              className="h-11 w-11 rounded-full flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 transition-all active:scale-90"
            >
              <Trash2 style={{ width: 20, height: 20 }} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 tabular-nums hidden md:block">
          {formatDuration(track.durationSec)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isCurrent) togglePlay();
            else playTrackIds(contextIds, index, context);
          }}
          aria-label={isPlaying ? "إيقاف" : "تشغيل"}
          className={`h-11 w-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isPlaying
              ? "bg-emerald-500 text-neutral-950 shadow-[0_0_18px_rgba(16,185,129,.5)]"
              : "bg-neutral-800/80 text-neutral-200 hover:bg-emerald-500 hover:text-neutral-950"
          }`}
        >
          {isPlaying ? (
            <Pause style={{ width: 22, height: 22 }} />
          ) : (
            <Play className="fill-current" style={{ width: 22, height: 22 }} />
          )}
        </button>
      </div>
    </div>
  );
}

function buildTrackLink(track: RichTrack): string {
  // Track-level sharing rides the same share payload used by playlists.
  const payload = { n: track.title, t: [`${track.title} — ${track.artist}`], by: "Nokiatis", v: 1 };
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?share=${encodeURIComponent(encodeShareBase64(JSON.stringify(payload)))}`;
}

// ---------------------------------------------------------------------------
// Share dialog with QR code
// ---------------------------------------------------------------------------

export function ShareDialog() {
  const { shareTarget, setShareTarget } = useApp();
  const [svg, setSvg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // QR is generated asynchronously per target (async setState is fine)
  useEffect(() => {
    const target = shareTarget;
    if (!target) return;
    let alive = true;
    QRCode.toString(target.link, {
      type: "svg",
      margin: 1,
      width: 220,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((s) => {
        if (alive) setSvg(s);
      })
      .catch(() => {
        if (alive) setSvg("");
      });
    return () => {
      alive = false;
    };
  }, [shareTarget]);

  const close = () => {
    setShareTarget(null);
    setSvg("");
    setCopied(false);
  };

  const copy = async () => {
    if (!shareTarget) return;
    try {
      await navigator.clipboard.writeText(shareTarget.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const nativeShare = async () => {
    if (!shareTarget) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTarget.title,
          text: shareTarget.lines.join("\n"),
          url: shareTarget.link,
        });
      } catch {
        /* user dismissed */
      }
    } else {
      void copy();
    }
  };

  return (
    <Dialog open={Boolean(shareTarget)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-md w-[92vw] rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-50">
            <Share2 className="text-emerald-400" style={{ width: 18, height: 18 }} />
            مشاركة {shareTarget?.title ?? ""}
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            {shareTarget?.subtitle ?? "أرسل الرابط أو امسح رمز QR"}
          </DialogDescription>
        </DialogHeader>

        {svg ? (
          <div className="flex justify-center p-3 rounded-xl bg-white" dir="ltr">
            <div className="w-[220px] h-[220px]" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR" />
          </div>
        ) : (
          <div className="flex justify-center items-center h-[220px] rounded-xl bg-neutral-800 text-neutral-500 text-sm">
            جارٍ توليد رمز QR…
          </div>
        )}

        <div className="text-xs text-neutral-400 truncate bg-neutral-950/70 rounded-lg px-3 py-2 border border-white/5" dir="ltr">
          {shareTarget?.link ?? ""}
        </div>

        <DialogFooter className="flex-row gap-2 flex-wrap">
          <Button onClick={copy} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold">
            {copied ? <Check style={{ width: 18, height: 18 }} /> : <Copy style={{ width: 18, height: 18 }} />}
            {copied ? "تم النسخ" : "نسخ الرابط"}
          </Button>
          <Button onClick={nativeShare} variant="outline" className="flex-1 border-white/15">
            <UserPlus style={{ width: 18, height: 18 }} className="text-emerald-400" />
            مشاركة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add-to-playlist dialog
// ---------------------------------------------------------------------------

export function AddToPlaylistDialog() {
  const { addToPlaylistTarget, setAddToPlaylistTarget, data, addToPlaylist, createPlaylist } = useApp();
  const [name, setName] = useState("");

  const close = () => {
    setAddToPlaylistTarget(null);
    setName("");
  };

  return (
    <Dialog open={Boolean(addToPlaylistTarget)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-md w-[92vw] rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="text-emerald-400" style={{ width: 18, height: 18 }} />
            أضِف إلى قائمة تشغيل
          </DialogTitle>
          <DialogDescription>
            {addToPlaylistTarget?.length ?? 0} أغنية — اختر قائمة أو أنشئ واحدة
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {data.playlists.map((p) => (
            <button
              key={p.id}
              className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-white/5 transition-colors text-right"
              onClick={() => {
                if (addToPlaylistTarget) addToPlaylist(p.id, addToPlaylistTarget);
                close();
              }}
            >
              <div className="min-w-0">
                <p className="font-bold text-sm text-neutral-100 truncate">{p.name}</p>
                <p className="text-xs text-neutral-500">{p.songIds.length} أغنية · {formatRelativeTime(p.updatedAt)}</p>
              </div>
              <Check className="text-emerald-400" style={{ width: 18, height: 18 }} />
            </button>
          ))}
          {data.playlists.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">لا قوائم بعد — أنشئ أول واحدة أدناه</p>
          ) : null}
        </div>

        <div className="flex gap-2 pt-2 border-t border-white/5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم قائمة جديدة…"
            className="bg-neutral-950 border-white/10"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                if (addToPlaylistTarget) createPlaylist(name, addToPlaylistTarget);
                close();
              }
            }}
          />
          <Button
            disabled={!name.trim()}
            onClick={() => {
              if (addToPlaylistTarget) createPlaylist(name, addToPlaylistTarget);
              close();
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold shrink-0"
          >
            إنشاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Smart playlist card
// ---------------------------------------------------------------------------

export function SmartCard({
  title,
  subtitle,
  accent,
  trackIds,
  onOpen,
  onPlay,
}: {
  title: string;
  subtitle: string;
  accent: string;
  trackIds: string[];
  onOpen: () => void;
  onPlay: () => void;
}) {
  const covers = useMemo(() => {
    const list: RichTrack[] = [];
    for (const id of trackIds.slice(0, 4)) {
      const t = trackById(id);
      if (t) list.push(t);
    }
    return list;
  }, [trackIds]);

  return (
    <div
      className="relative w-[168px] md:w-[184px] shrink-0 rounded-2xl overflow-hidden cursor-pointer border border-white/5 transition-transform hover:scale-[1.02] active:scale-95"
      style={{ background: `linear-gradient(145deg, ${accent}33, #171717 60%)` }}
      onClick={onOpen}
      role="button"
      aria-label={title}
    >
      <div className="h-[132px] md:h-[144px] grid grid-cols-2 gap-0.5 p-2">
        {covers.map((t) => (
          <TrackCover key={t.id} track={t} size={64} rounded="rounded-md" className="w-full h-full" />
        ))}
        {covers.length === 0 ? (
          <div className="col-span-2 flex items-center justify-center text-neutral-600">
            <Music2 style={{ width: 34, height: 34 }} />
          </div>
        ) : null}
      </div>
      <div className="p-3 pt-2">
        <p className="text-sm font-extrabold text-neutral-50 truncate">{title}</p>
        <p className="text-[11px] text-neutral-400 truncate mt-0.5">{subtitle}</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          aria-label={`تشغيل ${title}`}
          className="absolute bottom-3 left-3 h-11 w-11 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,.45)] hover:bg-emerald-400 transition-all active:scale-90"
        >
          <Play className="fill-current" style={{ width: 20, height: 20 }} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playlist card
// ---------------------------------------------------------------------------

export function PlaylistCard({
  name,
  songIds,
  updatedAt,
  onOpen,
  onShare,
}: {
  name: string;
  songIds: string[];
  updatedAt: number;
  onOpen: () => void;
  onShare: () => void;
}) {
  const covers = useMemo(() => {
    const list: RichTrack[] = [];
    for (const id of songIds.slice(0, 4)) {
      const t = trackById(id);
      if (t) list.push(t);
    }
    return list;
  }, [songIds]);

  return (
    <div
      className="group w-[168px] md:w-[184px] shrink-0 rounded-2xl bg-neutral-900/70 border border-white/5 p-3 cursor-pointer transition-all hover:bg-neutral-800/70 hover:scale-[1.02] active:scale-95"
      onClick={onOpen}
      role="button"
      aria-label={name}
    >
      <div className="relative h-[132px] md:h-[144px] grid grid-cols-2 gap-1 rounded-xl overflow-hidden bg-neutral-800">
        {covers.map((t) => (
          <TrackCover key={t.id} track={t} size={72} rounded="rounded-none" className="w-full h-full" />
        ))}
        {covers.length === 0 ? (
          <div className="col-span-2 flex items-center justify-center text-neutral-600">
            <Music2 style={{ width: 34, height: 34 }} />
          </div>
        ) : null}
      </div>
      <p className="mt-2.5 text-sm font-extrabold text-neutral-50 truncate">{name}</p>
      <p className="text-[11px] text-neutral-500">{songIds.length} أغنية · {formatRelativeTime(updatedAt)}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          aria-label="مشاركة القائمة"
          className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 active:scale-90 transition-all"
        >
          <Share2 style={{ width: 16, height: 16 }} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat pill (AI hub)
// ---------------------------------------------------------------------------

export function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-neutral-900/70 border border-white/5 px-4 py-3 flex items-center gap-3 min-w-0">
      <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-extrabold text-neutral-50 truncate tabular-nums">{value}</p>
        <p className="text-[11px] text-neutral-500 truncate">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal scroller with hidden scrollbar
// ---------------------------------------------------------------------------

export function Row({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
      >
        {children}
      </div>
    </div>
  );
}

export function BetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15 text-[11px] font-bold">
      {children}
    </Badge>
  );
}
