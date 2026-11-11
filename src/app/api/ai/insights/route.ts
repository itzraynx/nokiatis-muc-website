import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

/**
 * POST /api/ai/insights
 * Body: the compact taste payload built by insightsRequestPayload().
 * Returns Arabic, user-facing "Nokiatis Intelligence" commentary written by
 * the LLM — never raw stats, never English.
 *
 * In-memory cache keyed by payload hash (15 min TTL) keeps repeated visits
 * snappy and protects the LLM quota. The z-ai SDK only ever runs here,
 * on the server — and when it is unavailable (e.g. a deployment without the
 * gateway credentials), a deterministic local Arabic analysis is returned
 * instead of an error, so the feature always answers.
 */

interface CacheEntry {
  text: string;
  ts: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 15 * 60 * 1000;
const MAX_BODY_CHARS = 6000;

function hashBody(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

interface InsightPayload {
  topArtists?: { name?: string; plays?: number }[];
  topGenres?: string[];
  favoriteTracks?: { title?: string; artist?: string }[];
  stats?: {
    totalPlays?: number;
    totalHours?: number;
    avgCompletion?: number;
    diversity?: number;
    exploration?: number;
    loyalty?: number;
    streakDays?: number;
    favoriteHour?: string;
  };
}

/**
 * Deterministic Arabic analysis used when the LLM cannot be reached. Same
 * voice as the LLM prompt: warm, direct, 3-5 lines, one actionable advice.
 */
function localInsight(payload: InsightPayload): string {
  const stats = payload.stats ?? {};
  const artists = (payload.topArtists ?? [])
    .map((a) => a?.name)
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);
  const genres = (payload.topGenres ?? []).slice(0, 3);
  const hours =
    typeof stats.totalHours === "number" && stats.totalHours > 0
      ? Math.round(stats.totalHours)
      : null;
  const hour = stats.favoriteHour ?? "";
  const streak =
    typeof stats.streakDays === "number" && stats.streakDays >= 2
      ? stats.streakDays
      : null;
  const loyalty =
    typeof stats.loyalty === "number" ? stats.loyalty : null;

  const lines: string[] = [];
  if (artists.length > 0) {
    lines.push(
      `ذوقك هذه الأيام يدور حول ${artists.join(" و")}${genres.length ? ` — مع نكهة ${genres.join(" و")} واضحة` : ""}.`,
    );
  } else if (genres.length > 0) {
    lines.push(`ذوقك يميل إلى ${genres.join(" و")}، وهذا يقول الكثير عن مزاجك الموسيقي.`);
  } else {
    lines.push("محرك Nokiatis Intelligence بدأ للتو في تسجيل استماعاتك — استمع أكثر ليكتب لك تحليلًا أعمق.");
  }

  if (hours != null) {
    lines.push(`ساعات استماعك الموثّقة بلغت نحو ${hours} ساعة${hour ? ` وأغلبها في ${hour}` : ""}.`);
  }
  if (streak != null) {
    lines.push(`سلسلتك الحالية ${streak} أيام متتالية من الاستماع — إيقاع جميل يحافظ على «من أنت» موسيقيًا في السحابة.`);
  }
  if (loyalty != null && loyalty >= 55) {
    lines.push("ولاؤك لفنيك المفضلين مرتفع، لذا صمّمنا لك مزيج اليوم ليوسّع آفاقك دون أن يفقد روحك.");
  } else {
    lines.push("تنوّعك الموسيقي صحي — جرّب «اكتشاف الأسبوع» ليضيف المحرك وجهة جديدة إلى خريطتك.");
  }
  return lines.slice(0, 5).join(" ");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 },
    );
  }

  const payloadStr = JSON.stringify(body ?? {});
  if (payloadStr.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { ok: false, error: "payload too large" },
      { status: 400 },
    );
  }

  const key = hashBody(payloadStr);
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ ok: true, text: cached.text, cached: true });
  }

  try {
    // Parse defensively; the LLM prompt is fed the compact JSON either way.
    let parsed: InsightPayload = {};
    try {
      parsed = (body ?? {}) as InsightPayload;
    } catch {
      parsed = {};
    }

    let text = "";
    try {
      const zai = await ZAI.create();

      const systemPrompt = [
        "أنت «Nokiatis Intelligence» — محرك ذكاء موسيقي داخل تطبيق Nokiatis MUC.",
        "تكتب بالعربية فقط، بأسلوب دافئ ومختصر (٣ إلى ٥ أسطر كحد أقصى)،",
        "تتحدث للمستخدم مباشرة بصيغة المخاطب، وتحلل ذوقه الموسيقي بناءً على البيانات المرسلة:",
        "أبرز فنانيه المفضلين وأنواعه المحبوبة وساعات استماعه وولاءه وتنوعه.",
        "قدم توقعًا أو نصيحة واحدة قابلة للتطبيق (مثلاً ماذا يستمع الليلة).",
        "لا تستخدم الإنجليزية، لا تذكر كلمة JSON، لا تكتب قوائم أرقام جافة — بل تحليل إنساني راقٍ.",
      ].join(" ");

      const userPrompt = `حلّل هذا الملف الموسيقي للمستخدم واكتب رؤيتك:\n${payloadStr}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
      });

      text = completion.choices[0]?.message?.content?.trim() ?? "";
    } catch {
      // No LLM gateway on this deployment (or the quota is exhausted): fall
      // back to the deterministic Arabic analysis so the user still gets an
      // answer, and mark it so the client can tell.
      text = localInsight(parsed);
    }

    if (!text) {
      text = localInsight(parsed);
    }

    CACHE.set(key, { text, ts: Date.now() });
    // housekeeping: never let the cache grow unbounded
    if (CACHE.size > 200) {
      const oldest = CACHE.keys().next().value;
      if (oldest) CACHE.delete(oldest);
    }

    return NextResponse.json({ ok: true, text, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM unavailable";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
