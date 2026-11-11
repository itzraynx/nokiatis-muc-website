/**
 * Nokiatis MUC — seed catalog + local-storage helpers.
 *
 * Task A of the v1.17.3-beta.1 build. This module owns:
 *  - the static Arabic-first catalog (8 artists / 48 tracks / 4 seed playlists);
 *  - the dark-premium color system (genre, cover and avatar palettes);
 *  - the localStorage key registry plus every safe accessor / default factory;
 *  - shared formatting + id/hash utilities used across the launcher.
 *
 * Hard rules honored here:
 *  - pure TypeScript, no React, no "use client";
 *  - zero side effects at import time (window/localStorage are only touched
 *    inside exported functions);
 *  - deterministic seeds only — no Math.random() at module top level;
 *  - English comments, Arabic UI strings;
 *  - no blue/indigo hues anywhere (forbidden by the design system).
 */

import type {
  AppSettings,
  ArtistInfo,
  NotificationItem,
  ProfileIdentity,
  RichTrack,
} from "./nokiatis-types";
import type { Playlist } from "./nokiatis-cloud";

// ---------------------------------------------------------------------------
// Artists (8) — ids match the /artists/<id>.png image paths
// ---------------------------------------------------------------------------

export const ARTISTS: ArtistInfo[] = [
  {
    id: "rem",
    name: "ريم الحسنية",
    latinName: "Rem El Hassania",
    genre: "شعبي",
    image: "/artists/rem.png",
    monthlyListeners: 842000,
    bio: "صوت الشعبي الجديد الذي أبهر الجمهور بإحساسه الصادق وجرأته على التجديد.",
  },
  {
    id: "youssef",
    name: "يوسف العطراس",
    latinName: "Youssef El Atras",
    genre: "راي",
    image: "/artists/youssef.png",
    monthlyListeners: 615000,
    bio: "فنان راي يحمل همّ الغربة ويحوّلها إلى ألحان نارية لا تُنسى.",
  },
  {
    id: "nadia",
    name: "نادية مرشان",
    latinName: "Nadia Marsan",
    genre: "بوب",
    image: "/artists/nadia.png",
    monthlyListeners: 476000,
    bio: "نجمة البوب المغربية بأغانٍ خفيفة تلامس القلب من أول سماع.",
  },
  {
    id: "karim",
    name: "كريم ابن الصحراء",
    latinName: "Karim Ibn Es-Sahra",
    genre: "صحراوي",
    image: "/artists/karim.png",
    monthlyListeners: 291000,
    bio: "سفير الأغنية الصحراوية بملامس حديثة وإيقاع هادئ يسرح بالخيال.",
  },
  {
    id: "layla",
    name: "ليلى الأندلسية",
    latinName: "Layla El Andalussia",
    genre: "أندلسي",
    image: "/artists/layla.png",
    monthlyListeners: 198000,
    bio: "حافظة الموروث الأندلسي وابنة نوباته العريقة تُحيي الطرب في كل سهرة.",
  },
  {
    id: "zine",
    name: "زين الطنجاوي",
    latinName: "Zine Tanger",
    genre: "إلكتروني",
    image: "/artists/zine.png",
    monthlyListeners: 354000,
    bio: "رائد الإلكتروني المغربي يمزج الطرب القديم بأضواء المدينة الحديثة.",
  },
  {
    id: "omar",
    name: "عمر الرباطي",
    latinName: "Omar Errabati",
    genre: "راب",
    image: "/artists/omar.png",
    monthlyListeners: 523000,
    bio: "صوت الراب الواعي من قلب الدار البيضاء بكلمات تُراجع هموم الجيل.",
  },
  {
    id: "salma",
    name: "سلمى الشاوية",
    latinName: "Salma Chaouia",
    genre: "فلكلور",
    image: "/artists/salma.png",
    monthlyListeners: 127000,
    bio: "جمعت التراث الشاوي والأمازيغي في أغانٍ تُحفّظ للأطفال قبل النوم.",
  },
];

// ---------------------------------------------------------------------------
// Tracks (48 = 6 per artist) — all literal data, deterministic seeds
// ---------------------------------------------------------------------------

