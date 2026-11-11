"use client";

/**
 * History — grouped timeline (today / yesterday / date) with per-entry play
 * and stats header. Clearing honours the historyClearedAt tombstone.
 */

import { useMemo } from "react";
import { History as HistoryIcon, Play, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { useState } from "react";
import { useApp } from "./app-context";
import { EmptyState, SectionHeader, TrackCover, BetaBadge } from "./shared";
import { formatRelativeTime, formatArabicDate, trackById } from "@/lib/nokiatis-data";
import type { HistoryEntry } from "@/lib/nokiatis-cloud";

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  if (same(d, today)) return "اليوم";
  if (same(d, yesterday)) return "أمس";
  return formatArabicDate(ts);
}

export function HistoryView() {
  const { data, clearHistory, playTrackIds } = useApp();
  const [confirm, setConfirm] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const h of data.history.slice(0, 300)) {
      const key = dayLabel(h.playedAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    return [...map.entries()];
  }, [data.history]);

  const totalMinutes = Math.round((data.tasteProfile?.totalSeconds ?? 0) / 60);

  return (
    <div className="max-w-3xl mx-auto">
      <SectionHeader
        title="سجل الاستماع"
        subtitle={`${data.history.length} جلسة · ${totalMinutes} دقيقة · ${data.listeningEvents.length} حدث ذكاء`}
        icon={<HistoryIcon style={{ width: 20, height: 20 }} />}
        action={
          data.history.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => setConfirm(true)}
              className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 h-11 rounded-full"
            >
              <Trash2 style={{ width: 16, height: 16 }} />
              حذف السجل
            </Button>
          ) : null
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon style={{ width: 26, height: 26 }} />}
          title="السجل فارغ"
          body="كل أغنية تشغّلها هنا تُسجَّل محليًا وتُزامَن مع السحابة — وتُغذي ملف ذوقك."
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([day, entries]) => (
            <section key={day}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-extrabold text-neutral-200">{day}</h3>
                <BetaBadge>{entries.length} جلسة</BetaBadge>
              </div>
              <div className="space-y-1">
                {entries.map((h, i) => {
                  const t = trackById(h.trackId);
                  if (!t) return null;
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => playTrackIds([h.trackId], 0, "history")}
                    >
                      <TrackCover track={t} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-neutral-100 truncate">{t.title}</p>
                        <p className="text-xs text-neutral-500 truncate">
                          {t.artist} · {formatRelativeTime(h.playedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playTrackIds([h.trackId], 0, "history");
                        }}
                        aria-label="تشغيل"
                        className="h-11 w-11 rounded-full bg-neutral-800/80 text-neutral-300 hover:bg-emerald-500 hover:text-neutral-950 flex items-center justify-center transition-colors active:scale-90"
                      >
                        <Play className="fill-current" style={{ width: 18, height: 18 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="bg-neutral-900 border-white/10" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="text-rose-400" style={{ width: 18, height: 18 }} />
              حذف سجل الاستماع بالكامل؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              يُحذف السجل من كل أجهزتك بعد المزامنة (عبر ختم historyClearedAt). ملف الذكاء
              وأحداثه يبقى ليتابع ترشيحاته.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction onClick={clearHistory} className="bg-rose-500 hover:bg-rose-400 text-neutral-950 font-bold flex-1">
              حذف
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {data.history.length > 0 ? (
        <p className="text-center text-[11px] text-neutral-600 mt-6 flex items-center justify-center gap-1.5">
          <Sparkles style={{ width: 12, height: 12 }} className="text-emerald-500" />
          هذا السجل هو وقود «Nokiatis Intelligence» — كل جلسة تجعل الترشيحات أدق.
        </p>
      ) : null}
    </div>
  );
}
