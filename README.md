# Spool Library

Personal 3D printer filament catalogue. An offline iPhone web app (PWA): your data stays on your phone.

Live app: https://hcoel.github.io/spool-library/

## Install on iPhone

1. Open the link in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open Spool Library from the home screen (not the Safari tab: they keep separate data).

## Backups

Settings > Export backup, then Save to Files > iCloud Drive. Removing the app from the home screen deletes its data. The gear icon shows a red dot after 14 days without a backup.

## Develop

    npm install
    npm run dev        # http://localhost:5173/spool-library/
    npm test           # unit tests (Vitest)
    npm run e2e        # smoke test (Playwright, WebKit iPhone profile)

Pushing to `main` runs the tests and deploys to GitHub Pages when they pass.

## Manual device checklist (run after notable changes)

- [ ] Install to home screen; launches full screen without Safari chrome
- [ ] Airplane mode: app opens and data shows
- [ ] Add a product with a camera photo; photo shows on detail
- [ ] Export backup to iCloud Drive via the share sheet
- [ ] Push a change: "Update available - Reload" appears on next launch