export const TRACKS: RichTrack[] = [
  // --- ريم الحسنية — شعبي ---------------------------------------------------
  { id: "t01", title: "ضوء القناديل", artist: "ريم الحسنية", artistId: "rem", album: "قناديل طرب", genre: "شعبي", year: 2016, durationSec: 245, energy: 0.72, mood: 0.65, coverSeed: 0, synthSeed: 1723 },
  { id: "t02", title: "ليلة العرس", artist: "ريم الحسنية", artistId: "rem", album: "قناديل طرب", genre: "شعبي", year: 2018, durationSec: 268, energy: 0.85, mood: 0.8, coverSeed: 5, synthSeed: 2841 },
  { id: "t03", title: "القصيدة الأخيرة", artist: "ريم الحسنية", artistId: "rem", album: "قناديل طرب", genre: "شعبي", year: 2021, durationSec: 301, energy: 0.63, mood: 0.5, coverSeed: 8, synthSeed: 3907 },
  { id: "t04", title: "طرب الشوارع", artist: "ريم الحسنية", artistId: "rem", album: "حكايات المدينة", genre: "شعبي", year: 2019, durationSec: 232, energy: 0.78, mood: 0.72, coverSeed: 2, synthSeed: 4255 },
  { id: "t05", title: "حكاية الجدة", artist: "ريم الحسنية", artistId: "rem", album: "حكايات المدينة", genre: "شعبي", year: 2022, durationSec: 289, energy: 0.61, mood: 0.42, coverSeed: 9, synthSeed: 5189 },
  { id: "t06", title: "عيون المدينة", artist: "ريم الحسنية", artistId: "rem", album: "حكايات المدينة", genre: "شعبي", year: 2024, durationSec: 254, energy: 0.7, mood: 0.6, coverSeed: 11, synthSeed: 6042 },
  // --- يوسف العطراس — راي ---------------------------------------------------
  { id: "t07", title: "غربة الوهراني", artist: "يوسف العطراس", artistId: "youssef", album: "شمس الراي", genre: "راي", year: 2015, durationSec: 276, energy: 0.58, mood: 0.4, coverSeed: 3, synthSeed: 7154 },
  { id: "t08", title: "رسالة الصحراء", artist: "يوسف العطراس", artistId: "youssef", album: "شمس الراي", genre: "راي", year: 2017, durationSec: 243, energy: 0.66, mood: 0.55, coverSeed: 7, synthSeed: 8266 },
  { id: "t09", title: "قلبي الطاير", artist: "يوسف العطراس", artistId: "youssef", album: "شمس الراي", genre: "راي", year: 2019, durationSec: 228, energy: 0.79, mood: 0.74, coverSeed: 1, synthSeed: 9378 },
  { id: "t10", title: "ليل أنزكان", artist: "يوسف العطراس", artistId: "youssef", album: "شمس الراي", genre: "راي", year: 2020, durationSec: 292, energy: 0.6, mood: 0.48, coverSeed: 4, synthSeed: 1049 },
  { id: "t11", title: "شمس وهران", artist: "يوسف العطراس", artistId: "youssef", album: "شمس الراي", genre: "راي", year: 2022, durationSec: 215, energy: 0.75, mood: 0.68, coverSeed: 10, synthSeed: 2151 },
  { id: "t12", title: "دمعة الراي", artist: "يوسف العطراس", artistId: "youssef", album: "شمس الراي", genre: "راي", year: 2024, durationSec: 318, energy: 0.56, mood: 0.35, coverSeed: 6, synthSeed: 3263 },
  // --- نادية مرشان — بوب ----------------------------------------------------
  { id: "t13", title: "نبض المدينة", artist: "نادية مرشان", artistId: "nadia", album: "نبض", genre: "بوب", year: 2016, durationSec: 198, energy: 0.72, mood: 0.7, coverSeed: 2, synthSeed: 4375 },
  { id: "t14", title: "صيف أبيض", artist: "نادية مرشان", artistId: "nadia", album: "نبض", genre: "بوب", year: 2018, durationSec: 187, energy: 0.66, mood: 0.62, coverSeed: 5, synthSeed: 5487 },
  { id: "t15", title: "ملاكي", artist: "نادية مرشان", artistId: "nadia", album: "نبض", genre: "بوب", year: 2020, durationSec: 176, energy: 0.52, mood: 0.45, coverSeed: 8, synthSeed: 6599 },
  { id: "t16", title: "نجوم الدار", artist: "نادية مرشان", artistId: "nadia", album: "نبض", genre: "بوب", year: 2021, durationSec: 204, energy: 0.68, mood: 0.66, coverSeed: 0, synthSeed: 7611 },
  { id: "t17", title: "قهوة الصباح", artist: "نادية مرشان", artistId: "nadia", album: "نبض", genre: "بوب", year: 2023, durationSec: 169, energy: 0.55, mood: 0.58, coverSeed: 3, synthSeed: 8723 },
  { id: "t18", title: "اهرب معي", artist: "نادية مرشان", artistId: "nadia", album: "نبض", genre: "بوب", year: 2024, durationSec: 212, energy: 0.8, mood: 0.78, coverSeed: 9, synthSeed: 9835 },
  // --- كريم ابن الصحراء — صحراوي ---------------------------------------------
  { id: "t19", title: "قافلة الملح", artist: "كريم ابن الصحراء", artistId: "karim", album: "قافلة الملح", genre: "صحراوي", year: 2017, durationSec: 284, energy: 0.42, mood: 0.3, coverSeed: 4, synthSeed: 1092 },
  { id: "t20", title: "خيمة النجوم", artist: "كريم ابن الصحراء", artistId: "karim", album: "قافلة الملح", genre: "صحراوي", year: 2019, durationSec: 312, energy: 0.34, mood: 0.22, coverSeed: 7, synthSeed: 2204 },
  { id: "t21", title: "سراب", artist: "كريم ابن الصحراء", artistId: "karim", album: "قافلة الملح", genre: "صحراوي", year: 2021, durationSec: 265, energy: 0.38, mood: 0.18, coverSeed: 11, synthSeed: 3316 },
  { id: "t22", title: "أغنية الجمال", artist: "كريم ابن الصحراء", artistId: "karim", album: "بوابة الجنوب", genre: "صحراوي", year: 2022, durationSec: 297, energy: 0.45, mood: 0.36, coverSeed: 1, synthSeed: 4428 },
  { id: "t23", title: "بوابة الجنوب", artist: "كريم ابن الصحراء", artistId: "karim", album: "بوابة الجنوب", genre: "صحراوي", year: 2023, durationSec: 276, energy: 0.5, mood: 0.42, coverSeed: 6, synthSeed: 5530 },
  { id: "t24", title: "نسيم الحمادة", artist: "كريم ابن الصحراء", artistId: "karim", album: "بوابة الجنوب", genre: "صحراوي", year: 2024, durationSec: 320, energy: 0.31, mood: 0.15, coverSeed: 10, synthSeed: 6642 },
  // --- ليلى الأندلسية — أندلسي ------------------------------------------------
  { id: "t25", title: "زهرة الليل", artist: "ليلى الأندلسية", artistId: "layla", album: "نوبة العشق", genre: "أندلسي", year: 2015, durationSec: 305, energy: 0.32, mood: 0.25, coverSeed: 5, synthSeed: 7754 },
  { id: "t26", title: "طرب الأندلس", artist: "ليلى الأندلسية", artistId: "layla", album: "نوبة العشق", genre: "أندلسي", year: 2017, durationSec: 318, energy: 0.44, mood: 0.4, coverSeed: 0, synthSeed: 8866 },
  { id: "t27", title: "نوبة العشق", artist: "ليلى الأندلسية", artistId: "layla", album: "نوبة العشق", genre: "أندلسي", year: 2019, durationSec: 314, energy: 0.48, mood: 0.45, coverSeed: 8, synthSeed: 9978 },
  { id: "t28", title: "عزف الغرناطة", artist: "ليلى الأندلسية", artistId: "layla", album: "نوبة العشق", genre: "أندلسي", year: 2021, durationSec: 296, energy: 0.38, mood: 0.3, coverSeed: 2, synthSeed: 1081 },
  { id: "t29", title: "قصيد النخيل", artist: "ليلى الأندلسية", artistId: "layla", album: "نوبة العشق", genre: "أندلسي", year: 2022, durationSec: 308, energy: 0.27, mood: 0.2, coverSeed: 11, synthSeed: 2193 },
  { id: "t30", title: "همس السهرة", artist: "ليلى الأندلسية", artistId: "layla", album: "نوبة العشق", genre: "أندلسي", year: 2024, durationSec: 288, energy: 0.35, mood: 0.28, coverSeed: 4, synthSeed: 3305 },
  // --- زين الطنجاوي — إلكتروني ------------------------------------------------
  { id: "t31", title: "مطار المغرب", artist: "زين الطنجاوي", artistId: "zine", album: "نيون", genre: "إلكتروني", year: 2018, durationSec: 205, energy: 0.82, mood: 0.75, coverSeed: 3, synthSeed: 4417 },
  { id: "t32", title: "نيون طنجة", artist: "زين الطنجاوي", artistId: "zine", album: "نيون", genre: "إلكتروني", year: 2020, durationSec: 192, energy: 0.9, mood: 0.85, coverSeed: 7, synthSeed: 5529 },
  { id: "t33", title: "موجات قصيرة", artist: "زين الطنجاوي", artistId: "zine", album: "نيون", genre: "إلكتروني", year: 2021, durationSec: 178, energy: 0.74, mood: 0.6, coverSeed: 9, synthSeed: 6631 },
  { id: "t34", title: "ألف فولت", artist: "زين الطنجاوي", artistId: "zine", album: "نيون", genre: "إلكتروني", year: 2022, durationSec: 165, energy: 0.95, mood: 0.88, coverSeed: 1, synthSeed: 7743 },
  { id: "t35", title: "حلبة الرقص", artist: "زين الطنجاوي", artistId: "zine", album: "نيون", genre: "إلكتروني", year: 2023, durationSec: 218, energy: 0.88, mood: 0.92, coverSeed: 10, synthSeed: 8855 },
  { id: "t36", title: "إيقاع الفضة", artist: "زين الطنجاوي", artistId: "zine", album: "نيون", genre: "إلكتروني", year: 2024, durationSec: 236, energy: 0.79, mood: 0.7, coverSeed: 5, synthSeed: 9967 },
  // --- عمر الرباطي — راب -----------------------------------------------------
  { id: "t37", title: "شارع محمد الخامس", artist: "عمر الرباطي", artistId: "omar", album: "لسان الشارع", genre: "راب", year: 2016, durationSec: 224, energy: 0.68, mood: 0.6, coverSeed: 2, synthSeed: 1179 },
  { id: "t38", title: "لسان الشارع", artist: "عمر الرباطي", artistId: "omar", album: "لسان الشارع", genre: "راب", year: 2018, durationSec: 209, energy: 0.74, mood: 0.66, coverSeed: 6, synthSeed: 2281 },
  { id: "t39", title: "قافية الغضب", artist: "عمر الرباطي", artistId: "omar", album: "لسان الشارع", genre: "راب", year: 2019, durationSec: 198, energy: 0.81, mood: 0.72, coverSeed: 0, synthSeed: 3393 },
  { id: "t40", title: "سبعة دروب", artist: "عمر الرباطي", artistId: "omar", album: "لسان الشارع", genre: "راب", year: 2021, durationSec: 187, energy: 0.62, mood: 0.5, coverSeed: 8, synthSeed: 4405 },
  { id: "t41", title: "بيان الجيل", artist: "عمر الرباطي", artistId: "omar", album: "لسان الشارع", genre: "راب", year: 2022, durationSec: 215, energy: 0.76, mood: 0.68, coverSeed: 4, synthSeed: 5517 },
  { id: "t42", title: "صحوة", artist: "عمر الرباطي", artistId: "omar", album: "لسان الشارع", genre: "راب", year: 2024, durationSec: 176, energy: 0.66, mood: 0.58, coverSeed: 11, synthSeed: 6629 },
  // --- سلمى الشاوية — فلكلور ---------------------------------------------------
  { id: "t43", title: "عروس الأطلس", artist: "سلمى الشاوية", artistId: "salma", album: "أعراس الأطلس", genre: "فلكلور", year: 2015, durationSec: 262, energy: 0.5, mood: 0.45, coverSeed: 9, synthSeed: 7731 },
  { id: "t44", title: "رقصة المواسم", artist: "سلمى الشاوية", artistId: "salma", album: "أعراس الأطلس", genre: "فلكلور", year: 2017, durationSec: 248, energy: 0.58, mood: 0.55, coverSeed: 5, synthSeed: 8843 },
  { id: "t45", title: "أغنية الحصاد", artist: "سلمى الشاوية", artistId: "salma", album: "أعراس الأطلس", genre: "فلكلور", year: 2019, durationSec: 271, energy: 0.42, mood: 0.35, coverSeed: 1, synthSeed: 9955 },
  { id: "t46", title: "أحيدوس الجبل", artist: "سلمى الشاوية", artistId: "salma", album: "أعراس الأطلس", genre: "فلكلور", year: 2020, durationSec: 234, energy: 0.55, mood: 0.5, coverSeed: 7, synthSeed: 1067 },
  { id: "t47", title: "موسم الرمان", artist: "سلمى الشاوية", artistId: "salma", album: "أعراس الأطلس", genre: "فلكلور", year: 2022, durationSec: 283, energy: 0.38, mood: 0.3, coverSeed: 3, synthSeed: 2179 },
  { id: "t48", title: "سهرة القبيلة", artist: "سلمى الشاوية", artistId: "salma", album: "أعراس الأطلس", genre: "فلكلور", year: 2023, durationSec: 295, energy: 0.47, mood: 0.42, coverSeed: 10, synthSeed: 3291 },
];

