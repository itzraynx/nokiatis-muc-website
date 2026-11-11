"use client";

/**
 * Nokiatis Intelligence hub — taste radar, top artists, listening trend,
 * LLM-written Arabic insights (POST /api/ai/insights), and the smart
 * playlist row. This is the "AI algorithm" showcase the owner demanded.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  Compass,
  Compass as CompassIcon,
  Flame,
  Gauge,
  Loader2,
  Radar as RadarIcon,
  RefreshCw,
  Sparkles,
  Timer,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useApp } from "./app-context";
import { BetaBadge, Row, SectionHeader, SmartCard, StatPill, TrackRow } from "./shared";
import { genreRadarData, insightsRequestPayload, listeningTrend, similarTrackIds } from "@/lib/nokiatis-ai";
import { KEYS, safeGet, safeSet, trackById, formatLongDuration } from "@/lib/nokiatis-data";

const WARMUP_TARGET = 5;
const INSIGHTS_TTL = 24 * 60 * 60 * 1000;

export function AiView() {
  const {
    profile,
    stats,
    data,
    smartPlaylists,
    playTrackIds,
    openSmart,
    likedSet,
    tracks,
  } = useApp();

  const warmup = Math.min(stats.totalEvents, WARMUP_TARGET);
  const isWarm = warmup >= WARMUP_TARGET;

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const radarData = useMemo(() => genreRadarData(profile), [profile]);
  const trend = useMemo(() => listeningTrend(data.listeningEvents, 14), [data.listeningEvents]);

  const topArtistsChart = useMemo(
    () => stats.topArtists.map((a) => ({ name: a.name, plays: a.plays, score: a.score })),
    [stats.topArtists],
  );

  const favoriteTrackId = useMemo(() => {
    if (!profile) return null;
    const entries = Object.entries(profile.trackAffinity).sort((a, b) => b[1] - a[1]);
    return entries.length > 0 ? entries[0][0] : null;
  }, [profile]);

  const similar = useMemo(() => {
    const fav = favoriteTrackId ? trackById(favoriteTrackId) : null;
    if (!fav) return { source: null, ids: [] as string[] };
    return { source: fav, ids: similarTrackIds(fav, tracks, profile, 10) };
  }, [favoriteTrackId, profile, tracks]);

  // load cached insights on mount
  useEffect(() => {
    const cached = safeGet<{ text: string; ts: number; hash: string } | null>(KEYS.insightsCache, null);
    if (cached && Date.now() - cached.ts < INSIGHTS_TTL && cached.text) {
      setInsight(cached.text);
    }
  }, []);

  const payloadHash = useMemo(() => {
    const payload = insightsRequestPayload(profile, stats, tracks, [...likedSet].slice(0, 5));
    return JSON.stringify(payload);
  }, [profile, stats, tracks, likedSet]);

  const analyze = useCallback(async () => {
    setInsightLoading(true);
    setInsightError(null);
    try {
      const payload = insightsRequestPayload(profile, stats, tracks, [...likedSet].slice(0, 5));
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok: boolean; text?: string; error?: string };
      if (!body.ok || !body.text) throw new Error(body.error ?? "تعذر التحليل");
      setInsight(body.text);
      safeSet(KEYS.insightsCache, { text: body.text, ts: Date.now(), hash: payloadHash });
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : "تعذر الاتصال بمحرك الذكاء");
    } finally {
      setInsightLoading(false);
    }
  }, [profile, stats, tracks, likedSet, payloadHash]);

  const totalHours = ((profile?.totalSeconds ?? 0) / 3600).toFixed(1);

  return (
    <div className="max-w-6xl mx-auto">
      {/* hero */}
      <div className="relative rounded-3xl border border-emerald-500/25 overflow-hidden p-6 md:p-8 mb-6"
        style={{ background: "linear-gradient(135deg, rgba(16,185,129,.16), #131315 65%)" }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_34px_rgba(16,185,129,.55)]">
              <Brain className="text-neutral-950" style={{ width: 30, height: 30 }} />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-emerald-400/60"
              animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-4xl font-extrabold">Nokiatis Intelligence</h1>
            <p className="text-sm text-neutral-300 mt-1">
              محرك ذوقك — يتعلم من كل ثانية استماع ويحفظ ملفك في السحابة ليتذكرك على كل جهاز.
            </p>
          </div>
        </div>
      </div>

      {/* warm-up */}
      {!isWarm ? (
        <div className="rounded-2xl bg-neutral-900/70 border border-amber-500/25 p-5 mb-6">
          <p className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-2">
            <Sparkles style={{ width: 16, height: 16 }} className="text-amber-400" />
            المحرك في وضع الإحماء
          </p>
          <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
            شغّل {WARMUP_TARGET} جلسات استماع (حتى لو قصيرة) وسيبدأ الذكاء ببناء ملف ذوقك الفوري —
            كل تشغيل، تخطٍّ، أو إعجاب إشارة يتعلم منها.
          </p>
          <div className="flex items-center gap-3">
            <Progress value={(warmup / WARMUP_TARGET) * 100} className="h-2 flex-1 bg-neutral-800" />
            <span className="text-xs text-amber-400 font-bold tabular-nums">{warmup}/{WARMUP_TARGET}</span>
          </div>
        </div>
      ) : null}

      {/* stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
        <StatPill label="جلسة استماع" value={String(stats.totalEvents)} icon={<Activity style={{ width: 18, height: 18 }} />} />
        <StatPill label="ساعة استماع" value={totalHours} icon={<Timer style={{ width: 18, height: 18 }} />} />
        <StatPill label="أيام متتالية" value={String(profile?.streakDays ?? 0)} icon={<Flame style={{ width: 18, height: 18 }} />} />
        <StatPill label="تنوع الذوق" value={`${Math.round((profile?.diversity ?? 0) * 100)}%`} icon={<Compass style={{ width: 18, height: 18 }} />} />
      </div>

      {/* LLM insights */}
      <section className="mb-6">
        <SectionHeader
          title="قراءة الذكاء في ذوقك"
          subtitle="تحليل نصي يكتبه المحرك بالعربية — يتجدد كل 24 ساعة"
          icon={<RadarIcon style={{ width: 20, height: 20 }} />}
        />
        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-5">
          {insightLoading ? (
            <div className="space-y-2.5">
              <div className="h-4 rounded bg-neutral-800 animate-pulse w-3/4" />
              <div className="h-4 rounded bg-neutral-800 animate-pulse w-full" />
              <div className="h-4 rounded bg-neutral-800 animate-pulse w-5/6" />
            </div>
          ) : insight ? (
            <div className="text-sm leading-8 text-neutral-200 whitespace-pre-line">{insight}</div>
          ) : insightError ? (
            <p className="text-sm text-rose-400">{insightError}</p>
          ) : (
            <p className="text-sm text-neutral-500 leading-relaxed">
              {isWarm
                ? "ملف ذوقك جاهز — اطلب من المحرك قراءته الآن."
                : "أكمل الإحماء أولًا ثم اطلب التحليل."}
            </p>
          )}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              onClick={() => void analyze()}
              disabled={insightLoading}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-11 px-5 rounded-full"
            >
              {insightLoading ? (
                <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
              ) : (
                <Brain style={{ width: 16, height: 16 }} />
              )}
              {insightLoading ? "المحرك يحلل…" : "حلّل ذوقي الآن"}
            </Button>
            {insight ? (
              <Button
                variant="outline"
                onClick={() => void analyze()}
                className="border-white/15 h-11 rounded-full"
              >
                <RefreshCw style={{ width: 16, height: 16 }} />
                تحديث القراءة
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {/* charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-4">
          <p className="text-sm font-bold text-neutral-200 mb-3 flex items-center gap-2">
            <RadarIcon style={{ width: 15, height: 15 }} className="text-emerald-400" />
            خريطة أنواعك الموسيقية
          </p>
          <div className="h-56" dir="ltr">
            {radarData.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,.08)" />
                  <PolarAngleAxis dataKey="genre" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
                  <Radar dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.45} />
                  <Tooltip
                    contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
                شغّل أغاني من أنواع مختلفة لتكتمل الخريطة
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-4">
          <p className="text-sm font-bold text-neutral-200 mb-3 flex items-center gap-2">
            <BarChart3 style={{ width: 15, height: 15 }} className="text-amber-400" />
            فنانوك الأكثر تشغيلًا
          </p>
          <div className="h-56" dir="ltr">
            {topArtistsChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topArtistsChart}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#a3a3a3", fontSize: 10 }} interval={0} tickFormatter={(v: string) => v.split(" ")[0]} />
                  <YAxis tick={{ fill: "#737373", fontSize: 10 }} width={24} />
                  <Tooltip
                    contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }}
                    cursor={{ fill: "rgba(16,185,129,.08)" }}
                  />
                  <Bar dataKey="plays" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
                لا بيانات بعد — شغّل ما تحب
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-4 mb-6">
        <p className="text-sm font-bold text-neutral-200 mb-3 flex items-center gap-2">
          <Gauge style={{ width: 15, height: 15 }} className="text-emerald-400" />
          نبض الاستماع — آخر ١٤ يومًا (بالدقائق)
        </p>
        <div className="h-48" dir="ltr">
          {trend.some((d) => d.minutes > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="emeraldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#737373", fontSize: 10 }} />
                <YAxis tick={{ fill: "#737373", fontSize: 10 }} width={24} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }}
                />
                <Area type="monotone" dataKey="minutes" stroke="#10b981" strokeWidth={2} fill="url(#emeraldFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
              ابدأ الاستماع وسيرسم النبض هنا
            </div>
          )}
        </div>
      </div>

      {/* smart playlists */}
      <section className="mb-6">
        <SectionHeader
          title="قوائمك الذكية"
          subtitle="تتجدد كل يوم تلقائيًا"
          icon={<CompassIcon style={{ width: 20, height: 20 }} />}
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

      {/* similar to favorite */}
      {similar.source ? (
        <section className="mb-6">
          <SectionHeader
            title={`لأنك أحببت «${similar.source.title}»`}
            subtitle="توصيات قريبة من روح أغنيتك المفضلة"
            icon={<Sparkles style={{ width: 20, height: 20 }} />}
          />
          <div className="space-y-1">
            {similar.ids.map((id, i) => {
              const t = trackById(id);
              if (!t) return null;
              return (
                <TrackRow key={id} track={t} index={i} contextIds={similar.ids} context="similar" />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* profile meta */}
      <div className="rounded-2xl bg-neutral-900/60 border border-white/5 p-4 text-xs text-neutral-500 flex flex-wrap gap-x-5 gap-y-2">
        <span>إجمالي الوقت: {formatLongDuration(profile?.totalSeconds ?? 0)}</span>
        <span>نسبة الإكمال: {Math.round((profile?.avgCompletion ?? 0) * 100)}%</span>
        <span>ولاء الفنانين: {Math.round((profile?.loyalty ?? 0) * 100)}%</span>
        <span>روح الاستكشاف: {Math.round((profile?.exploration ?? 0) * 100)}%</span>
        <span>وقتك المفضل: {stats.favoriteHourLabel}</span>
        <span>{stats.completionLabel}</span>
        <BetaBadge>يُحفظ ملفك في السحابة ويتبعك بين الأجهزة</BetaBadge>
      </div>
    </div>
  );
}
