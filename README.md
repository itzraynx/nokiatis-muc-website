# Nokiatis MUC — Official Website

The official website for **Nokiatis MUC** by **Team Nokiatis**: bilingual (English ⇄ العربية, full RTL),
real screenshots, a safety/verification section, install guide, widgets, FAQ — and a download button
that always serves the newest official APK (version, size and SHA-256 sync automatically from the
[`update.json` feed](https://github.com/itzraynx/nokiatis-muc-updates)).

No build step: plain `index.html` + `images/`. Deploy anywhere static.

## Deploy on Netlify (1 click)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/itzraynx/nokiatis-muc-website)

…or drag this folder onto https://app.netlify.com/drop — `netlify.toml` is already configured
(publish directory `.`, no build command).

## Deploy on Vercel (1 click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/itzraynx/nokiatis-muc-website)

`vercel.json` is already configured (static, clean URLs).

## Files

| Path | What |
|---|---|
| `index.html` | The whole site (styles + EN/AR translations + feed sync inline) |
| `images/` | App icon + screenshots (home, lyrics, search, library, history, settings, widgets) |
| `netlify.toml` / `vercel.json` | Zero-config static deploys |

## Notes

- The download info (version, size, SHA-256, date, direct APK link) is fetched at runtime from the
  official feed, so new app releases appear on the site with **no site changes needed**.
- Fallback values baked into the HTML match v1.12.0 in case the feed is unreachable.