// ---------------------------------------------------------------------------
// Color system — dark-premium gradients, NO blue/indigo families
// ---------------------------------------------------------------------------

/** Genre accent gradients (from = deep base, to = bright accent). */
export const GENRE_PALETTE: Record<string, { from: string; to: string; label: string }> = {
  "شعبي": { from: "#064e3b", to: "#10b981", label: "شعبي" },
  "راي": { from: "#78350f", to: "#f59e0b", label: "راي" },
  "بوب": { from: "#881337", to: "#f43f5e", label: "بوب" },
  "صحراوي": { from: "#134e4a", to: "#14b8a6", label: "صحراوي" },
  "أندلسي": { from: "#1c1917", to: "#a8a29e", label: "أندلسي" },
  "إلكتروني": { from: "#431407", to: "#fb923c", label: "إلكتروني" },
  "راب": { from: "#3f6212", to: "#a3e635", label: "راب" },
  "فلكلور": { from: "#365314", to: "#84cc16", label: "فلكلور" },
  "أخرى": { from: "#292524", to: "#78716c", label: "أخرى" },
};

/** Cover art gradients — RichTrack.coverSeed indexes into this array (12 entries). */
export const COVER_GRADIENTS: { from: string; to: string }[] = [
  { from: "#052e26", to: "#10b981" }, // deep emerald
  { from: "#1c1917", to: "#f59e0b" }, // stone base, amber glow
  { from: "#4c0519", to: "#f43f5e" }, // wine red to rose
  { from: "#042f2e", to: "#0d9488" }, // deep teal
  { from: "#1a2e05", to: "#84cc16" }, // olive to lime
  { from: "#431407", to: "#ea580c" }, // burnt orange
  { from: "#292524", to: "#d6d3d1" }, // warm stone neutral
  { from: "#064e3b", to: "#34d399" }, // emerald bright
  { from: "#78350f", to: "#fbbf24" }, // amber gold
  { from: "#881337", to: "#fb7185" }, // soft rose
  { from: "#134e4a", to: "#2dd4bf" }, // teal light
  { from: "#171717", to: "#a3e635" }, // near-black to chartreuse
];

