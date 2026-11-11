"use client";

/**
 * Playlists — your lists, drag-to-reorder (dnd-kit), big always-visible
 * actions (play / shuffle / share+QR / rename / delete), plus the smart
 * playlist detail, artist detail and shared-link import screens.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Disc3,
  GripVertical,
  Heart,
  ListPlus,
  Loader2,
  Music2,
  Pencil,
  Play,
  Plus,
  Search,
  Share2,
  Shuffle,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApp } from "./app-context";
import {
  EmptyState,
  PlaylistCard,
  SectionHeader,
  TrackRow,
  ArtistAvatar,
  BetaBadge,
} from "./shared";
import { GENRE_PALETTE, TRACKS, trackById, formatRelativeTime } from "@/lib/nokiatis-data";
import type { RichTrack } from "@/lib/nokiatis-types";

// ---------------------------------------------------------------------------
// Playlists overview
// ---------------------------------------------------------------------------

export function PlaylistsView() {
  const { data, openPlaylist, buildShareLink, setShareTarget, createPlaylist } = useApp();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="max-w-6xl mx-auto">
      <SectionHeader
        title="قوائمي"
        subtitle={`${data.playlists.length} قائمة · مزامنة سحابية تلقائية`}
        icon={<ListPlus style={{ width: 20, height: 20 }} />}
        action={
          <Button
            onClick={() => setNewOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-11 rounded-full px-5"
          >
            <Plus style={{ width: 18, height: 18 }} />
            قائمة جديدة
          </Button>
        }
      />

      {data.playlists.length === 0 ? (
        <EmptyState
          icon={<Music2 style={{ width: 26, height: 26 }} />}
          title="لا قوائم بعد"
          body="أنشئ قائمة تشغيل، أضِف أغانيك المفضلة، وشاركها برابط أو رمز QR."
          action={
            <Button
              onClick={() => setNewOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-12 px-6"
            >
              <Plus style={{ width: 18, height: 18 }} />
              أنشئ أول قائمة
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {data.playlists.map((p) => (
            <PlaylistCard
              key={p.id}
              name={p.name}
              songIds={p.songIds}
              updatedAt={p.updatedAt}
              onOpen={() => openPlaylist(p.id)}
              onShare={() => {
                setShareTarget({
                  title: p.name,
                  subtitle: `${p.songIds.length} أغنية`,
                  link: buildShareLink(p.id),
                  lines: p.songIds
                    .map((id) => {
                      const t = trackById(id);
                      return t ? `${t.title} — ${t.artist}` : null;
                    })
                    .filter(Boolean) as string[],
                });
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="bg-neutral-900 border-white/10 max-w-md w-[92vw] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>قائمة تشغيل جديدة</DialogTitle>
            <DialogDescription>سمّها الآن وأضِف الأغاني من المكتبة.</DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: ليالي الصيف…"
            className="h-12 bg-neutral-950 border-white/10 text-base"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                createPlaylist(newName);
                setNewName("");
                setNewOpen(false);
              }
            }}
          />
          <Button
            disabled={!newName.trim()}
            onClick={() => {
              createPlaylist(newName);
              setNewName("");
              setNewOpen(false);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-12"
          >
            إنشاء
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playlist detail (drag-to-reorder + all actions visible)
// ---------------------------------------------------------------------------

export function PlaylistDetailView() {
  const {
    playlistId,
    data,
    playTrackIds,
    toggleShuffle,
    player,
    buildShareLink,
    setShareTarget,
    renamePlaylist,
    deletePlaylist,
    reorderPlaylist,
    removeFromPlaylist,
    setView,
    openAddToPlaylist,
  } = useApp();

  const playlist = data.playlists.find((p) => p.id === playlistId) ?? null;
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(playlist?.name ?? "");
  const [renameInit, setRenameInit] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const songIds = useMemo(() => playlist?.songIds ?? [], [playlist]);
  const knownTracks = songIds
    .map((id) => trackById(id))
    .filter((t): t is RichTrack => Boolean(t));

  if (!playlist) {
    return (
      <EmptyState
        icon={<Music2 style={{ width: 26, height: 26 }} />}
        title="القائمة غير موجودة"
        body="ربما حُذفت على جهاز آخر — المزامنة حدّثت القوائم."
        action={<Button onClick={() => setView("playlists")} variant="outline" className="h-11">عودة للقوائم</Button>}
      />
    );
  }

  if (!renameInit && playlist) {
    setRenameValue(playlist.name);
    setRenameInit(true);
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = songIds.indexOf(String(active.id));
    const newIdx = songIds.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(songIds, oldIdx, newIdx);
    reorderPlaylist(playlist.id, next);
  };

  const anyUnknown = songIds.length > knownTracks.length;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => setView("playlists")}
        className="h-11 px-4 mb-4 rounded-full bg-neutral-900/80 border border-white/5 text-sm text-neutral-300 flex items-center gap-2 hover:bg-neutral-800"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        كل القوائم
      </button>

      {/* header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 mb-6">
        <div
          className="w-40 h-40 md:w-48 md:h-48 rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(16,185,129,.25)] flex items-center justify-center overflow-hidden relative shrink-0"
          style={{
            background: `linear-gradient(140deg, ${(GENRE_PALETTE["بوب"] ?? { from: "#10b981" }).from}, #171717)`,
          }}
        >
          <div className="grid grid-cols-2 gap-1 p-2 w-full h-full">
            {knownTracks.slice(0, 4).map((t) => {
              const pal = GENRE_PALETTE[t.genre] ?? GENRE_PALETTE["أخرى"];
              return (
                <div
                  key={t.id}
                  className="rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${pal.from}, ${pal.to})` }}
                />
              );
            })}
          </div>
          <Music2 className="absolute text-neutral-950/40" style={{ width: 52, height: 52 }} />
        </div>
        <div className="text-center sm:text-right min-w-0 flex-1">
          <BetaBadge>قائمة تشغيل</BetaBadge>
          <h1 className="text-3xl md:text-5xl font-extrabold mt-2 break-words">{playlist.name}</h1>
          <p className="text-sm text-neutral-400 mt-2">
            {playlist.songIds.length} أغنية · آخر تحديث {formatRelativeTime(playlist.updatedAt)}
            {anyUnknown ? " · تتضمن مقاطع من جهاز Android" : ""}
          </p>
        </div>
      </div>

      {/* always-visible actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          onClick={() => playTrackIds(songIds, 0, `playlist:${playlist.id}`)}
          className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold h-14 px-7 text-base rounded-full shadow-[0_8px_28px_rgba(16,185,129,.35)]"
        >
          <Play className="fill-current" style={{ width: 22, height: 22 }} />
          تشغيل الكل
        </Button>
        <Button
          onClick={() => {
            toggleShuffle();
            playTrackIds(songIds, Math.floor(Math.random() * Math.max(1, songIds.length)), `playlist:${playlist.id}`);
          }}
          variant="outline"
          className="border-white/15 h-14 px-6 text-sm rounded-full"
        >
          <Shuffle style={{ width: 18, height: 18 }} className="text-emerald-400" />
          خلط
        </Button>
        <Button
          onClick={() => {
            setShareTarget({
              title: playlist.name,
              subtitle: `${songIds.length} أغنية`,
              link: buildShareLink(playlist.id),
              lines: songIds
                .map((id) => {
                  const t = trackById(id);
                  return t ? `${t.title} — ${t.artist}` : null;
                })
                .filter(Boolean) as string[],
            });
          }}
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-14 px-6 text-sm rounded-full"
        >
          <Share2 style={{ width: 18, height: 18 }} />
          مشاركة + QR
        </Button>
        <Button
          onClick={() => setAddOpen(true)}
          variant="outline"
          className="border-white/15 h-14 px-6 text-sm rounded-full"
        >
          <ListPlus style={{ width: 18, height: 18 }} className="text-amber-400" />
          أضِف أغاني
        </Button>
        <Button
          onClick={() => setRenameOpen(true)}
          variant="outline"
          className="border-white/15 h-14 px-6 text-sm rounded-full"
        >
          <Pencil style={{ width: 18, height: 18 }} />
          إعادة تسمية
        </Button>
        <Button
          onClick={() => setDeleteOpen(true)}
          variant="outline"
          className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 h-14 px-6 text-sm rounded-full"
        >
          <Trash2 style={{ width: 18, height: 18 }} />
          حذف القائمة
        </Button>
      </div>

      {/* tracks */}
      {songIds.length === 0 ? (
        <EmptyState
          icon={<Music2 style={{ width: 26, height: 26 }} />}
          title="القائمة فارغة"
          body="أضِف أغاني من زر «أضِف أغاني» أعلاه أو من أي صف أغنية في المكتبة."
          action={
            <Button onClick={() => setAddOpen(true)} className="bg-emerald-500 text-neutral-950 font-bold h-12 px-6">
              <ListPlus style={{ width: 18, height: 18 }} />
              أضِف أغاني
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={songIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {songIds.map((id, i) => {
                const t = trackById(id);
                if (!t) {
                  // opaque id that came from the Android app — render generically
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-xl px-2.5 py-2 bg-neutral-900/60 border border-white/5"
                    >
                      <div className="h-12 w-12 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-600 shrink-0">
                        <Music2 style={{ width: 20, height: 20 }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-neutral-300 truncate">{id}</p>
                        <p className="text-xs text-neutral-600">مقطع من جهاز آخر — يُشغَّل على تطبيق Android</p>
                      </div>
                      <button
                        onClick={() => removeFromPlaylist(playlist.id, id)}
                        aria-label="إزالة"
                        className="h-11 w-11 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center hover:bg-rose-500/25"
                      >
                        <Trash2 style={{ width: 18, height: 18 }} />
                      </button>
                    </div>
                  );
                }
                return (
                  <SortableRow
                    key={id}
                    track={t}
                    index={i}
                    contextIds={songIds}
                    context={`playlist:${playlist.id}`}
                    onRemove={() => removeFromPlaylist(playlist.id, id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="bg-neutral-900 border-white/10 max-w-md w-[92vw] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة تسمية القائمة</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-12 bg-neutral-950 border-white/10 text-base"
            autoFocus
          />
          <Button
            disabled={!renameValue.trim()}
            onClick={() => {
              renamePlaylist(playlist.id, renameValue);
              setRenameOpen(false);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-12"
          >
            حفظ
          </Button>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-neutral-900 border-white/10" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف «{playlist.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف من كل أجهزتك بعد المزامنة (الضريح الرقمي يضمن ألا يعود).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction
              onClick={() => {
                deletePlaylist(playlist.id);
                setView("playlists");
              }}
              className="bg-rose-500 hover:bg-rose-400 text-neutral-950 font-bold flex-1"
            >
              حذف نهائي
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* add tracks dialog */}
      <AddTracksDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        excludeIds={songIds}
        onAdd={(ids) => openAddToPlaylist(ids)}
      />
    </div>
  );
}

function SortableRow({
  track,
  index,
  contextIds,
  context,
  onRemove,
}: {
  track: RichTrack;
  index: number;
  contextIds: string[];
  context: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 ${isDragging ? "z-50 opacity-80 rounded-xl bg-neutral-800" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="اسحب لإعادة الترتيب"
        className="h-11 w-9 shrink-0 flex items-center justify-center text-neutral-600 hover:text-emerald-400 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical style={{ width: 16, height: 16 }} />
      </button>
      <div className="flex-1 min-w-0">
        <TrackRow track={track} index={index} contextIds={contextIds} context={context} onRemove={onRemove} removeLabel="إزالة من القائمة" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-tracks picker dialog
// ---------------------------------------------------------------------------

function AddTracksDialog({
  open,
  onOpenChange,
  excludeIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  excludeIds: string[];
  onAdd: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const candidates = useMemo(
    () =>
      TRACKS.filter(
        (t) => !excludeIds.includes(t.id) && (q ? t.title.includes(q) || t.artist.includes(q) : true),
      ).slice(0, 60),
    [excludeIds, q],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setSel(new Set());
        setQ("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="bg-neutral-900 border-white/10 max-w-lg w-[92vw] rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="text-emerald-400" style={{ width: 18, height: 18 }} />
            أضِف أغاني إلى القائمة
          </DialogTitle>
          <DialogDescription>{sel.size} مختارة</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" style={{ width: 16, height: 16 }} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث…"
            className="h-11 bg-neutral-950 border-white/10 pr-10"
          />
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1 mt-2 -mx-1 px-1">
          {candidates.map((t) => {
            const checked = sel.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => {
                  const next = new Set(sel);
                  if (checked) next.delete(t.id);
                  else next.add(t.id);
                  setSel(next);
                }}
                className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/5 text-right"
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                    checked ? "bg-emerald-500 text-neutral-950" : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  <Check style={{ width: 16, height: 16 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-neutral-100 truncate">{t.title}</p>
                  <p className="text-xs text-neutral-500 truncate">{t.artist}</p>
                </div>
              </button>
            );
          })}
          {candidates.length === 0 ? (
            <p className="text-center text-sm text-neutral-600 py-6">كل شيء مضاف أو لا نتائج</p>
          ) : null}
        </div>
        <Button
          disabled={sel.size === 0}
          onClick={() => {
            onAdd([...sel]);
            setSel(new Set());
            setQ("");
            onOpenChange(false);
          }}
          className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-12"
        >
          أضِف {sel.size > 0 ? `(${sel.size})` : ""}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Smart playlist detail
// ---------------------------------------------------------------------------

export function SmartDetailView() {
  const { smartId, smartPlaylists, playTrackIds, setView } = useApp();
  const sp = smartPlaylists.find((s) => s.id === smartId) ?? null;

  if (!sp) {
    return (
      <EmptyState
        icon={<Music2 style={{ width: 26, height: 26 }} />}
        title="القائمة الذكية غير موجودة"
        body="تتغير القوائم الذكية يوميًا — عد إلى الرئيسية."
        action={<Button onClick={() => setView("home")} variant="outline" className="h-11">الرئيسية</Button>}
      />
    );
  }

  const ids = sp.trackIds;
  const tracks = ids.map((id) => trackById(id)).filter((t): t is RichTrack => Boolean(t));

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => setView("ai")}
        className="h-11 px-4 mb-4 rounded-full bg-neutral-900/80 border border-white/5 text-sm text-neutral-300 flex items-center gap-2 hover:bg-neutral-800"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        مركز الذكاء
      </button>

      <div
        className="rounded-3xl p-6 md:p-8 mb-6 border border-white/10 relative overflow-hidden"
        style={{ background: `linear-gradient(140deg, ${sp.accent}33, #171717 70%)` }}
      >
        <BetaBadge>قائمة ذكية — تتجدد</BetaBadge>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-3">{sp.title}</h1>
        <p className="text-sm text-neutral-300 mt-2">{sp.subtitle}</p>
        <Button
          onClick={() => playTrackIds(ids, 0, `smart:${sp.id}`)}
          className="mt-5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold h-14 px-7 rounded-full shadow-[0_8px_28px_rgba(16,185,129,.35)]"
        >
          <Play className="fill-current" style={{ width: 22, height: 22 }} />
          تشغيل {ids.length} أغنية
        </Button>
      </div>

      <div className="space-y-1">
        {tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} contextIds={ids} context={`smart:${sp.id}`} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artist detail
// ---------------------------------------------------------------------------

export function ArtistDetailView() {
  const { artistId, artists, playTrackIds, setView, profile } = useApp();
  const artist = artists.find((a) => a.id === artistId) ?? null;
  const affinity = profile?.artistAffinity[artist?.name ?? ""] ?? 0;

  if (!artist) {
    return (
      <EmptyState
        icon={<UserRound style={{ width: 26, height: 26 }} />}
        title="الفنان غير موجود"
        body="عد إلى الرئيسية واختر فنانًا من الدوائر."
        action={<Button onClick={() => setView("home")} variant="outline" className="h-11">الرئيسية</Button>}
      />
    );
  }

  const tracks = TRACKS.filter((t) => t.artistId === artist.id);
  const ids = tracks.map((t) => t.id);
  const pal = GENRE_PALETTE[artist.genre] ?? GENRE_PALETTE["أخرى"];

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => setView("home")}
        className="h-11 px-4 mb-4 rounded-full bg-neutral-900/80 border border-white/5 text-sm text-neutral-300 flex items-center gap-2 hover:bg-neutral-800"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        الرئيسية
      </button>

      <div
        className="rounded-3xl p-6 md:p-8 mb-6 border border-white/10 relative overflow-hidden flex flex-col sm:flex-row items-center gap-6"
        style={{ background: `linear-gradient(to left, ${pal.from}26, #171717)` }}
      >
        <ArtistAvatar image={artist.image} name={artist.name} size={120} />
        <div className="min-w-0 text-center sm:text-right flex-1">
          <BetaBadge>{pal.label}</BetaBadge>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-2">{artist.name}</h1>
          <p className="text-sm text-neutral-300 mt-2 max-w-xl leading-relaxed">{artist.bio}</p>
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Disc3 style={{ width: 14, height: 14 }} />
              {tracks.length} أغنية
            </span>
            <span className="flex items-center gap-1">
              <Heart style={{ width: 14, height: 14 }} className="text-emerald-400" />
              {artist.monthlyListeners.toLocaleString("ar-MA")} مستمع شهريًا
            </span>
            {affinity > 0 ? (
              <span className="flex items-center gap-1 text-emerald-400">
                ذوقك معه {affinity}%
              </span>
            ) : null}
          </div>
          <Button
            onClick={() => playTrackIds(ids, 0, `artist:${artist.id}`)}
            className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold h-14 px-7 rounded-full shadow-[0_8px_28px_rgba(16,185,129,.35)]"
          >
            <Play className="fill-current" style={{ width: 22, height: 22 }} />
            تشغيل أعماله
          </Button>
        </div>
      </div>

      <SectionHeader title="الأغاني" subtitle="مرتبة حسب الألبوم" />
      <div className="space-y-1">
        {tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} contextIds={ids} context={`artist:${artist.id}`} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared-link import view
// ---------------------------------------------------------------------------

export function SharedInView() {
  const { sharedIncoming, importShared, setSharedIncoming, setView } = useApp();
  if (!sharedIncoming) {
    return (
      <EmptyState
        icon={<Share2 style={{ width: 26, height: 26 }} />}
        title="لا قائمة مشتركة"
        body="الرابط غير صالح أو انتهى."
        action={<Button onClick={() => setView("home")} variant="outline" className="h-11">الرئيسية</Button>}
      />
    );
  }

  const matched = sharedIncoming.t.map((entry) => {
    const title = entry.split(" — ")[0]?.trim();
    return TRACKS.find((x) => x.title === title) ?? null;
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-3xl bg-neutral-900/80 border border-emerald-500/25 p-6 md:p-8 text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
          <Share2 style={{ width: 28, height: 28 }} />
        </div>
        <BetaBadge>قائمة مشتركة</BetaBadge>
        <h1 className="text-2xl md:text-3xl font-extrabold mt-3">{sharedIncoming.n}</h1>
        <p className="text-sm text-neutral-400 mt-2">
          {sharedIncoming.t.length} أغنية · أرسلها {sharedIncoming.by || "صديق"}
        </p>

        <div className="max-h-64 overflow-y-auto text-right space-y-1.5 my-6">
          {sharedIncoming.t.map((entry, i) => {
            const t = matched[i];
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-neutral-950/60 border border-white/5 px-3 py-2">
                {t ? <Check className="text-emerald-400 shrink-0" style={{ width: 16, height: 16 }} /> : <Music2 className="text-neutral-600 shrink-0" style={{ width: 16, height: 16 }} />}
                <p className={`text-sm truncate ${t ? "text-neutral-200" : "text-neutral-500"}`}>
                  {entry}
                  {!t ? " — غير موجودة في الكتالوج" : ""}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            onClick={importShared}
            className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold h-12 px-6"
          >
            <ListPlus style={{ width: 18, height: 18 }} />
            أضِفها إلى قوائمي
          </Button>
          <Button
            onClick={() => setSharedIncoming(null)}
            variant="outline"
            className="border-white/15 h-12 px-6"
          >
            تجاهل
          </Button>
        </div>
      </div>
    </div>
  );
}

// Loader used while lazily resolving (reserved for future suspense states)
export function PlaylistLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-neutral-500 gap-2">
      <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
      جارٍ التحميل…
    </div>
  );
}
