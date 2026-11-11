# Nokiatis MUC — Web Launcher (v1.17.3-beta.1)

The official web launcher of **Nokiatis MUC** by **Team Nokiatis** — a
Spotify-grade Arabic-first music experience that runs in the browser:

- **Nokiatis Intelligence** — an AI engine that learns your taste from every
  play, skip and like (exponential recency decay, completion weighting),
  builds a cross-device taste profile and five daily smart playlists
  (مزيج اليوم / اكتشاف الأسبوع / استمع مجددًا / طاقة عالية / هدوء), plus
  LLM-written Arabic taste insights.
- **Nokiatis Cloud** — Supabase-backed account sync (library, playlists,
  history, taste memory) with union merge and tombstones. The AI event block
  is byte-compatible with the Android app, so listening on the phone counts
  on the web and vice versa.
- **الخزنة السحابية (Vault)** — a password-gated favorites page where every
  byte of your cloud data can be viewed, managed, exported or wiped.
- **Update notifications** — browser notifications + in-app bell whenever a
  new Nokiatis MUC release (stable *or* beta) is published.
- Full player with Web Audio mastering chain, share links + QR, RTL Arabic
  UI, profile icon saved locally.

Deployed automatically by Vercel on every push to `main`.

## Structure

| Path | What |
|---|---|
| `src/` | The Next.js (App Router) launcher |
| `public/` | Static assets (banners, artist portraits, service worker) |
| `public/download.html` | The classic standalone download/landing page |
| `share.html` | Legacy share deep-link handler (`/s/*`, `/p/*`) |

The only secrets in this repo are public-by-design publishable keys; RLS on
the cloud table is what protects user data.

## Development

```bash
npm install
npm run dev   # http://localhost:3000
```
