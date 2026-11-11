"use client";

/**
 * The Vault (المفضلة / الخزنة السحابية) — the owner's explicit demand:
 * a favorites page on the website where you can see ALL of your cloud
 * storage and manage it — gated behind a password (account password when
 * signed in, a local PIN for guests).
 */

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Cloud,
  Database,
  FileJson,
  HardDrive,
  Heart,
  KeyRound,
  ListMusic,
  Loader2,
  Lock,
  LockKeyhole,
  LogIn,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { BetaBadge, SectionHeader, EmptyState } from "./shared";
import { formatRelativeTime, trackById } from "@/lib/nokiatis-data";

export function VaultView() {
  const { vaultUnlocked } = useApp();

  if (!vaultUnlocked) {
    return <VaultGate />;
  }

  return <VaultManager />;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

function VaultGate() {
  const { sync, unlockVault, vaultConfig, setGuestPin } = useApp();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  // guest PIN setup flow
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinHint, setPinHint] = useState("");
  const [justSetPin, setJustSetPin] = useState<string | null>(null);

  const isGuest = !sync.signedIn;
  const needsSetup = isGuest && !vaultConfig.enabled;

  const attemptUnlock = async () => {
    setError(null);
    if (!secret) {
      setError("أدخل كلمة المرور / الرمز السري");
      return;
    }
    setBusy(true);
    const ok = await unlockVault(secret);
    setBusy(false);
    if (!ok) {
      setError(
        sync.signedIn
          ? "كلمة المرور غير صحيحة — تحقق من كلمة مرور حسابك في Nokiatis Cloud"
          : "الرمز السري غير صحيح",
      );
      setShake((s) => s + 1);
      setSecret("");
    }
  };

  // after a successful PIN setup, unlock automatically with the fresh config
  useEffect(() => {
    if (justSetPin && vaultConfig.enabled) {
      const t = setTimeout(() => {
        void unlockVault(justSetPin);
      }, 80);
      return () => clearTimeout(t);
    }
  }, [justSetPin, vaultConfig.enabled]);

  const setupPin = () => {
    if (!/^\d{4,8}$/.test(pin)) {
      setError("الرمز يجب أن يكون من ٤ إلى ٨ أرقام");
      return;
    }
    if (pin !== pinConfirm) {
      setError("الرمزان غير متطابقان");
      return;
    }
    setGuestPin(pin, pinHint);
    setJustSetPin(pin);
  };

  return (
    <div className="max-w-md mx-auto pt-6">
      <div className="text-center mb-7">
        <motion.div
          animate={{ boxShadow: ["0 0 24px 4px rgba(16,185,129,.35)", "0 0 40px 8px rgba(16,185,129,.55)", "0 0 24px 4px rgba(16,185,129,.35)"] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="mx-auto h-20 w-20 rounded-full bg-neutral-900 border-2 border-emerald-500/40 flex items-center justify-center mb-4"
        >
          <LockKeyhole className="text-emerald-400" style={{ width: 34, height: 34 }} />
        </motion.div>
        <h1 className="text-2xl font-extrabold">الخزنة السحابية</h1>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          مفضلتك الكاملة: كل ما يُحفظ في Nokiatis Cloud — القوائم، المفضلة، التنزيلات،
          السجل، وملف الذكاء — تُدار من هنا.
        </p>
        <BetaBadge>محمية بكلمة مرور</BetaBadge>
      </div>

      <motion.div
        key={shake}
        animate={shake > 0 ? { x: [0, -10, 10, -8, 8, 0] } : {}}
        className="rounded-3xl bg-neutral-900/80 border border-white/10 p-6"
      >
        {needsSetup ? (
          <div className="space-y-4">
            <p className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <KeyRound style={{ width: 16, height: 16 }} className="text-amber-400" />
              أنشئ رمزًا سريًا للخزنة (وضع الزائر)
            </p>
            <div>
              <label className="text-xs text-neutral-500">رمز من ٤–٨ أرقام</label>
              <Input
                dir="ltr"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="h-12 bg-neutral-950 border-white/10 text-lg tracking-[0.4em]"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">أكّد الرمز</label>
              <Input
                dir="ltr"
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                className="h-12 bg-neutral-950 border-white/10 text-lg tracking-[0.4em]"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">تلميح (اختياري)</label>
              <Input
                value={pinHint}
                onChange={(e) => setPinHint(e.target.value)}
                className="h-11 bg-neutral-950 border-white/10"
                placeholder="مثال: رقم أحبه"
              />
            </div>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <Button onClick={setupPin} className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold">
              <Unlock style={{ width: 18, height: 18 }} />
              تفعيل الخزنة وفتحها
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              {sync.signedIn ? (
                <>
                  <LogIn style={{ width: 14, height: 14 }} className="text-emerald-400" />
                  أدخل كلمة مرور حسابك — يُتصحّح مباشرة عبر Nokiatis Cloud
                </>
              ) : (
                <>
                  <KeyRound style={{ width: 14, height: 14 }} className="text-amber-400" />
                  أدخل رمز الخزنة السري
                  {vaultConfig.hint ? ` — تلميح: ${vaultConfig.hint}` : ""}
                </>
              )}
            </div>
            <Input
              dir="ltr"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && attemptUnlock()}
              className="h-14 bg-neutral-950 border-white/10 text-lg tracking-[0.3em]"
              placeholder="••••••••"
              autoFocus
            />
            {error ? (
              <p className="text-sm text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2 border border-rose-500/20">{error}</p>
            ) : null}
            <Button
              onClick={attemptUnlock}
              disabled={busy}
              className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold text-base shadow-[0_8px_24px_rgba(16,185,129,.3)]"
            >
              {busy ? <Loader2 className="animate-spin" style={{ width: 22, height: 22 }} /> : <Unlock style={{ width: 22, height: 22 }} />}
              فتح الخزنة
            </Button>
          </div>
        )}
      </motion.div>

      <p className="text-center text-[11px] text-neutral-600 mt-5 leading-relaxed">
        لماذا كلمة مرور؟ حتى لو فتح أحدهم جهازك، مفضلتك وبياناتك السحابية تبقى خلف هذا الباب.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

function VaultManager() {
  const {
    sync,
    data,
    cloudRaw,
    lockVault,
    syncNow,
    wipeCloudData,
    exportBackup,
    importBackup,
    toggleLike,
    toggleDownload,
    deletePlaylist,
    clearHistory,
    version,
  } = useApp();

  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);

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

  const rawJson = useMemo(() => {
    if (sync.signedIn && cloudRaw) return JSON.stringify(cloudRaw, null, 2);
    return JSON.stringify(
      {
        liked: data.liked,
        saved: data.saved,
        downloaded: data.downloaded,
        playlists: data.playlists,
        history: data.history.slice(0, 40),
        listenedSeconds: data.listenedSeconds,
        ai: { events: data.listeningEvents.length, profile: data.tasteProfile },
      },
      null,
      2,
    );
  }, [sync.signedIn, cloudRaw, data]);

  const downloadBackup = () => {
    const backup = exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nokiatis-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="max-w-4xl mx-auto">
      <SectionHeader
        title="الخزنة السحابية"
        subtitle={
          sync.signedIn
            ? "حسابك في Nokiatis Cloud — كل بياناتك تحت بصرك"
            : "وضع الزائر — بيانات هذا الجهاز"
        }
        icon={<ShieldCheck style={{ width: 20, height: 20 }} />}
        action={
          <Button variant="outline" onClick={lockVault} className="border-white/15 h-11 rounded-full">
            <Lock style={{ width: 16, height: 16 }} />
            قفل الخزنة
          </Button>
        }
      />

      {/* status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        <div className="rounded-xl bg-neutral-900/70 border border-white/5 p-3.5">
          <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <ListMusic style={{ width: 13, height: 13 }} className="text-emerald-400" /> قوائم
          </p>
          <p className="text-xl font-extrabold mt-1 tabular-nums">{data.playlists.length}</p>
        </div>
        <div className="rounded-xl bg-neutral-900/70 border border-white/5 p-3.5">
          <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Heart style={{ width: 13, height: 13 }} className="text-emerald-400" /> مفضلة
          </p>
          <p className="text-xl font-extrabold mt-1 tabular-nums">{data.liked.length}</p>
        </div>
        <div className="rounded-xl bg-neutral-900/70 border border-white/5 p-3.5">
          <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Brain style={{ width: 13, height: 13 }} className="text-emerald-400" /> أحداث ذكاء
          </p>
          <p className="text-xl font-extrabold mt-1 tabular-nums">{data.listeningEvents.length}</p>
        </div>
        <div className="rounded-xl bg-neutral-900/70 border border-white/5 p-3.5">
          <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <HardDrive style={{ width: 13, height: 13 }} className="text-emerald-400" /> تخزين الجهاز
          </p>
          <p className="text-xl font-extrabold mt-1 tabular-nums">
            {storage ? mb(storage.usage) : "—"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="lists" dir="rtl">
        <TabsList className="bg-neutral-900/70 grid grid-cols-2 sm:grid-cols-5 w-full mb-4 h-auto">
          <TabsTrigger value="lists" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-neutral-950 text-xs font-bold py-2">القوائم</TabsTrigger>
          <TabsTrigger value="favorites" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-neutral-950 text-xs font-bold py-2">المفضلة</TabsTrigger>
          <TabsTrigger value="downloads" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-neutral-950 text-xs font-bold py-2">التنزيلات</TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-neutral-950 text-xs font-bold py-2">ملف الذكاء</TabsTrigger>
          <TabsTrigger value="raw" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-neutral-950 text-xs font-bold py-2">البيانات الخام</TabsTrigger>
        </TabsList>

        {/* playlists management */}
        <TabsContent value="lists" className="space-y-2">
          {data.playlists.length === 0 ? (
            <EmptyState icon={<ListMusic style={{ width: 24, height: 24 }} />} title="لا قوائم" body="أنشئ قوائم وستُدار من هنا." />
          ) : (
            data.playlists.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-neutral-900/70 border border-white/5 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-neutral-100 truncate">{p.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {p.songIds.length} أغنية · آخر تحديث {formatRelativeTime(p.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deletePlaylist(p.id)}
                  className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 h-9 rounded-full px-3 text-xs"
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                  حذف من السحابة
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        {/* favorites management */}
        <TabsContent value="favorites" className="space-y-2">
          {data.liked.length === 0 ? (
            <EmptyState icon={<Heart style={{ width: 24, height: 24 }} />} title="لا مفضلة بعد" body="أضِف أغانيك للملف بالقلب الأخضر." />
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1 [scrollbar-width:thin]">
              {data.liked.map((id) => {
                const t = trackById(id);
                return (
                  <div key={id} className="flex items-center gap-3 rounded-xl bg-neutral-900/70 border border-white/5 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-100 truncate">{t?.title ?? id}</p>
                      <p className="text-[11px] text-neutral-500 truncate">{t?.artist ?? "مقطع Android"}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleLike(id)}
                      className="border-white/15 h-9 rounded-full px-3 text-xs"
                    >
                      <X style={{ width: 13, height: 13 }} />
                      إزالة
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* downloads management */}
        <TabsContent value="downloads" className="space-y-2">
          {data.downloaded.length === 0 ? (
            <EmptyState icon={<Database style={{ width: 24, height: 24 }} />} title="لا تنزيلات" body="زر التنزيل الكهرماني في المكتبة يجلبها (محاكاة)." />
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1 [scrollbar-width:thin]">
              {data.downloaded.map((id) => {
                const t = trackById(id);
                return (
                  <div key={id} className="flex items-center gap-3 rounded-xl bg-neutral-900/70 border border-white/5 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-100 truncate">{t?.title ?? id}</p>
                      <p className="text-[11px] text-neutral-500 truncate">{t?.artist ?? "مقطع Android"}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDownload(id)}
                      className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 h-9 rounded-full px-3 text-xs"
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                      إزالة من التنزيلات
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* AI profile management */}
        <TabsContent value="ai">
          <div className="rounded-2xl bg-neutral-900/70 border border-white/5 p-5">
            <p className="text-sm font-bold text-neutral-200 mb-3 flex items-center gap-2">
              <Brain style={{ width: 16, height: 16 }} className="text-emerald-400" />
              ملف ذوقك الذي تحمله السحابة
            </p>
            {data.tasteProfile ? (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-neutral-400">
                <span>آخر تحديث: {formatRelativeTime(data.tasteProfile.updatedAt)}</span>
                <span>إجمالي الجلسات: {data.tasteProfile.totalPlays}</span>
                <span>إجمالي الثواني: {data.tasteProfile.totalSeconds}</span>
                <span>متوسط الإكمال: {Math.round(data.tasteProfile.avgCompletion * 100)}%</span>
                <span>أعلى فنان: {Object.entries(data.tasteProfile.artistAffinity)[0]?.[0] ?? "—"}</span>
                <span>أعلى نوع: {Object.entries(data.tasteProfile.genreAffinity)[0]?.[0] ?? "—"}</span>
                <span>أيام متتالية: {data.tasteProfile.streakDays}</span>
                <span>التنوع: {Math.round(data.tasteProfile.diversity * 100)}%</span>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">لم يُبنَ الملف بعد — شغّل الموسيقى أولًا.</p>
            )}
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={clearHistory}
                className="border-white/15 h-9 rounded-full text-xs"
              >
                <Trash2 style={{ width: 13, height: 13 }} />
                حذف سجل الاستماع فقط
              </Button>
            </div>
            <p className="text-[11px] text-neutral-600 mt-3 leading-relaxed">
              لحذف كل ملف الذكاء: استخدم «مسح كل البيانات» أدناه — يمسح القوائم والمفضلة والسجل
              والأحداث معًا من السحابة.
            </p>
          </div>
        </TabsContent>

        {/* raw JSON */}
        <TabsContent value="raw">
          <div className="rounded-2xl bg-neutral-950 border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/70 border-b border-white/5">
              <p className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                <FileJson style={{ width: 14, height: 14 }} className="text-emerald-400" />
                {sync.signedIn ? "payload — صف nokiatis_sync" : "نسخة محلية (زائر)"}
              </p>
              <button
                onClick={() => void navigator.clipboard.writeText(rawJson).catch(() => undefined)}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <Save style={{ width: 13, height: 13 }} /> نسخ
              </button>
            </div>
            <pre className="max-h-96 overflow-auto p-4 text-[11px] leading-5 text-neutral-400" dir="ltr">
              {rawJson.slice(0, 4000)}
              {rawJson.length > 4000 ? "\n… (معروض جزئيًا — انسخه كاملًا من زر النسخ)" : ""}
            </pre>
          </div>
        </TabsContent>
      </Tabs>

      {/* bottom actions */}
      <div className="flex flex-wrap gap-2 mt-5">
        {sync.signedIn ? (
          <Button onClick={() => void syncNow()} variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-11 rounded-full">
            <RefreshCw style={{ width: 16, height: 16 }} />
            مزامنة الآن
          </Button>
        ) : null}
        <Button onClick={downloadBackup} variant="outline" className="border-white/15 h-11 rounded-full">
          <Save style={{ width: 16, height: 16 }} />
          تصدير نسخة JSON
        </Button>
        <Button onClick={() => setImportOpen(true)} variant="outline" className="border-white/15 h-11 rounded-full">
          <Upload style={{ width: 16, height: 16 }} />
          استيراد نسخة
        </Button>
        <Button
          onClick={() => setWipeOpen(true)}
          variant="outline"
          className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 h-11 rounded-full"
        >
          <Trash2 style={{ width: 16, height: 16 }} />
          مسح كل بيانات {sync.signedIn ? "السحابة" : "الجهاز"}
        </Button>
      </div>

      <p className="text-[11px] text-neutral-600 mt-4 flex items-center gap-1.5">
        <Cloud style={{ width: 12, height: 12 }} className="text-emerald-500" />
        المشغل v{version} — الخزنة تُقفل تلقائيًا عند تسجيل الخروج أو تحديث الصفحة.
      </p>

      {/* wipe confirm */}
      <AlertDialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <AlertDialogContent className="bg-neutral-900 border-white/10" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="text-rose-400" style={{ width: 18, height: 18 }} />
              مسح كل البيانات؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sync.signedIn
                ? "تُحذف كل بياناتك من Nokiatis Cloud (القوائم، المفضلة، التنزيلات، السجل، وملف الذكاء) ويُحفظ الضريح الرقمي لمنع عودتها عبر المزامنة."
                : "تُحذف كل بيانات هذا الجهاز المحلية نهائيًا — لا يمكن التراجع دون نسخة احتياطية."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction
              onClick={() => {
                if (sync.signedIn) void wipeCloudData();
                else {
                  localStorage.removeItem("nmuc.guest.v1");
                  window.location.reload();
                }
              }}
              className="bg-rose-500 hover:bg-rose-400 text-neutral-950 font-bold flex-1"
            >
              نعم — امسح كل شيء
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* import dialog */}
      <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 max-w-lg" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Upload style={{ width: 18, height: 18 }} className="text-emerald-400" />
              استيراد نسخة احتياطية
            </AlertDialogTitle>
            <AlertDialogDescription>
              الصق محتوى ملف JSON الذي صدّرته سابقًا — يُدمج مع بياناتك الحالية (اتحاد، بلا حذف).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            dir="ltr"
            rows={6}
            placeholder='{"kind":"nokiatis-guest-backup",…}'
            className="w-full rounded-xl bg-neutral-950 border border-white/10 p-3 text-[11px] text-neutral-300 resize-none"
          />
          {importMsg ? <p className="text-xs text-emerald-400 mt-1">{importMsg}</p> : null}
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction
              onClick={() => {
                const ok = importBackup(importText);
                setImportMsg(ok ? "تم الاستيراد بنجاح" : "الملف غير صالح");
                if (ok) setTimeout(() => setImportOpen(false), 900);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold flex-1"
            >
              استيراد
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