/** Avatar ring/background colors (10) — warm/green spectrum only. */
export const AVATAR_COLORS: string[] = [
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#14b8a6",
  "#84cc16",
  "#fb923c",
  "#a8a29e",
  "#34d399",
  "#fbbf24",
  "#fb7185",
];

// ---------------------------------------------------------------------------
// Seed playlists — reference REAL track ids from TRACKS above
// ---------------------------------------------------------------------------

export const SEED_PLAYLISTS: Playlist[] = [
  {
    id: "pl-agadir",
    name: "أغادير عند الغروب",
    // Mixed genres for a sunset drive along the southern coast.
    songIds: ["t05", "t08", "t10", "t13", "t19", "t24", "t25", "t30", "t43", "t48"],
    updatedAt: 1730000000000,
  },
  {
    id: "pl-casa",
    name: "ليل الدار البيضاء",
    // Nocturnal, mellow picks for late city nights.
    songIds: ["t03", "t10", "t15", "t20", "t25", "t28", "t30", "t47"],
    updatedAt: 1728500000000,
  },
  {
    id: "pl-morning",
    name: "طاقة الصباح",
    // Upbeat, high-energy starters (energy >= 0.75).
    songIds: ["t02", "t09", "t11", "t18", "t31", "t34", "t35", "t39"],
    updatedAt: 1727000000000,
  },
  {
    id: "pl-desert",
    name: "هدوء الصحراء",
    // Calm, low-energy tracks for quiet desert evenings.
    songIds: ["t20", "t21", "t24", "t25", "t29", "t47"],
    updatedAt: 1725000000000,
  },
];

