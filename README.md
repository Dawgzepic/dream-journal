# Dream Journal

A private, installable dream journal for Timothy. It is a static Progressive Web App: no account, no server, and no analytics. Dreams stay in IndexedDB on the device.

Use it in Chrome on Android (Add to Home Screen) or in a desktop browser. After the first load it works offline.

## Run it

```bash
npm install
npm run build
npm run preview
```

Open http://127.0.0.1:8741/dream-journal/

`npm run dev` starts the Vite dev server on the same port. The installable app is the production build.

## Host the static site

`npm run build` writes `dist/` for GitHub Pages at `/dream-journal/` (https://dawgzepic.github.io/dream-journal/). To host at a domain root instead, build with `VITE_BASE=/ npm run build`.

Fonts (EB Garamond, SIL Open Font License) and libraries are bundled. Nothing is loaded from a CDN. See `public/OFL-EBGaramond.txt`.

GitHub Pages deploys from `.github/workflows/pages.yml` on every push to `main`.

## What it keeps

On the first visit you choose a 4- or 6-digit PIN. It is stored only as a salted SHA-256 hash (`SHA-256(salt + PIN)`). The journal locks when the page is closed or hidden. Where the device supports it, Settings can add fingerprint unlock (WebAuthn). A forgotten PIN cannot be reset. Export a JSON backup from Settings.

Voice entry uses the browser speech API. Chrome on Android may send that audio to Google for transcription. The app asks before the first use, and you can skip it. The control is hidden when the browser has no speech API.

Morning reminders and daytime reality checks use the Notifications API on a best-effort basis. They are reliable only while the app is open. Reality checks do not fire during work hours (default 8:00 AM–4:30 PM on Sunday, Monday, Wednesday, Thursday, and Friday) or overnight from 10:00 PM to 7:00 AM. A reminder banner also shows when you open the app.

## Tests

```bash
npm test
```

That runs the logic tests and a Playwright pass: PIN setup and unlock, saving a dream into the timeline and stats, text/PDF/JSON export, a valid manifest, and service worker registration.
