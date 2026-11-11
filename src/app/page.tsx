"use client";

/**
 * Nokiatis MUC — Web Launcher v1.17.3-beta.1 (the only user-visible route).
 *
 * One provider, one shell, a view switcher and the global dialogs. The
 * provider owns auth/data/AI/player/sync; see components/nokiatis/*.
 */

import { useEffect } from "react";
import { Brain } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { NokiatisAppProvider, useApp } from "@/components/nokiatis/app-context";
import { LoginGate } from "@/components/nokiatis/login-gate";
import { AppShell } from "@/components/nokiatis/shell";
import { PlayerBar } from "@/components/nokiatis/player-bar";
import { ShareDialog, AddToPlaylistDialog } from "@/components/nokiatis/shared";
import { HomeView } from "@/components/nokiatis/home-view";
import { LibraryView } from "@/components/nokiatis/library-view";
import {
  PlaylistsView,
  PlaylistDetailView,
  SmartDetailView,
  ArtistDetailView,
  SharedInView,
} from "@/components/nokiatis/playlists-view";
import { AiView } from "@/components/nokiatis/ai-view";
import { HistoryView } from "@/components/nokiatis/history-view";
import { VaultView } from "@/components/nokiatis/vault-view";
import { SettingsView } from "@/components/nokiatis/settings-view";

function BootSplash() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-5">
      <motion.div
        animate={{
          boxShadow: [
            "0 0 24px 4px rgba(16,185,129,.3)",
            "0 0 44px 10px rgba(16,185,129,.55)",
            "0 0 24px 4px rgba(16,185,129,.3)",
          ],
        }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="h-20 w-20 rounded-full bg-emerald-500 flex items-center justify-center"
      >
        <Brain className="text-neutral-950" style={{ width: 36, height: 36 }} />
      </motion.div>
      <div className="text-center">
        <p className="text-xl font-extrabold">Nokiatis MUC</p>
        <p className="text-xs text-neutral-500 mt-1">جارٍ تجهيز الذكاء والسحابة…</p>
      </div>
    </div>
  );
}

function CurrentView() {
  const { view } = useApp();
  switch (view) {
    case "library":
      return <LibraryView />;
    case "playlists":
      return <PlaylistsView />;
    case "playlist":
      return <PlaylistDetailView />;
    case "smart":
      return <SmartDetailView />;
    case "artist":
      return <ArtistDetailView />;
    case "ai":
      return <AiView />;
    case "history":
      return <HistoryView />;
    case "vault":
      return <VaultView />;
    case "settings":
      return <SettingsView />;
    case "shared":
      return <SharedInView />;
    default:
      return <HomeView />;
  }
}

function Launcher() {
  const { stage, view } = useApp();

  // PWA: minimal service worker + manifest (registered away from localhost dev)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  if (stage === "boot") return <BootSplash />;
  if (stage === "gate") return <LoginGate />;

  return (
    <>
      <AppShell>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            <CurrentView />
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <PlayerBar />
      <ShareDialog />
      <AddToPlaylistDialog />
    </>
  );
}

export default function Page() {
  return (
    <NokiatisAppProvider>
      <Launcher />
    </NokiatisAppProvider>
  );
}