// ---------------------------------------------------------------------------
// localStorage key registry
// ---------------------------------------------------------------------------

export const KEYS = {
  profile: "nmuc.profile.v1",
  settings: "nmuc.settings.v1",
  guestData: "nmuc.guest.v1",
  notifications: "nmuc.notifications.v1",
  syncLog: "nmuc.synclog.v1",
  vault: "nmuc.vault.v1",
  seenVersion: "nmuc.seenversion.v1",
  insightsCache: "nmuc.ai.insights.v1",
  updateCache: "nmuc.updates.v1",
} as const;

// ---------------------------------------------------------------------------
// Safe storage accessors (SSR/private-mode proof — every call is guarded)
// ---------------------------------------------------------------------------

/** Read + JSON.parse a localStorage value; ANY failure returns the fallback. */
export function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON.stringify + write to localStorage; returns success as boolean. */
export function safeSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Factory defaults for the audio/notification settings block. */
export function defaultSettings(): Required<AppSettings> {
  return {
    audioQuality: "high",
    bass: 4,
    treble: 2,
    normalization: true,
    surround: true,
    notifyUpdates: true,
    notifyBeta: true,
    notifyInApp: true,
    betaChannelEnabled: true,
    crossfadeSec: 3,
  };
}

/** Anonymous profile shown until the guest personalises their identity. */
export function defaultProfile(): ProfileIdentity {
  return {
    name: "مستمع مجهول",
    colorIndex: 0,
    emoji: "🎧",
  };
}

