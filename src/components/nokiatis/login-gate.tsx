"use client";

/**
 * Login gate — obligatory first screen (owner's product law since 1.17):
 * sign in / sign up to Nokiatis Cloud, or an explicit guest mode with a
 * data-loss warning. The hero background is generated AI art.
 */

import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Lock,
  ShieldCheck,
  Sparkles,
  UserRound,
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
import { BetaBadge } from "./shared";

export function LoginGate() {
  const { doSignIn, doSignUp, continueAsGuest } = useApp();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestWarn, setGuestWarn] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.includes("@") || password.length < 6) {
      setError("أدخل بريدًا صحيحًا وكلمة مرور من 6 أحرف على الأقل.");
      return;
    }
    setBusy(true);
    const ok =
      mode === "signin" ? await doSignIn(email, password) : await doSignUp(email, password);
    setBusy(false);
    if (!ok) setError("تعذّر إتمام العملية — تحقق من بياناتك.");
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
      {/* hero background */}
      <div className="absolute inset-0 -z-10">
       
        <img
          src="/banners/ai-intelligence.png"
          alt=""
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-neutral-950/40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_34px_rgba(16,185,129,.55)]">
              <Brain className="text-neutral-950" style={{ width: 28, height: 28 }} />
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-extrabold tracking-tight">Nokiatis MUC</h1>
              <p className="text-xs text-neutral-400">مشغّل الموسيقى الذكي</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <BetaBadge>الإصدار 1.17.3-beta.1</BetaBadge>
            <span className="text-[11px] text-neutral-500">قناة بيتا للاختبار قبل إصدار 1.18</span>
          </div>
        </div>

        <div className="rounded-3xl bg-neutral-900/80 border border-white/10 backdrop-blur-xl p-6 shadow-2xl">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full bg-neutral-950/60 mb-4">
              <TabsTrigger value="signin" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-neutral-950 font-bold">
                تسجيل الدخول
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-neutral-950 font-bold">
                حساب جديد
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3">
              <label className="text-xs font-bold text-neutral-400">البريد الإلكتروني</label>
              <Input
                dir="ltr"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.com"
                className="h-12 bg-neutral-950/70 border-white/10 text-base"
              />
            </TabsContent>
            <TabsContent value="signup" className="space-y-3">
              <label className="text-xs font-bold text-neutral-400">البريد الإلكتروني</label>
              <Input
                dir="ltr"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.com"
                className="h-12 bg-neutral-950/70 border-white/10 text-base"
              />
            </TabsContent>
          </Tabs>

          <div className="mt-1">
            <label className="text-xs font-bold text-neutral-400">كلمة المرور</label>
            <div className="relative">
              <Input
                dir="ltr"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 bg-neutral-950/70 border-white/10 text-base pl-12"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-neutral-500 hover:text-neutral-300"
              >
                {showPass ? <EyeOff style={{ width: 20, height: 20 }} /> : <Eye style={{ width: 20, height: 20 }} />}
              </button>
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2 border border-rose-500/20">
              {error}
            </p>
          ) : null}

          <Button
            onClick={submit}
            disabled={busy}
            className="w-full h-12 mt-5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold text-base shadow-[0_8px_24px_rgba(16,185,129,.3)]"
          >
            {busy ? (
              <Loader2 className="animate-spin" style={{ width: 22, height: 22 }} />
            ) : mode === "signin" ? (
              <LogIn style={{ width: 22, height: 22 }} />
            ) : (
              <UserRound style={{ width: 22, height: 22 }} />
            )}
            {mode === "signin" ? "دخول ومزامنة مكتبتي" : "إنشاء الحساب"}
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] text-neutral-600">أو</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            variant="outline"
            onClick={() => setGuestWarn(true)}
            className="w-full h-11 border-white/15 text-neutral-300"
          >
            <UserRound style={{ width: 18, height: 18 }} />
            المتابعة كزائر
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { icon: <Brain style={{ width: 16, height: 16 }} />, t: "Nokiatis Intelligence", s: "يتعلم ذوقك" },
            { icon: <Cloud style={{ width: 16, height: 16 }} />, t: "مزامنة سحابية", s: "كل أجهزتك" },
            { icon: <ShieldCheck style={{ width: 16, height: 16 }} />, t: "خزنة سحابية", s: "بكلمة مرور" },
          ].map((f) => (
            <div key={f.t} className="rounded-xl bg-neutral-900/60 border border-white/5 p-3 text-center">
              <div className="mx-auto h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1.5">
                {f.icon}
              </div>
              <p className="text-[11px] font-bold text-neutral-200 truncate">{f.t}</p>
              <p className="text-[10px] text-neutral-500">{f.s}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] text-neutral-600 mt-5 flex items-center justify-center gap-1.5">
          <Sparkles style={{ width: 12, height: 12 }} className="text-emerald-500" />
          بالدخول تُزامَن مكتبتك وقوائمك وملف ذوقك تلقائيًا مع Nokiatis Cloud
        </p>
      </motion.div>

      <AlertDialog open={guestWarn} onOpenChange={setGuestWarn}>
        <AlertDialogContent className="bg-neutral-900 border-white/10" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-amber-400" style={{ width: 20, height: 20 }} />
              تنبيه وضع الزائر
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              في وضع الزائر، كل بياناتك (المفضلة، القوائم، السجل، وملف الذكاء) تبقى
              <span className="text-amber-300 font-bold"> على هذا الجهاز فقط</span>. إن حذفت التطبيق أو
              مسحت بيانات المتصفح فستفقدها للأبد ولا يمكن استرجاعها. سجّل الدخول لاحقًا لحفظ كل شيء في السحابة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction
              onClick={continueAsGuest}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold flex-1"
            >
              <Lock style={{ width: 16, height: 16 }} />
              فهمت — أكمل كزائر
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1">تسجيل الدخول بدلًا من ذلك</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
