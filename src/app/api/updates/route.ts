import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/updates
 * Reads the two channel manifests from the public updates repo
 * (itzraynx/nokiatis-muc-updates, main branch) and normalises them.
 *
 *   update.json → stable channel
 *   beta.json   → beta channel
 *
 * The manifest shape has changed over time, so every field is read
 * defensively. Responses are cached in-process for 5 minutes so the
 * launcher can poll frequently without hammering GitHub.
 */

interface ChannelResult {
  channel: "stable" | "beta";
  versionName: string;
  versionCode: number;
  releaseDate: string;
  notes: string;
  downloadUrl: string;
}

interface CachedResponse {
  body: {
    ok: boolean;
    stable: ChannelResult | null;
    beta: ChannelResult | null;
    fetchedAt: number;
    error?: string;
  };
  ts: number;
}

const RAW_BASE =
  "https://raw.githubusercontent.com/itzraynx/nokiatis-muc-updates/main";

let cache: CachedResponse | null = null;
const TTL_MS = 5 * 60 * 1000;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function normalise(raw: unknown, channel: "stable" | "beta"): ChannelResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  // The feed is published in a dual shape: the repo's current manifests use
  // the latestVersionName / latestVersionCode / apkUrl / releaseNotes /
  // publishedAt family, older historical feeds used versionName / version /
  // downloadUrl. Both must read.
  const versionName =
    asString(r.latestVersionName) ||
    asString(r.versionName) ||
    asString(r.version) ||
    asString(r.version_name) ||
    asString(r.latestVersion) ||
    (typeof r.latestVersionCode === "number" ||
    typeof r.versionCode === "number" ||
    typeof r.version_code === "number"
      ? String(
          asNumber(
            r.latestVersionCode,
            asNumber(r.versionCode, asNumber(r.version_code)),
          ),
        )
      : "");
  if (!versionName) return null;

  const notes =
    asString(r.notes) ||
    asString(r.body) ||
    asString(r.changelog) ||
    asString(r.releaseNotes) ||
    asString(r.release_notes) ||
    "";

  const downloadUrl =
    asString(r.apkUrl) ||
    asString(r.downloadUrl) ||
    asString(r.apk) ||
    asString(r.url) ||
    asString(r.download_url) ||
    "";

  const releaseDate =
    asString(r.releaseDate) ||
    asString(r.date) ||
    asString(r.release_date) ||
    asString(r.publishedAt) ||
    asString(r.published_at) ||
    "";

  return {
    channel,
    versionName,
    versionCode: asNumber(
      r.latestVersionCode,
      asNumber(r.versionCode, asNumber(r.version_code, 0)),
    ),
    releaseDate,
    notes,
    downloadUrl,
  };
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<unknown> {
  // Two quick attempts: raw.githubusercontent answers from several edges and
  // a single hiccup should not blind the update checker.
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[updates] ${url} → HTTP ${res.status}`);
        continue;
      }
      return (await res.json()) as unknown;
    } catch (err) {
      console.warn(
        `[updates] ${url} → ${err instanceof Error ? err.name : "error"}: ${
          err instanceof Error ? err.message : ""
        } (attempt ${attempt + 1})`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function GET(_req: NextRequest) {
  // Successes are cached for 5 minutes (GitHub stays calm under the 10-min
  // polling of many open launchers). Failures are retried after just 30
  // seconds — one transient DNS hiccup must not keep every client blind to
  // a brand-new release for five minutes.
  const ERROR_TTL_MS = 30 * 1000;
  const effectiveTtl = cache?.body.ok ? TTL_MS : ERROR_TTL_MS;
  if (cache && Date.now() - cache.ts < effectiveTtl) {
    return NextResponse.json(cache.body);
  }

  const [stableRaw, betaRaw] = await Promise.all([
    fetchJson(`${RAW_BASE}/update.json`),
    fetchJson(`${RAW_BASE}/beta.json`),
  ]);

  const stable = normalise(stableRaw, "stable");
  const beta = normalise(betaRaw, "beta");

  const body: CachedResponse["body"] = {
    ok: stable !== null || beta !== null,
    stable,
    beta,
    fetchedAt: Date.now(),
  };
  if (!body.ok) body.error = "لم يمكن الوصول إلى مستودع التحديثات";

  cache = { body, ts: Date.now() };
  return NextResponse.json(body);
}
