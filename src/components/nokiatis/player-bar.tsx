"use client";

/**
 * Player bar — the always-there bottom bar plus the full-screen Now Playing
 * overlay with a live spectrum visualizer (analyser -> canvas), real seek,
 * volume, shuffle/repeat, like, add-to-playlist and share. The halo around
 * the spinning cover is a box-shadow on a rounded-full element — stays
 * perfectly circular in every state.
 */

import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  Heart,
  ListPlus,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Slider } from "@/components/ui/slider";
import { useApp } from "./app-context";
import { TrackCover } from "./shared";
import { audioEngine } from "@/lib/nokiatis-audio";
import { trackById, formatDuration, GENRE_PALETTE, encodeShareBase64 } from "@/lib/nokiatis-data";

export function PlayerBar() {
  const {
    player,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    likedSet,
    toggleLike,
    openAddToPlaylist,
    setShareTarget,
  } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  const track = player.currentTrackId ? trackById(player.currentTrackId) : null;
  const pos = dragging ?? player.positionSec;
  const pal = track ? (GENRE_PALETTE[track.genre] ?? GENRE_PALETTE["أخرى"]) : null;

  if (!track) return null;

  const fmt = (s: number) => formatDuration(Math.max(0, s));

  const shareTrack = () => {
    if (typeof window === "undefined") return;
    const payload = {
      n: track!.title,
      t: [`${track!.title} — ${track!.artist}`],
      by: "Nokiatis",
      v: 1,
    };
    setShareTarget({
      title: track!.title,
      subtitle: `${track!.artist} · ${track!.album} · ${track!.year}`,
      link: `${window.location.origin}/?share=${encodeURIComponent(encodeShareBase64(JSON.stringify(payload)))}`,
      lines: [`${track!.title} — ${track!.artist}`],
    });
  };

  return (
    <>
      {/* ---------------- bottom bar ---------------- */}
      <div className="fixed bottom-[64px] md:bottom-0 inset-x-0 z-40 bg-neutral-925/95 backdrop-blur-xl border-t border-white/10"
        style={{ background: "rgba(10,10,10,.92)" }}
      >
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-2.5 flex items-center gap-3">
          {/* track info */}
          <div className="flex items-center gap-3 min-w-0 w-32 sm:w-56 shrink cursor-pointer" onClick={() => setExpanded(true)} role="button" aria-label="عرض الشاشة الكاملة">
            <TrackCover track={track} size={44} />
            <div className="min-w-0 hidden xs:block">
              <p className="text-sm font-bold text-neutral-100 truncate">{track.title}</p>
              <p className="text-[11px] text-neutral-500 truncate">{track.artist}</p>
            </div>
            <ChevronUp className="text-neutral-600 hidden sm:block shrink-0" style={{ width: 16, height: 16 }} />
          </div>

          {/* controls + progress */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={toggleShuffle}
                aria-label="خلط"
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  player.shuffle ? "text-emerald-400 bg-emerald-500/15" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <Shuffle style={{ width: 16, height: 16 }} />
              </button>
              <button
                onClick={prev}
                aria-label="السابق"
                className="h-11 w-11 rounded-full flex items-center justify-center text-neutral-300 hover:text-white active:scale-90 transition-all"
              >
                <SkipBack className="fill-current" style={{ width: 22, height: 22 }} />
              </button>
              <button
                onClick={togglePlay}
                aria-label={player.playing ? "إيقاف مؤقت" : "تشغيل"}
                className="h-13 w-13 h-[52px] w-[52px] rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-[0_0_22px_rgba(16,185,129,.5)] hover:bg-emerald-400 active:scale-90 transition-all"
              >
                {player.playing ? (
                  <Pause style={{ width: 24, height: 24 }} />
                ) : (
                  <Play className="fill-current" style={{ width: 24, height: 24 }} />
                )}
              </button>
              <button
                onClick={next}
                aria-label="التالي"
                className="h-11 w-11 rounded-full flex items-center justify-center text-neutral-300 hover:text-white active:scale-90 transition-all"
              >
                <SkipForward className="fill-current" style={{ width: 22, height: 22 }} />
              </button>
              <button
                onClick={cycleRepeat}
                aria-label="إعادة"
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  player.repeat !== "off" ? "text-emerald-400 bg-emerald-500/15" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {player.repeat === "one" ? <Repeat1 style={{ width: 16, height: 16 }} /> : <Repeat style={{ width: 16, height: 16 }} />}
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2.5">
              <span className="text-[10px] text-neutral-500 tabular-nums w-9 text-left" dir="ltr">{fmt(pos)}</span>
              <Slider
                dir="ltr"
                value={[Math.min(pos, track.durationSec)]}
                max={track.durationSec}
                step={1}
                onValueChange={(v) => setDragging(v[0])}
                onValueCommit={(v) => {
                  setDragging(null);
                  seek(v[0]);
                }}
                className="flex-1 cursor-pointer [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-emerald-500"
              />
              <span className="text-[10px] text-neutral-500 tabular-nums w-9" dir="ltr">{fmt(track.durationSec)}</span>
            </div>
          </div>

          {/* side actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => toggleLike(track.id)}
              aria-label="المفضلة"
              className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors active:scale-90 ${
                likedSet.has(track.id) ? "text-emerald-400 bg-emerald-500/15" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Heart className={likedSet.has(track.id) ? "fill-emerald-400" : ""} style={{ width: 18, height: 18 }} />
            </button>
            <button
              onClick={() => openAddToPlaylist([track.id])}
              aria-label="أضِف لقائمة"
              className="h-10 w-10 rounded-full hidden sm:flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors active:scale-90"
            >
              <ListPlus style={{ width: 18, height: 18 }} />
            </button>
            <button
              onClick={shareTrack}
              aria-label="مشاركة"
              className="h-10 w-10 rounded-full hidden sm:flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors active:scale-90"
            >
              <Share2 style={{ width: 18, height: 18 }} />
            </button>
            <div className="hidden lg:flex items-center gap-2 w-36">
              <button onClick={toggleMute} aria-label="كتم" className="h-10 w-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-200">
                {player.muted ? <VolumeX style={{ width: 18, height: 18 }} /> : <Volume2 style={{ width: 18, height: 18 }} />}
              </button>
              <Slider
                dir="ltr"
                value={[player.muted ? 0 : Math.round(player.volume * 100)]}
                max={100}
                step={1}
                onValueChange={(v) => setVolume(v[0] / 100)}
                className="flex-1 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-emerald-500"
              />
            </div>
            <button
              onClick={() => setExpanded(true)}
              aria-label="شاشة كاملة"
              className="h-10 w-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors active:scale-90"
            >
              <Maximize2 style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* mobile thin progress */}
        <div className="sm:hidden px-4 pb-1">
          <div className="h-1 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${(pos / Math.max(1, track.durationSec)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ---------------- expanded now playing ---------------- */}
      <AnimatePresence>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{
              background: `radial-gradient(120% 90% at 50% 0%, ${pal?.from ?? "#10b981"}26, #0a0a0a 60%)`,
            }}
          >
            <div className="flex items-center justify-between px-4 md:px-8 h-16 shrink-0">
              <button
                onClick={() => setExpanded(false)}
                aria-label="إغلاق"
                className="h-11 w-11 rounded-full bg-neutral-900/70 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white active:scale-90 transition-all"
              >
                <Minimize2 style={{ width: 20, height: 20 }} />
              </button>
              <p className="text-xs text-neutral-400 font-bold">قيد التشغيل الآن</p>
              <button
                onClick={shareTrack}
                aria-label="مشاركة"
                className="h-11 w-11 rounded-full bg-neutral-900/70 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-emerald-400 active:scale-90 transition-all"
              >
                <Share2 style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
              <div className="max-w-xl mx-auto flex flex-col items-center">
                {/* spinning circular cover with a guaranteed circular halo */}
                <motion.div
                  animate={player.playing ? { rotate: 360 } : { rotate: 0 }}
                  transition={player.playing ? { duration: 22, repeat: Infinity, ease: "linear" } : { duration: 0.4 }}
                  className="rounded-full p-2 my-6"
                  style={{ boxShadow: "0 0 60px 8px rgba(16,185,129,.45), 0 0 120px 20px rgba(16,185,129,.18)" }}
                >
                  <div className="rounded-full">
                    <TrackCover track={track} size={Math.min(300, 300)} rounded="rounded-full" className="!w-[min(62vw,280px)] !h-[min(62vw,280px)]" />
                  </div>
                </motion.div>

                <Visualizer active={player.playing} />

                <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-50 text-center mt-4">{track.title}</h2>
                <p className="text-sm text-neutral-400 mt-1">
                  {track.artist} · {track.album} · {track.year} · {pal?.label}
                </p>

                {/* seek */}
                <div className="w-full mt-5 flex items-center gap-3">
                  <span className="text-[11px] text-neutral-500 tabular-nums w-10 text-left" dir="ltr">{fmt(pos)}</span>
                  <Slider
                    dir="ltr"
                    value={[Math.min(pos, track.durationSec)]}
                    max={track.durationSec}
                    step={1}
                    onValueChange={(v) => setDragging(v[0])}
                    onValueCommit={(v) => {
                      setDragging(null);
                      seek(v[0]);
                    }}
                    className="flex-1 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-range]]:bg-emerald-500"
                  />
                  <span className="text-[11px] text-neutral-500 tabular-nums w-10" dir="ltr">{fmt(track.durationSec)}</span>
                </div>

                {/* controls */}
                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={toggleShuffle}
                    aria-label="خلط"
                    className={`h-11 w-11 rounded-full flex items-center justify-center ${
                      player.shuffle ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    <Shuffle style={{ width: 20, height: 20 }} />
                  </button>
                  <button onClick={prev} aria-label="السابق" className="h-12 w-12 rounded-full flex items-center justify-center text-neutral-200 active:scale-90 transition-all">
                    <SkipBack className="fill-current" style={{ width: 26, height: 26 }} />
                  </button>
                  <button
                    onClick={togglePlay}
                    aria-label={player.playing ? "إيقاف مؤقت" : "تشغيل"}
                    className="h-16 w-16 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-[0_0_36px_rgba(16,185,129,.6)] hover:bg-emerald-400 active:scale-90 transition-all"
                  >
                    {player.playing ? (
                      <Pause style={{ width: 30, height: 30 }} />
                    ) : (
                      <Play className="fill-current" style={{ width: 30, height: 30 }} />
                    )}
                  </button>
                  <button onClick={next} aria-label="التالي" className="h-12 w-12 rounded-full flex items-center justify-center text-neutral-200 active:scale-90 transition-all">
                    <SkipForward className="fill-current" style={{ width: 26, height: 26 }} />
                  </button>
                  <button
                    onClick={cycleRepeat}
                    aria-label="إعادة"
                    className={`h-11 w-11 rounded-full flex items-center justify-center ${
                      player.repeat !== "off" ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {player.repeat === "one" ? <Repeat1 style={{ width: 20, height: 20 }} /> : <Repeat style={{ width: 20, height: 20 }} />}
                  </button>
                </div>

                {/* volume + actions */}
                <div className="w-full max-w-sm mt-4 flex items-center gap-3">
                  <button onClick={toggleMute} aria-label="كتم" className="h-10 w-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-white">
                    {player.muted ? <VolumeX style={{ width: 18, height: 18 }} /> : <Volume2 style={{ width: 18, height: 18 }} />}
                  </button>
                  <Slider
                    dir="ltr"
                    value={[player.muted ? 0 : Math.round(player.volume * 100)]}
                    max={100}
                    step={1}
                    onValueChange={(v) => setVolume(v[0] / 100)}
                    className="flex-1 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => toggleLike(track.id)}
                    aria-label="المفضلة"
                    className={`h-11 px-5 rounded-full flex items-center gap-2 text-sm font-bold transition-colors active:scale-95 ${
                      likedSet.has(track.id)
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-neutral-900/70 text-neutral-300 hover:text-white"
                    }`}
                  >
                    <Heart className={likedSet.has(track.id) ? "fill-emerald-400" : ""} style={{ width: 18, height: 18 }} />
                    {likedSet.has(track.id) ? "في المفضلة" : "أضِف للمفضلة"}
                  </button>
                  <button
                    onClick={() => openAddToPlaylist([track.id])}
                    aria-label="أضِف لقائمة"
                    className="h-11 px-5 rounded-full bg-neutral-900/70 text-neutral-300 hover:text-white text-sm font-bold flex items-center gap-2 active:scale-95 transition-colors"
                  >
                    <ListPlus style={{ width: 18, height: 18 }} />
                    قائمة
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Live spectrum visualizer
// ---------------------------------------------------------------------------

function Visualizer({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let lastDraw = 0;

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - lastDraw < 33) return; // ~30fps cap
      lastDraw = t;

      const analyser = audioEngine.getAnalyser();
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!analyser || !active) {
        // idle: gentle flat line
        ctx.fillStyle = "rgba(16,185,129,.25)";
        for (let i = 0; i < 32; i++) {
          const bw = w / 32;
          ctx.fillRect(i * bw + bw * 0.25, h - 3, bw * 0.5, 3);
        }
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const bars = 40;
      const step = Math.floor(data.length / bars);
      for (let i = 0; i < bars; i++) {
        // mirror-ish layout for RTL aesthetics
        const idx = i < bars / 2 ? i : bars - 1 - i;
        const v = data[idx * step] / 255;
        const bw = w / bars;
        const bh = Math.max(3, v * h);
        const grad = ctx.createLinearGradient(0, h - bh, 0, h);
        grad.addColorStop(0, "rgba(16,185,129,.95)");
        grad.addColorStop(1, "rgba(16,185,129,.25)");
        ctx.fillStyle = grad;
        ctx.fillRect(i * bw + bw * 0.18, h - bh, bw * 0.64, bh);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={54}
      className="w-full max-w-[520px] h-[54px] opacity-90"
      aria-hidden
    />
  );
}
