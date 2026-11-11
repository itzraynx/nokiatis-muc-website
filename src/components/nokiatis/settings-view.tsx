"use client";

/**
 * Settings — profile identity (saved locally), Spotify-grade audio chain
 * controls (quality / bass / treble / normalization / surround), update
 * notifications (stable + beta), sync log, cache manager and version card.
 */

import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Brain,
  Check,
  Cloud,
  Eye,
  HardDrive,
  Info,
  Loader2,
  LogIn,
  LogOut,
  Music4,
  Pencil,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "./app-context";
import { BetaBadge, ProfileAvatar, SectionHeader } from "./shared";
import { AVATAR_COLORS, KEYS, formatRelativeTime } from "@/lib/nokiatis-data";
import { APP_VERSION } from "@/lib/nokiatis-types";

const EMOJIS = ["🎧", "🎵", "🔥", "🌙", "⭐", "🎤", "🥁", "🎹", "🎧", "✨"];

export function SettingsView() {
  const {
    user,
    identity,
    setIdentity,
    settings,
    setSettings,
    sync,
    doSignOut,
    syncNow,
    notifications,
    dismissNotification,
    requestNotificationPermission,
    updateInfo,
    checkUpdatesNow,
    version,
    exportBackup,
    importBackup,
  } = useApp();
  const { toast } = useToast();

  const [name, setName] = useState(identity.name);
  const [saved, setSaved] = useState(false);
  const [permState, setPermState] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unavailable",
  );
  const [checking, setChecking] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((e) => {
          if (e.usage !== undefined && e.quota !== undefined) {
            setStorage({ usage: e.usage, quota: e.quota });
          }
        })
        .catch(() => undefined);
    }
  }, []);

  const saveProfile = () => {
    setIdentity({ name: name.trim() || "مستمع مجهول" });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const doCheck = async () => {
    setChecking(true);
    await checkUpdatesNow();
    setChecking(false);
    setLastCheck(Date.now());
  };

  const requestPerm = async () => {
    const ok = await requestNotificationPermission();
    setPermState(
      typeof Notification !== "undefined" ? Notification.permission : "unavailable",
    );
    if (ok) {
      // let the user SEE what an update notification looks like
      new Notification("Nokiatis MUC", {
        body: "مثال: سيصل إشعار مثل هذا عند صدور تحديث مستقر أو بيتا.",
      });
    }
  };

  const clearCache = (key: string, label: string) => {
    localStorage.removeItem(key);
    if (key === KEYS.notifications) {
      for (const n of notifications) dismissNotification(n.id);
    }
    if (typeof caches !== "undefined") {
      void caches.keys().then((keys) => {
        for (const k of keys) void caches.delete(k);
      });
    }
    toast({ title: "نُظفت الذاكرة المؤقتة", description: label });
  };

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="max-w-3xl mx-auto space-y-7">
      {/* ------------------------------------------------ profile */}
      <section>
        <SectionHeader
          title="ملفك الشخصي"
          subtitle="أيقونتك واسمك يُحفظان محليًا على هذا الجهاز"
          icon={<Pencil style={{ width: 20, height: 20 }} />}
        />
        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <ProfileAvatar
              name={name || identity.name}
              colorIndex={identity.colorIndex}
              emoji={identity.emoji}
              size={72}
            />
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-neutral-50">{identity.name}</p>
              <p className="text-xs text-neutral-500">
                {sync.signedIn && user ? user.email : "وضع الزائر — بيانات محلية"}
              </p>
              <Badge className="mt-1.5 bg-neutral-800 text-neutral-400 border-white/5 hover:bg-neutral-800">
                {identity.emoji} الأيقونة تُحفظ محليًا
              </Badge>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">الاسم الظاهر</label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 bg-neutral-950 border-white/10 flex-1"
                  placeholder="مستمع مجهول"
                />
                <Button
                  onClick={saveProfile}
                  className="h-12 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold px-5"
                >
                  {saved ? <Check style={{ width: 18, height: 18 }} /> : <Save style={{ width: 18, height: 18 }} />}
                  {saved ? "تم" : "حفظ"}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">لون الأيقونة</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c, i) => (
                  <button
                    key={c}
                    onClick={() => setIdentity({ colorIndex: i })}
                    aria-label={`لون ${i + 1}`}
                    className={`h-11 w-11 rounded-full border-2 transition-all active:scale-90 ${
                      identity.colorIndex === i ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">شعار الأيقونة</label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((e, i) => (
                  <button
                    key={`${e}-${i}`}
                    onClick={() => setIdentity({ emoji: e })}
                    className={`h-11 w-11 rounded-full bg-neutral-950/70 border text-lg flex items-center justify-center transition-all active:scale-90 ${
                      identity.emoji === e ? "border-emerald-500" : "border-white/10"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ audio */}
      <section>
        <SectionHeader
          title="الصوت وجودته"
          subtitle="سلسلة معالجة بمستوى Spotify: توحيد الصوت، باص/تريبل، وتوسيع ستيريو"
          icon={<SlidersHorizontal style={{ width: 20, height: 20 }} />}
        />
        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Music4 style={{ width: 15, height: 15 }} className="text-emerald-400" />
                جودة التشغيل
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                «عالية» تفعّل دوائر الدفء والتوسيع الأوسع — أثقل قليلًا وأغنى بكثير.
              </p>
            </div>
            <Select
              value={settings.audioQuality}
              onValueChange={(v) => setSettings({ audioQuality: v as "normal" | "high" })}
            >
              <SelectTrigger className="h-11 w-32 bg-neutral-950 border-white/10 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/10">
                <SelectItem value="normal">عادية</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-neutral-100">تعزيز الباص</p>
              <span className="text-xs text-emerald-400 font-bold tabular-nums">
                {settings.bass > 0 ? `+${settings.bass}` : settings.bass} dB
              </span>
            </div>
            <Slider
              value={[settings.bass]}
              min={-12}
              max={12}
              step={1}
              onValueChange={(v) => setSettings({ bass: v[0] })}
              dir="ltr"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-neutral-100">وضوح التريبل</p>
              <span className="text-xs text-emerald-400 font-bold tabular-nums">
                {settings.treble > 0 ? `+${settings.treble}` : settings.treble} dB
              </span>
            </div>
            <Slider
              value={[settings.treble]}
              min={-12}
              max={12}
              step={1}
              onValueChange={(v) => setSettings({ treble: v[0] })}
              dir="ltr"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Volume2 style={{ width: 15, height: 15 }} className="text-emerald-400" />
                توحيد مستوى الصوت
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">ضغط ذكي يمنع قفزات الصوت بين الأغاني.</p>
            </div>
            <Switch
              checked={settings.normalization}
              onCheckedChange={(c) => setSettings({ normalization: c })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Eye style={{ width: 15, height: 15 }} className="text-emerald-400" />
                صوت محيطي (توسيع ستيريو)
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">مشهد صوتي أعرض كأنك بين السماعات.</p>
            </div>
            <Switch
              checked={settings.surround}
              onCheckedChange={(c) => setSettings({ surround: c })}
            />
          </div>

          <p className="text-[11px] text-neutral-600 border-t border-white/5 pt-3">
            كل تغيير هنا يُطبّق فورًا على محرك الصوت حتى أثناء التشغيل.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------ notifications */}
      <section>
        <SectionHeader
          title="إشعارات التحديث"
          subtitle="تنبيه فوري عند وصول إصدار — بيتا أو مستقر"
          icon={<BellRing style={{ width: 20, height: 20 }} />}
        />
        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-neutral-100">إشعارات الإصدار المستقر</p>
              <p className="text-xs text-neutral-500 mt-0.5">مثل 1.18 الرسمي القادم.</p>
            </div>
            <Switch checked={settings.notifyUpdates} onCheckedChange={(c) => setSettings({ notifyUpdates: c })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-neutral-100">إشعارات قناة البيتا</p>
              <p className="text-xs text-neutral-500 mt-0.5">مثل 1.17.x-beta — يصل أولًا هنا.</p>
            </div>
            <Switch checked={settings.notifyBeta} onCheckedChange={(c) => setSettings({ notifyBeta: c })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-neutral-100">إشعارات داخل التطبيق</p>
              <p className="text-xs text-neutral-500 mt-0.5">تظهر في مركز الجرس حتى دون إذن المتصفح.</p>
            </div>
            <Switch checked={settings.notifyInApp} onCheckedChange={(c) => setSettings({ notifyInApp: c })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-neutral-100">فحص قناة البيتا</p>
              <p className="text-xs text-neutral-500 mt-0.5">تحقّق من beta.json في مستودع التحديثات.</p>
            </div>
            <Switch checked={settings.betaChannelEnabled} onCheckedChange={(c) => setSettings({ betaChannelEnabled: c })} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={requestPerm}
              variant="outline"
              className="border-white/15 h-11 rounded-full"
            >
              <Bell style={{ width: 16, height: 16 }} />
              {permState === "granted"
                ? "إذن الأذونات ممنوح ✓"
                : permState === "denied"
                  ? "الأذونات مرفوضة"
                  : "اسمح بإشعارات المتصفح"}
            </Button>
            <Button
              onClick={() => void doCheck()}
              disabled={checking}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-11 rounded-full px-5"
            >
              {checking ? (
                <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
              ) : (
                <RefreshCw style={{ width: 16, height: 16 }} />
              )}
              تحقّق الآن من التحديثات
            </Button>
            {lastCheck ? (
              <span className="text-[11px] text-neutral-500">{formatRelativeTime(lastCheck)}</span>
            ) : null}
          </div>

          {updateInfo ? (
            <div className="rounded-xl bg-neutral-950/70 border border-white/5 p-3.5 text-xs space-y-1">
              <p className="text-neutral-300 font-bold flex items-center gap-2">
                <Cloud style={{ width: 14, height: 14 }} className="text-emerald-400" />
                مستودع nokiatis-muc-updates
              </p>
              <p className="text-neutral-500">
                مستقر: {updateInfo.stable ? updateInfo.stable.versionName : "لا يوجد"} ·
                بيتا: {updateInfo.beta ? updateInfo.beta.versionName : "لا يوجد"} · نسختك: {version}
              </p>
              {updateInfo.beta?.notes ? (
                <p className="text-neutral-600 leading-relaxed">{updateInfo.beta.notes.slice(0, 220)}…</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------ sync & account */}
      <section>
        <SectionHeader
          title="الحساب والمزامنة"
          subtitle={sync.signedIn ? "متصل بـ Nokiatis Cloud — اتحاد بلا حذف" : "وضع الزائر — بيانات محلية"}
          icon={<Cloud style={{ width: 20, height: 20 }} />}
        />
        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-5 space-y-4">
          {sync.signedIn ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void syncNow()}
                  disabled={sync.busy}
                  className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold h-11 rounded-full px-5"
                >
                  {sync.busy ? (
                    <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
                  ) : (
                    <RefreshCw style={{ width: 16, height: 16 }} />
                  )}
                  مزامنة الآن
                </Button>
                <Button onClick={() => void doSignOut()} variant="outline" className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 h-11 rounded-full">
                  <LogOut style={{ width: 16, height: 16 }} />
                  تسجيل الخروج
                </Button>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-2">سجل المزامنة (آخر عمليات)</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 [scrollbar-width:thin]">
                  {sync.log.length === 0 ? (
                    <p className="text-xs text-neutral-600">لا عمليات بعد.</p>
                  ) : (
                    sync.log.map((l) => (
                      <div key={l.id} className="flex items-start gap-2 text-[11px] rounded-lg bg-neutral-950/60 border border-white/5 px-2.5 py-2">
                        <span
                          className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                            l.dir === "up" ? "bg-emerald-400" : l.dir === "down" ? "bg-amber-400" : "bg-rose-400"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className={l.ok ? "text-neutral-300" : "text-rose-400"}>{l.summary}</p>
                          <p className="text-neutral-600">{formatRelativeTime(l.ts)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <LogIn style={{ width: 18, height: 18 }} className="text-amber-400" />
              سجّل الدخول من شاشة البداية (سجّل خروجك ثم ادخل) لتفعيل المزامنة السحابية.
            </div>
          )}

          {/* guest backup */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-xs text-neutral-500 mb-2">نسخ احتياطي (زائر / الكل)</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/15 h-11 rounded-full"
                onClick={() => {
                  const backup = exportBackup();
                  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `nokiatis-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Save style={{ width: 16, height: 16 }} />
                تصدير JSON
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const text = await f.text();
                    importBackup(text);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/15 text-sm hover:bg-white/5">
                  استيراد JSON
                </span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ cache */}
      <section>
        <SectionHeader
          title="الذاكرة المؤقتة"
          subtitle="تنظيف ذاكرة umucis: صور، تحليلات ذكاء، إشعارات، صفحات"
          icon={<HardDrive style={{ width: 20, height: 20 }} />}
        />
        <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <HardDrive style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-100 tabular-nums">
                {storage ? `${mb(storage.usage)} مستخدمة من ${mb(storage.quota)}` : "قياس التخزين…"}
              </p>
              <p className="text-[11px] text-neutral-500">حد المتصفح لهذا الموقع</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: KEYS.insightsCache, label: "تحليلات الذكاء" },
              { key: KEYS.updateCache, label: "ذاكرة التحديثات" },
              { key: KEYS.notifications, label: "الإشعارات" },
            ].map((c) => (
              <Button
                key={c.key}
                variant="outline"
                size="sm"
                onClick={() => clearCache(c.key, `نُظفت: ${c.label}`)}
                className="border-white/15 h-9 rounded-full text-xs"
              >
                <Trash2 style={{ width: 13, height: 13 }} />
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ about */}
      <section>
        <SectionHeader title="حول التطبيق" icon={<Info style={{ width: 20, height: 20 }} />} />
        <div className="rounded-2xl bg-gradient-to-l from-emerald-500/10 to-neutral-900/70 border border-emerald-500/20 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-lg font-extrabold">Nokiatis MUC</p>
              <p className="text-xs text-neutral-400">
                نسخة {APP_VERSION} · قناة بيتا · يُختبر الآن لقرارك: إصدار 1.18 رسمي أو بيتا
              </p>
            </div>
            <BetaBadge>beta</BetaBadge>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-neutral-400 leading-relaxed list-disc pr-5">
            <li>Nokiatis Intelligence: ملف ذوق يتعلم من كل جلسة ويُحفظ في السحابة.</li>
            <li>مشغّل ويب بصوت حقيقي (Web Audio) وسلسلة معالجة بمستوى Spotify.</li>
            <li>الخزنة السحابية: إدارة كل بياناتك خلف كلمة المرور.</li>
            <li>إشعارات فورية للتحديثات (مستقر + بيتا) عبر مركز الجرس.</li>
            <li>مشاركة القوائم برابط + رمز QR.</li>
          </ul>
          <p className="text-[11px] text-neutral-600 mt-3 flex items-center gap-1.5">
            <Brain style={{ width: 12, height: 12 }} className="text-emerald-500" />
            من إنتاج Team Nokiatis — Web Launcher الرسمي.
          </p>
        </div>
      </section>
    </div>
  );
}
