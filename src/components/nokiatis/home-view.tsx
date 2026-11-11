"use client";

/**
 * Home — greeting, auto-rotating hero banners, "Made for you" AI row,
 * recently played, artist circles (perfect circular glow) and playlists.
 */

import { useEffect, useState } from "react";
import {
  Award,
  Brain,
  ChevronLeft,
  ChevronRight,
  Flame,
  ListMusic,
  Play,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useApp } from "./app-context";
import {
  ArtistAvatar,
  PlaylistCard,
  Row,
  SectionHeader,
  SmartCard,
  StatPill,
  TrackCover,
  BetaBadge,
} from "./shared";
import { greeting } from "./shell";
import { artistOfTheWeek } from "@/lib/nokiatis-ai";
import { GENRE_PALETTE, trackById, formatLongDuration } from "@/lib/nokiatis-data";

// ---------------------------------------------------------------------------
// Banner carousel
// ---------------------------------------------------------------------------

const BANNERS = [
  {
    image: "/banners/ai-intelligence.png",
    title: "Nokiatis Intelligence",
    body: "محرك يتعلم ذوقك من كل ثانية استماع ويرشّح لك مزيجًا جديدًا كل يوم.",
    cta: "اكتشف الذكاء",
    view: "ai" as const,
    accent: "from-emerald-500/70",
  },
  {
    image: "/banners/beta-release.png",
    title: "الإصدار 1.17.3-beta.1",
    body: "أكبر تحديث حتى الآن: مشغّل ويب كامل، خزنة سحابية، جودة صوت، وإشعارات تحديث.",
    cta: "ما الجديد",
    view: "settings" as const,
    accent: "from-amber-500/70",
  },
  {
    image: "/banners/cloud-vault.png",
    title: "الخزنة السحابية",
    body: "كل بياناتك في مكان واحد — تُدار وتُحمى بكلمة مرورك، أينما دخلت.",
    cta: "افتح الخزنة",
    view: "vault" as const,
    accent: "from-rose-500/70",
  },
];

