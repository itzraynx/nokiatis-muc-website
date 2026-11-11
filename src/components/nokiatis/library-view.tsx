"use client";

/**
 * Library — instant search + sort + genre filters + grid/list toggle +
 * multi-select bulk actions. Every action button is always visible.
 */

import { useMemo, useState } from "react";
import {
  Check,
  Download,
  Grid2X2,
  Heart,
  LayoutList,
  ListPlus,
  Play,
  Search,
  Share2,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "./app-context";
import { EmptyState, SectionHeader, TrackRow } from "./shared";
import { COVER_GRADIENTS, GENRE_PALETTE, trackById, encodeShareBase64 } from "@/lib/nokiatis-data";
import type { RichTrack } from "@/lib/nokiatis-types";

type SortKey = "recent" | "title" | "artist" | "mostPlayed" | "duration";

export function LibraryView() {
  const {
    tracks,
    data,
    playTrackIds,
    toggleLike,
    toggleDownload,
    setShareTarget,
    openAddToPlaylist,
  } = useApp();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [genre, setGenre] = useState("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const playCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of data.listeningEvents) m[e.trackId] = (m[e.trackId] ?? 0) + 1;
    return m;
  }, [data.listeningEvents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tracks.filter((t) => {
      if (genre !== "all" && t.genre !== genre) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title, "ar");
        case "artist":
          return a.artist.localeCompare(b.artist, "ar");
        case "mostPlayed":
          return (playCount[b.id] ?? 0) - (playCount[a.id] ?? 0);
        case "duration":
          return b.durationSec - a.durationSec;
        default:
          return b.year - a.year;
      }
    });
    return list;
  }, [tracks, query, genre, sort, playCount]);

  const ids = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const genres = Object.keys(GENRE_PALETTE).filter((g) => g !== "أخرى");

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const bulkShare = () => {
    const sel = [...selected];
    const lines = sel
      .map((id) => {
        const t = trackById(id);
        return t ? `${t.title} — ${t.artist}` : null;
      })
      .filter(Boolean) as string[];
    if (typeof window === "undefined") return;
    const payload = { n: "تشكيلة من Nokiatis", t: lines, by: "Nokiatis", v: 1 };
    setShareTarget({
      title: `${sel.length} أغنية مختارة`,
      subtitle: "تشكيلة من المكتبة",
      link: `${window.location.origin}/?share=${encodeURIComponent(encodeShareBase64(JSON.stringify(payload)))}`,
      lines,
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <SectionHeader
        title="المكتبة"
        subtitle={`${filtered.length} من ${tracks.length} أغنية · ${data.downloaded.length} منزّلة · ${data.liked.length} مفضلة`}
        icon={<LayoutList style={{ width: 20, height: 20 }} />}
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLayout("grid")}
              aria-label="عرض شبكي"
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                layout === "grid" ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-800/80 text-neutral-500"
              }`}
            >
              <Grid2X2 style={{ width: 18, height: 18 }} />
            </button>
            <button
              onClick={() => setLayout("list")}
              aria-label="عرض قائمة"
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                layout === "list" ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-800/80 text-neutral-500"
              }`}
            >
              <LayoutList style={{ width: 18, height: 18 }} />
            </button>
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className={`h-11 px-4 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
                selectMode
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {selectMode ? <X style={{ width: 14, height: 14 }} /> : <Check style={{ width: 14, height: 14 }} />}
              {selectMode ? "إلغاء التحديد" : "تحديد"}
            </button>
          </div>
        }
      />

      {/* controls */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
              style={{ width: 18, height: 18 }}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث فورًا عن أغنية أو فنان أو ألبوم…"
              className="h-12 bg-neutral-900/70 border-white/10 pr-11 text-base rounded-xl"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-12 w-40 bg-neutral-900/70 border-white/10 rounded-xl text-sm">
              <SelectValue placeholder="ترتيب" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/10">
              <SelectItem value="recent">الأحدث</SelectItem>
              <SelectItem value="title">العنوان</SelectItem>
              <SelectItem value="artist">الفنان</SelectItem>
              <SelectItem value="mostPlayed">الأكثر تشغيلًا</SelectItem>
              <SelectItem value="duration">المدة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* genre chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setGenre("all")}
            className={`h-9 px-4 rounded-full text-xs font-bold shrink-0 transition-colors ${
              genre === "all"
                ? "bg-emerald-500 text-neutral-950"
                : "bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            الكل
          </button>
          {genres.map((g) => {
            const pal = GENRE_PALETTE[g];
            const active = genre === g;
            return (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className="h-9 px-4 rounded-full text-xs font-bold shrink-0 border transition-all active:scale-95"
                style={
                  active
                    ? { background: pal.from, color: "#0a0a0a", borderColor: pal.from }
                    : { background: `${pal.from}18`, color: pal.to, borderColor: `${pal.from}44` }
                }
              >
                {pal.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* bulk action bar */}
      {selectMode ? (
        <div className="sticky top-[68px] z-30 mb-4 rounded-2xl bg-neutral-900 border border-emerald-500/30 p-3 shadow-xl">
          <p className="text-sm font-bold text-neutral-100 mb-2.5">
            محدد: <span className="text-emerald-400">{selected.size}</span> أغنية
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={selected.size === 0}
              onClick={() => {
                playTrackIds([...selected], 0, "bulk");
                exitSelect();
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-11"
            >
              <Play className="fill-current" style={{ width: 16, height: 16 }} />
              تشغيل المحدد
            </Button>
            <Button
              disabled={selected.size === 0}
              variant="outline"
              onClick={() => openAddToPlaylist([...selected])}
              className="border-white/15 h-11"
            >
              <ListPlus style={{ width: 16, height: 16 }} />
              أضِف لقائمة
            </Button>
            <Button
              disabled={selected.size === 0}
              variant="outline"
              onClick={bulkShare}
              className="border-white/15 h-11"
            >
              <Share2 style={{ width: 16, height: 16 }} />
              مشاركة
            </Button>
            <Button
              disabled={selected.size === 0}
              variant="outline"
              onClick={() => {
                for (const id of selected) toggleDownload(id);
                exitSelect();
              }}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-11"
            >
              <Download style={{ width: 16, height: 16 }} />
              تنزيل / إزالة
            </Button>
            <Button
              disabled={selected.size === 0}
              variant="outline"
              onClick={() => {
                for (const id of selected) toggleLike(id);
                exitSelect();
              }}
              className="border-white/15 h-11"
            >
              <Heart style={{ width: 16, height: 16 }} />
              قلب المفضلة
            </Button>
          </div>
        </div>
      ) : null}

      {/* content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search style={{ width: 26, height: 26 }} />}
          title="لا نتائج"
          body="جرّب كلمة أخرى أو أزل مرشح النوع — الكتالوج كامل متاح."
        />
      ) : layout === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filtered.map((t, i) => (
            <TrackCardGrid
              key={t.id}
              track={t}
              index={i}
              ids={ids}
              selectMode={selectMode}
              selected={selected.has(t.id)}
              onToggleSelect={() => toggleSel(t.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2">
              {selectMode ? (
                <button
                  onClick={() => toggleSel(t.id)}
                  aria-label="تحديد"
                  className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                    selected.has(t.id)
                      ? "bg-emerald-500 text-neutral-950"
                      : "bg-neutral-800/80 text-neutral-500"
                  }`}
                >
                  <Check style={{ width: 18, height: 18 }} />
                </button>
              ) : null}
              <div className="flex-1 min-w-0">
                <TrackRow track={t} index={i} contextIds={ids} context="library" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid card variant
// ---------------------------------------------------------------------------

function TrackCardGrid({
  track,
  index,
  ids,
  selectMode,
  selected,
  onToggleSelect,
}: {
  track: RichTrack;
  index: number;
  ids: string[];
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const { player, playTrackIds, togglePlay, setShareTarget } = useApp();
  const isCurrent = player.currentTrackId === track.id;
  const isPlaying = isCurrent && player.playing;

  return (
    <div
      className={`relative rounded-2xl bg-neutral-900/70 border p-3 cursor-pointer transition-all hover:bg-neutral-800/70 active:scale-95 ${
        selected ? "border-emerald-500/60" : "border-white/5"
      }`}
      onClick={() => (selectMode ? onToggleSelect() : undefined)}
      role="button"
      aria-label={track.title}
    >
      <div className="relative">
        <TrackCardCover track={track} />
        {selectMode ? (
          <div
            className={`absolute top-2 right-2 h-9 w-9 rounded-full flex items-center justify-center ${
              selected ? "bg-emerald-500 text-neutral-950" : "bg-neutral-950/70 text-neutral-400"
            }`}
          >
            <Check style={{ width: 16, height: 16 }} />
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCurrent) togglePlay();
              else playTrackIds(ids, index, "library");
            }}
            aria-label={isPlaying ? "إيقاف" : "تشغيل"}
            className={`absolute bottom-2 left-2 h-12 w-12 rounded-full flex items-center justify-center shadow-[0_6px_18px_rgba(16,185,129,.45)] active:scale-90 transition-all ${
              isPlaying
                ? "bg-emerald-500 text-neutral-950"
                : "bg-emerald-500 text-neutral-950 opacity-90 hover:opacity-100 hover:scale-105"
            }`}
          >
            <Play className="fill-current" style={{ width: 20, height: 20 }} />
          </button>
        )}
      </div>

      <p className={`mt-2.5 text-sm font-bold truncate ${isCurrent ? "text-emerald-400" : "text-neutral-100"}`}>
        {track.title}
      </p>
      <p className="text-xs text-neutral-500 truncate">{track.artist} · {track.year}</p>

      <div className="flex items-center gap-1.5 mt-2.5">
        <LikeMini trackId={track.id} />
        <DownloadMini trackId={track.id} />
        <ShareMini
          onClick={() => {
            if (typeof window === "undefined") return;
            const payload = {
              n: track.title,
              t: [`${track.title} — ${track.artist}`],
              by: "Nokiatis",
              v: 1,
            };
            setShareTarget({
              title: track.title,
              subtitle: `${track.artist} · ${track.album}`,
              link: `${window.location.origin}/?share=${encodeURIComponent(encodeShareBase64(JSON.stringify(payload)))}`,
              lines: [`${track.title} — ${track.artist}`],
            });
          }}
        />
      </div>
    </div>
  );
}

function TrackCardCover({ track }: { track: RichTrack }) {
  const g = COVER_GRADIENTS[track.coverSeed % COVER_GRADIENTS.length];
  return (
    <div
      className="relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
      aria-hidden
    >
      <span className="absolute font-extrabold text-neutral-950/40 text-5xl select-none">
        {track.title.slice(0, 1)}
      </span>
    </div>
  );
}

function LikeMini({ trackId }: { trackId: string }) {
  const { likedSet, toggleLike } = useApp();
  const liked = likedSet.has(trackId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleLike(trackId);
      }}
      aria-label={liked ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      className={`h-9 flex-1 rounded-full flex items-center justify-center gap-1 text-[11px] font-bold transition-colors active:scale-95 ${
        liked ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700"
      }`}
    >
      <Heart className={liked ? "fill-emerald-400" : ""} style={{ width: 14, height: 14 }} />
      {liked ? "مفضلة" : "أضف"}
    </button>
  );
}

function DownloadMini({ trackId }: { trackId: string }) {
  const { downloadedSet, toggleDownload } = useApp();
  const downloaded = downloadedSet.has(trackId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleDownload(trackId);
      }}
      aria-label={downloaded ? "إزالة من التنزيلات" : "تنزيل"}
      className={`h-9 flex-1 rounded-full flex items-center justify-center gap-1 text-[11px] font-bold transition-colors active:scale-95 ${
        downloaded ? "bg-amber-500/15 text-amber-400" : "bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700"
      }`}
    >
      <Download className={downloaded ? "fill-amber-400/60" : ""} style={{ width: 14, height: 14 }} />
      {downloaded ? "منزّلة" : "نزّل"}
    </button>
  );
}

function ShareMini({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="مشاركة"
      className="h-9 w-9 rounded-full bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700 flex items-center justify-center transition-colors active:scale-95"
    >
      <Share2 style={{ width: 14, height: 14 }} />
    </button>
  );
}
