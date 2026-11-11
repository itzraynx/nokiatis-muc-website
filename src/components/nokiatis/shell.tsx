"use client";

/**
 * App shell — Spotify-grade chrome:
 *  - desktop: right sidebar (RTL) + top bar
 *  - mobile: bottom tab bar
 *  - notification center (bell) with unread badge
 *  - profile avatar (locally saved) whose green halo is a box-shadow attached
 *    to a rounded-full element — it stays perfectly circular forever.
 */

import { useState } from "react";
import {
  Bell,
  Brain,
  CheckCheck,
  Cloud,
  History as HistoryIcon,
  Home,
  Library,
  ListMusic,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useApp, type AppView } from "./app-context";
import { BetaBadge, ProfileAvatar } from "./shared";
import { formatRelativeTime } from "@/lib/nokiatis-data";

const NAV: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: "home", label: "الرئيسية", icon: <Home style={{ width: 22, height: 22 }} /> },
  { view: "library", label: "المكتبة", icon: <Library style={{ width: 22, height: 22 }} /> },
  { view: "playlists", label: "قوائمي", icon: <ListMusic style={{ width: 22, height: 22 }} /> },
  { view: "ai", label: "الذكاء", icon: <Brain style={{ width: 22, height: 22 }} /> },
  { view: "vault", label: "الخزنة", icon: <Shield style={{ width: 22, height: 22 }} /> },
  { view: "history", label: "السجل", icon: <HistoryIcon style={{ width: 22, height: 22 }} /> },
  { view: "settings", label: "الإعدادات", icon: <Settings style={{ width: 22, height: 22 }} /> },
];