function BannerCarousel() {
  const { setView } = useApp();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % BANNERS.length), 7000);
    return () => clearInterval(t);
  }, []);

  const b = BANNERS[index];

  return (
    <div className="relative h-44 md:h-60 rounded-2xl overflow-hidden border border-white/10 mb-6 group select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
          className="absolute inset-0"
        >
         
          <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
          <div className={`absolute inset-0 bg-gradient-to-l ${b.accent} to-transparent via-black/30`} />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-7 text-right">
        <h2 className="text-xl md:text-3xl font-extrabold drop-shadow-lg">{b.title}</h2>
        <p className="text-xs md:text-sm text-neutral-200 mt-1 max-w-md leading-relaxed drop-shadow">
          {b.body}
        </p>
        <button
          onClick={() => setView(b.view)}
          className="mt-3 w-fit h-11 px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-extrabold flex items-center gap-2 shadow-[0_6px_20px_rgba(16,185,129,.4)] active:scale-95 transition-all"
        >
          {b.cta}
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>
      </div>

      <button
        onClick={() => setIndex((i) => (i - 1 + BANNERS.length) % BANNERS.length)}
        aria-label="السابق"
        className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-neutral-950/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur transition-opacity"
      >
        <ChevronRight style={{ width: 20, height: 20 }} />
      </button>
      <button
        onClick={() => setIndex((i) => (i + 1) % BANNERS.length)}
        aria-label="التالي"
        className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-neutral-950/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur transition-opacity"
      >
        <ChevronLeft style={{ width: 20, height: 20 }} />
      </button>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`الشريحة ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-emerald-400" : "w-2 bg-neutral-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini track card (recently played)
// ---------------------------------------------------------------------------

function MiniTrackCard({
  trackId,
  onClick,
}: {
  trackId: string;
  onClick: (i: number, ids: string[]) => void;
}) {
  const { player, togglePlay } = useApp();
  const track = trackById(trackId);
  if (!track) return null;
  const isCurrent = player.currentTrackId === track.id;
  const isPlaying = isCurrent && player.playing;

  return (
    <div
      className="w-[108px] md:w-[124px] shrink-0 rounded-xl bg-neutral-900/70 border border-white/5 p-2 cursor-pointer hover:bg-neutral-800/70 transition-colors active:scale-95"
      onClick={() => onClick(0, [track.id])}
      role="button"
      aria-label={track.title}
    >
      <div className="relative">
        <TrackCover track={track} size={96} className="w-full !h-auto aspect-square rounded-lg" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isCurrent) togglePlay();
            else onClick(0, [track.id]);
          }}
          aria-label={isPlaying ? "إيقاف" : "تشغيل"}
          className={`absolute bottom-1.5 left-1.5 h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isPlaying
              ? "bg-emerald-500 text-neutral-950 shadow-[0_0_16px_rgba(16,185,129,.55)]"
              : "bg-neutral-950/80 text-white opacity-0 hover:opacity-100"
          } ${isPlaying ? "opacity-100" : ""}`}
        >
          <Play className="fill-current" style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <p className={`mt-2 text-[12px] font-bold truncate ${isCurrent ? "text-emerald-400" : "text-neutral-100"}`}>
        {track.title}
      </p>
      <p className="text-[10px] text-neutral-500 truncate">{track.artist}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home view
// ---------------------------------------------------------------------------

export function HomeView() {
  const {
    identity,
    data,
    smartPlaylists,
    stats,
    playTrackIds,
    openSmart,
    openPlaylist,
    openArtist,
    setView,
    artists,
    buildShareLink,
    setShareTarget,
  } = useApp();

  const weekArtist = artistOfTheWeek(data.tasteProfile, artists);
  const recents = data.recents.slice(0, 10).map((id) => id);
  const hasContent = data.playlists.length > 0 || smartPlaylists.length > 0;
  const totalMinutes = Math.round((data.tasteProfile?.totalSeconds ?? 0) / 60);

  return (
    <div className="max-w-6xl mx-auto">
      {/* greeting */}
      <div className="mb-5">
        <h1 className="text-2xl md:text-4xl font-extrabold">
          {greeting()}، <span className="text-emerald-400">{identity.name.split(" ")[0]}</span>
        </h1>
        <p className="text-xs md:text-sm text-neutral-500 mt-1">
          {data.tasteProfile && data.tasteProfile.totalPlays > 0 ? (
            <>
              استمعت {formatLongDuration(data.tasteProfile.totalSeconds)} حتى الآن — والذكاء يتعلم معك
              كل يوم.
            </>
          ) : (
            <>ابدأ بتشغيل أي أغنية وسيبدأ «Nokiatis Intelligence» ببناء ملف ذوقك فورًا.</>
          )}
        </p>
      </div>

      <BannerCarousel />

      {/* quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-7">
        <button onClick={() => setView("ai")} className="text-right" aria-label="إحصائيات الذكاء">
          <StatPill
            label="أغنية استمعتها"
            value={String(stats.tracksHeard)}
            icon={<TrendingUp style={{ width: 18, height: 18 }} />}
          />
        </button>
        <button onClick={() => setView("ai")} className="text-right" aria-label="سلسلة الأيام">
          <StatPill
            label="أيام متتالية"
            value={String(data.tasteProfile?.streakDays ?? 0)}
            icon={<Flame style={{ width: 18, height: 18 }} />}
          />
        </button>
        <button onClick={() => setView("ai")} className="text-right" aria-label="دقائق الاستماع">
          <StatPill
            label="دقيقة استماع"
            value={totalMinutes > 0 ? String(totalMinutes) : "0"}
            icon={<Brain style={{ width: 18, height: 18 }} />}
          />
        </button>
        <button onClick={() => setView("playlists")} className="text-right" aria-label="قوائم التشغيل">
          <StatPill
            label="قائمة تشغيل"
            value={String(data.playlists.length)}
            icon={<ListMusic style={{ width: 18, height: 18 }} />}
          />
        </button>
      </div>

      {/* Made for you */}
      <section className="mb-8">
        <SectionHeader
          title="مصنوع من أجلك"
          subtitle="قوائم ذكية تتجدد يوميًا بحسب ملف ذوقك"
          icon={<Sparkles style={{ width: 20, height: 20 }} />}
        />
        <Row>
          {smartPlaylists.map((sp) => (
            <SmartCard
              key={sp.id}
              title={sp.title}
              subtitle={sp.subtitle}
              accent={sp.accent}
              trackIds={sp.trackIds}
              onOpen={() => openSmart(sp.id)}
              onPlay={() => playTrackIds(sp.trackIds, 0, `smart:${sp.id}`)}
            />
          ))}
        </Row>
      </section>

      {/* Artist of the week + artist circles */}
      <section className="mb-8">
        <SectionHeader
          title="فنانون لك"
          subtitle="دوائر مضيئة — اضغط لاستكشاف الفنان"
          icon={<Award style={{ width: 20, height: 20 }} />}
        />
        {weekArtist ? (
          <button
            onClick={() => openArtist(weekArtist.id)}
            className="w-full mb-4 rounded-2xl overflow-hidden relative h-28 md:h-32 border border-white/10 text-right active:scale-[.99] transition-transform"
            style={{
              background: `linear-gradient(to left, ${(GENRE_PALETTE[weekArtist.genre] ?? GENRE_PALETTE["أخرى"]).from}33, #171717)`,
            }}
            aria-label={`فنان الأسبوع: ${weekArtist.name}`}
          >
            <div className="absolute inset-0 flex items-center gap-4 p-4">
              <ArtistAvatar image={weekArtist.image} name={weekArtist.name} size={80} />
              <div className="min-w-0 flex-1">
                <BetaBadge>فنان الأسبوع</BetaBadge>
                <p className="text-lg md:text-xl font-extrabold truncate mt-1">{weekArtist.name}</p>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  {weekArtist.bio} · {GENRE_PALETTE[weekArtist.genre]?.label ?? weekArtist.genre}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(16,185,129,.5)]">
                <Play className="fill-current" style={{ width: 20, height: 20 }} />
              </div>
            </div>
          </button>
        ) : null}
        <Row>
          {artists.map((a) => (
            <button
              key={a.id}
              onClick={() => openArtist(a.id)}
              className="w-[84px] shrink-0 flex flex-col items-center gap-2 active:scale-95 transition-transform"
              aria-label={a.name}
            >
              <ArtistAvatar image={a.image} name={a.name} size={72} />
              <p className="text-[11px] font-bold text-neutral-300 text-center truncate w-full">{a.name}</p>
            </button>
          ))}
        </Row>
      </section>

      {/* recently played */}
      {recents.length > 0 ? (
        <section className="mb-8">
          <SectionHeader
            title="استمع مجددًا"
            subtitle="آخر ما شغّلته على هذا الجهاز"
            icon={<Play style={{ width: 20, height: 20 }} />}
          />
          <Row>
            {recents.map((id, i) => (
              <MiniTrackCard
                key={id}
                trackId={id}
                onClick={(_, ids) => playTrackIds(ids.length > 1 ? ids : recents, i, "recents")}
              />
            ))}
          </Row>
        </section>
      ) : null}

      {/* your playlists */}
      <section className="mb-4">
        <SectionHeader
          title="قوائمك"
          subtitle={`${data.playlists.length} قائمة — تُزامن تلقائيًا مع السحابة`}
          icon={<ListMusic style={{ width: 20, height: 20 }} />}
        />
        {data.playlists.length > 0 ? (
          <Row>
            {data.playlists.map((p) => (
              <PlaylistCard
                key={p.id}
                name={p.name}
                songIds={p.songIds}
                updatedAt={p.updatedAt}
                onOpen={() => openPlaylist(p.id)}
                onShare={() => {
                  const link = buildShareLink(p.id);
                  setShareTarget({
                    title: p.name,
                    subtitle: `${p.songIds.length} أغنية`,
                    link,
                    lines: p.songIds
                      .map((id) => {
                        const t = trackById(id);
                        return t ? `${t.title} — ${t.artist}` : "";
                      })
                      .filter(Boolean),
                  });
                }}
              />
            ))}
          </Row>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-neutral-500">
            لا قوائم بعد — أنشئ واحدة من قسم «قوائمي».
          </div>
        )}
      </section>
    </div>
  );
}