/** Fresh devices start with an empty notification tray. */
export function defaultNotifications(): NotificationItem[] {
  return [];
}

// ---------------------------------------------------------------------------
// Formatting helpers (Arabic-first)
// ---------------------------------------------------------------------------

/** "3:24" style compact duration. */
export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Arabic long duration with latin digits, e.g. "3 د 24 ث". */
export function formatLongDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} ث`;
  return `${m} د ${s} ث`;
}

/**
 * Arabic relative time with proper plural rules:
 *   1 → singular, 2 → dual (دقيقتين/ساعتين/يومين…),
 *   3–10 → plural (دقائق/ساعات/أيام…), 11+ → singular counted form.
 */
export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  // "now" also swallows slightly-future timestamps (clock skew).
  if (diff < 45_000) return "الآن";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) {
    if (minutes === 1) return "منذ دقيقة";
    if (minutes === 2) return "منذ دقيقتين";
    if (minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  }

  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) {
    if (hours === 1) return "منذ ساعة";
    if (hours === 2) return "منذ ساعتين";
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }

  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return "أمس";
  if (days === 2) return "منذ يومين";
  if (days <= 10) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${days} يومًا`;

  const months = Math.floor(days / 30);
  if (months === 1) return "منذ شهر";
  if (months === 2) return "منذ شهرين";
  if (months <= 10) return `منذ ${months} أشهر`;
  if (months < 12) return `منذ ${months} شهرًا`;

  const years = Math.floor(days / 365);
  if (years === 1) return "منذ سنة";
  if (years === 2) return "منذ سنتين";
  if (years <= 10) return `منذ ${years} سنوات`;
  return `منذ ${years} سنة`;
}

/** Arabic long date via the Moroccan locale (e.g. 12 شتنبر 2024). */
export function formatArabicDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat("ar-MA", { dateStyle: "long" }).format(new Date(ms));
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Hash / id utilities
// ---------------------------------------------------------------------------

/**
 * 32-bit FNV-1a hash of a PIN. The vault is a UI gate, not DRM — a simple
 * non-cryptographic hash is the documented contract (see VaultConfig).
 */
export function hashPin(pin: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < pin.length; i++) {
    hash ^= pin.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // force unsigned
}

/** Prefixed unique id: prefix + base36 timestamp + 4 random chars. */
export function uid(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

// ---------------------------------------------------------------------------
// UTF-8 safe base64 (share links carry Arabic text — plain btoa throws)
// ---------------------------------------------------------------------------

/** Base64 of the UTF-8 bytes of str (safe for Arabic/emoji content). */
export function encodeShareBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Decode base64 (UTF-8) back into a string; returns null when invalid. */
export function decodeShareBase64(b64: string): string | null {
  try {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Catalog lookups
// ---------------------------------------------------------------------------

/** O(1) id → track index, built deterministically from the literal catalog. */
const TRACK_INDEX: Map<string, RichTrack> = new Map(
  TRACKS.map((t): [string, RichTrack] => [t.id, t]),
);

/** Find a single track by id. */
export function trackById(id: string): RichTrack | undefined {
  return TRACK_INDEX.get(id);
}

/** Resolve a list of ids; unknown ids are skipped, order is preserved. */
export function tracksByIds(ids: string[]): RichTrack[] {
  const out: RichTrack[] = [];
  for (const id of ids) {
    const t = TRACK_INDEX.get(id);
    if (t) out.push(t);
  }
  return out;
}