const MOBILE_NAV = NAV.filter((n) =>
  ["home", "library", "ai", "vault", "settings"].includes(n.view),
);

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "صباح الخير";
  if (h >= 12 && h < 17) return "نهار سعيد";
  if (h >= 17 && h < 21) return "مساء الخير";
  return "ليلة موسيقية";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    view,
    setView,
    identity,
    sync,
    syncNow,
    doSignOut,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    dismissNotification,
    version,
  } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-50">
      {/* top bar */}
      <header className="sticky top-0 z-40 bg-neutral-950/85 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 md:px-6 h-16">
          <button
            className="flex items-center gap-3 min-w-0 group"
            onClick={() => setView("home")}
            aria-label="الرئيسية"
          >
            <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(16,185,129,.5)] group-hover:shadow-[0_0_30px_rgba(16,185,129,.7)] transition-shadow">
              <Brain className="text-neutral-950" style={{ width: 22, height: 22 }} />
            </div>
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-sm font-extrabold leading-tight">Nokiatis MUC</p>
              <p className="text-[10px] text-neutral-500 leading-tight">v{version}</p>
            </div>
          </button>

          <div className="flex-1" />

          {sync.signedIn ? (
            <button
              onClick={() => void syncNow()}
              className="hidden md:flex items-center gap-2 h-11 px-4 rounded-full bg-neutral-900/80 border border-white/5 text-xs text-neutral-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
              aria-label="مزامنة الآن"
            >
              {sync.busy ? (
                <Loader2 className="animate-spin text-emerald-400" style={{ width: 16, height: 16 }} />
              ) : (
                <Cloud style={{ width: 16, height: 16 }} className="text-emerald-400" />
              )}
              {sync.busy
                ? "جارٍ المزامنة…"
                : sync.lastSyncAt
                  ? `آخر مزامنة ${formatRelativeTime(sync.lastSyncAt)}`
                  : "مزامنة الآن"}
            </button>
          ) : (
            <Badge className="hidden md:inline-flex bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/10">
              وضع الزائر
            </Badge>
          )}

          {/* notification bell */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative h-11 w-11 rounded-full bg-neutral-900/80 border border-white/5 flex items-center justify-center text-neutral-300 hover:text-emerald-400 transition-colors"
            aria-label={`الإشعارات (${unreadCount} غير مقروءة)`}
          >
            <Bell style={{ width: 20, height: 20 }} />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-neutral-950 text-[11px] font-extrabold flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,.7)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>

          {/* profile avatar — halo attached to the circle itself */}
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="الملف الشخصي">
                <ProfileAvatar
                  name={identity.name}
                  colorIndex={identity.colorIndex}
                  emoji={identity.emoji}
                  size={44}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-neutral-900 border-white/10">
              <DropdownMenuLabel>
                <p className="text-sm font-bold text-neutral-100">{identity.name}</p>
                <p className="text-[11px] text-neutral-500">
                  {sync.signedIn ? "متصل بـ Nokiatis Cloud" : "زائر — بيانات على هذا الجهاز"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => setView("settings")} className="gap-2">
                <Settings style={{ width: 16, height: 16 }} /> الملف والإعدادات
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView("vault")} className="gap-2">
                <Shield style={{ width: 16, height: 16 }} /> الخزنة السحابية
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void syncNow()} className="gap-2">
                <RefreshCw style={{ width: 16, height: 16 }} /> مزامنة الآن
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => void doSignOut()} className="gap-2 text-rose-400 focus:text-rose-300">
                <LogOut style={{ width: 16, height: 16 }} /> تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* desktop sidebar */}
        <aside className="hidden md:flex flex-col gap-1.5 p-3 w-60 shrink-0 border-l border-white/5 bg-neutral-950">
          {NAV.map((item) => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              aria-current={view === item.view ? "page" : undefined}
              className={`h-12 px-4 rounded-xl flex items-center gap-3 text-sm font-bold transition-colors ${
                view === item.view
                  ? "bg-emerald-500/15 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,.25)]"
                  : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="mt-auto p-3 rounded-xl bg-neutral-900/60 border border-white/5">
            <p className="text-[11px] font-bold text-neutral-300 mb-1 flex items-center gap-1.5">
              <Brain style={{ width: 13, height: 13 }} className="text-emerald-400" />
              Nokiatis Intelligence
            </p>
            <p className="text-[10px] text-neutral-500 leading-relaxed">
              {greeting()} يا {identity.name.split(" ")[0]} — دع المحرك يتعلّم ذوقك ويرشّح لك.
            </p>
          </div>
        </aside>

        {/* main scroll area — bottom padding leaves room for player + nav */}
        <main className="flex-1 min-w-0 overflow-y-auto px-4 md:px-7 py-5 pb-[190px] md:pb-[120px]">
          {children}
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-t border-white/5">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              aria-current={view === item.view ? "page" : undefined}
              className={`h-16 flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors ${
                view === item.view ? "text-emerald-400" : "text-neutral-500"
              }`}
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                  view === item.view ? "bg-emerald-500/15 shadow-[0_0_16px_rgba(16,185,129,.35)]" : ""
                }`}
              >
                {item.icon}
              </div>
              {item.label}
            </button>
          ))}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* notification center */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent
          side="left"
          className="bg-neutral-900 border-white/10 w-[92vw] max-w-md p-0 flex flex-col"
          dir="rtl"
        >
          <SheetHeader className="p-4 pb-2 border-b border-white/5 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-neutral-50">
              <Bell className="text-emerald-400" style={{ width: 18, height: 18 }} />
              الإشعارات
              {unreadCount > 0 ? <BetaBadge>{unreadCount} جديد</BetaBadge> : null}
            </SheetTitle>
            <button
              onClick={markAllNotificationsRead}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1 w-fit"
            >
              <CheckCheck style={{ width: 14, height: 14 }} /> تعليم الكل كمقروء
            </button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {notifications.length === 0 ? (
              <div className="py-16 text-center text-neutral-500 text-sm">
                لا إشعارات بعد — ستظهر تحديثات التطبيق وتنبيهات المزامنة هنا.
              </div>
            ) : (
              notifications.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-xl p-3 border ${
                    n.read
                      ? "bg-neutral-900/60 border-white/5"
                      : "bg-emerald-500/8 border-emerald-500/25"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                        {n.kind === "update-beta" || n.kind === "update-stable" ? (
                          <Cloud style={{ width: 14, height: 14 }} className="text-emerald-400 shrink-0" />
                        ) : n.kind === "ai" ? (
                          <Brain style={{ width: 14, height: 14 }} className="text-emerald-400 shrink-0" />
                        ) : n.kind === "sync" ? (
                          <RefreshCw style={{ width: 14, height: 14 }} className="text-emerald-400 shrink-0" />
                        ) : (
                          <UserRound style={{ width: 14, height: 14 }} className="text-emerald-400 shrink-0" />
                        )}
                        {n.title}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-neutral-600 mt-1.5">{formatRelativeTime(n.ts)}</p>
                    </div>
                    <button
                      onClick={() => dismissNotification(n.id)}
                      aria-label="حذف الإشعار"
                      className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                  {n.version ? (
                    <div className="mt-2 flex items-center gap-2">
                      <BetaBadge>الإصدار {n.version}</BetaBadge>
                      {n.kind === "update-beta" ? (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/10">
                          قناة بيتا
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </motion.div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Re-export for convenience in views
export { greeting };
