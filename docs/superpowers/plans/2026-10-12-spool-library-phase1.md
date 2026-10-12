# Spool Library Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable, offline iPhone PWA that catalogues 3D printer filament (products with spools), with presets, amount tracking, search/filter, and JSON backup, deployed to GitHub Pages.

**Architecture:** Preact single-page app with hash routing. All persistence goes through `src/core/repo.js` (Dexie over IndexedDB). Pure logic (amount maths, presets, validation, query, export/merge) lives in `src/core/` and is unit tested; library-specific data and widgets live in `src/libraries/filament/`. GitHub Actions runs Vitest + Playwright (WebKit) and deploys `dist/` to Pages only when green.

**Tech Stack:** Vite, Preact (`preact/hooks`), Dexie 4, vite-plugin-pwa, Vitest + fake-indexeddb, Playwright (WebKit, iPhone 13 profile), @vite-pwa/assets-generator, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-12-spool-library-design.md`

## Global Constraints

- Plain JavaScript (ES modules) + JSX. No TypeScript.
- Vite `base` and manifest `start_url`/`scope`: `/spool-library/`.
- Hash routes only (`#/`, `#/p/:id`, `#/new`, `#/new/:fromId`, `#/edit/:id`, `#/settings`), so GitHub Pages needs no rewrites.
- UI components never import `dexie` directly except `src/ui/useLive.js` (which imports only `liveQuery`). All reads/writes go through `repo`.
- IDs: `crypto.randomUUID()`. Every write sets `updated_at` (ISO UTC string). Deletes are tombstones (`deleted: true`), never hard deletes.
- Photos are stored as `{ id, type, data: ArrayBuffer, updated_at, deleted }` (not Blob: ArrayBuffer is reliable in Safari IndexedDB and in fake-indexeddb). Max 1200 px long edge, JPEG quality 0.8.
- Presets are stored with `id = "<library>:<material>"`.
- Validation ranges: hex `/^#[0-9a-fA-F]{6}$/`; nozzle 150-350; bed 0-120; dry_temp 30-100; dry_hours 1-48; speed_max 1-1000; net_g and empty_spool_g 1-5000; diameter 0.5-5; min <= max for nozzle and bed.
- Remaining (weight mode) = `clamp(gross_g - empty_spool_g, 0, net_g)`.
- Backup reminder at >= 14 days or never (only when at least one product exists).
- User copy and docs use hyphens, never em dashes.
- Git commits: author Hannah (existing git config), short messages, no co-author trailer.
- `npm test` and `npm run e2e` must pass before a task is committed when the task touches code they cover.

## Review Focus

1. Scale reading below the empty spool weight (including 0): remaining shows 0 g, never negative, and the sheet warns. Pinned in Task 3.
2. Name, brand and colour name all left blank: the product name falls back to the material (e.g. "PETG"), never an empty string or heading. Pinned in Task 5.
3. Corrupt, hand-edited or future-version backup file: import is rejected with a clear message and the database is untouched; a failure part-way through writing rolls back. Pinned in Task 8.
4. Search text with regex characters, odd case or padding ("pla+", "  JADE "): plain substring match, no crash. Pinned in Task 7.
5. Multi finish with a missing or malformed second colour: validation error on `color_hex_2`; the swatch geometry ignores invalid colours instead of drawing a broken slice. Pinned in Task 5.

---

## File map

```
package.json, vite.config.js, pwa-assets.config.js, playwright.config.js, index.html, .gitignore, README.md
public/icon.svg (+ generated PNG/ICO icons)
.github/workflows/deploy.yml
src/
  main.jsx            bootstrap: init() then render
  App.jsx             route switch + tab bar
  store.js            db + repo singletons, init() (persist + seed presets)
  styles.css
  core/
    color.js          isHex, hexToHsl, colorFamily, COLOR_FAMILIES
    amount.js         LEVELS, unitRemaining, unitLevel, productRemaining, setLevel, setWeight, formatGrams, levelLabel
    validate.js       checkRange, checkOrder
    presets.js        effectiveSettings, diffOverrides
    db.js             createDb(name)
    repo.js           createRepo(db, { now, uuid })
    query.js          groupUnits, matchesSearch, matchesFilters, queryProducts
    export.js         buildExport, parseImport, planImport, applyImport, backupFilename, ImportError, TABLES
    reminder.js       daysSince, needsBackup
    route.js          parseHash
    image.js          fitWithin, resizeImage
  libraries/
    index.js          LIBRARIES, getLibrary
    filament/
      definition.js   materials, finishes, presets, validate, summary, facets...
      swatch-geometry.js  seededRandom, sparklePoints, pieSlices, shade
      index.js        assembles the library object
      Swatch.jsx, FormFields.jsx, DetailInfo.jsx
  ui/
    router.js, useLive.js, toast.jsx, backupActions.js
    ErrorBoundary.jsx, InstallGate.jsx, UpdatePrompt.jsx
    Grid.jsx, Filters.jsx, ProductCard.jsx
    ProductForm.jsx, PhotoView.jsx
    ProductDetail.jsx, UnitRow.jsx, UnitSheet.jsx
    Settings.jsx
tests/
  setup.js
  unit/*.test.js
  e2e/smoke.spec.js
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `vite.config.js`, `pwa-assets.config.js`, `index.html`, `public/icon.svg`, `src/main.jsx`, `src/styles.css`, `tests/setup.js`, `tests/unit/setup.test.js`

**Interfaces:**
- Produces: `npm test` (Vitest, node env, fake-indexeddb loaded), `npm run build`, `npm run dev`, `npm run preview`, `npm run e2e`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "spool-library",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "icons": "pwa-assets-generator"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install preact dexie
npm install -D vite @preact/preset-vite vite-plugin-pwa vitest fake-indexeddb @playwright/test @vite-pwa/assets-generator
npm ls --depth=0
```
Expected: no `ERESOLVE` / `invalid` / `UNMET PEER` lines. If a peer conflict appears (e.g. `@preact/preset-vite` not yet supporting the latest Vite or Preact major), pin the conflicting package one major back (`npm install -D vite@<major-1>` or `npm install preact@10`) and re-run `npm ls`. Record the final versions in the commit message body.

- [ ] **Step 3: Create .gitignore**

```
node_modules
dist
dev-dist
test-results
playwright-report
.DS_Store
```

- [ ] **Step 4: Create vite.config.js**

```js
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/spool-library/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Spool Library',
        short_name: 'Spools',
        description: 'Personal 3D printer filament catalogue',
        start_url: '/spool-library/',
        scope: '/spool-library/',
        display: 'standalone',
        background_color: '#111214',
        theme_color: '#111214',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.js'],
    include: ['tests/unit/**/*.test.js'],
  },
})
```

- [ ] **Step 5: Create icon source and generator config**

`public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#111214"/><circle cx="256" cy="256" r="176" fill="#4cc38a"/><circle cx="256" cy="256" r="176" fill="none" stroke="#2f8f63" stroke-width="24"/><g fill="none" stroke="#3aa877" stroke-width="10"><circle cx="256" cy="256" r="140"/><circle cx="256" cy="256" r="110"/><circle cx="256" cy="256" r="80"/></g><circle cx="256" cy="256" r="52" fill="#111214"/></svg>
```

`pwa-assets.config.js`:
```js
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
})
```

Run: `npm run icons && ls public`
Expected: `apple-touch-icon-180x180.png favicon.ico icon.svg maskable-icon-512x512.png pwa-192x192.png pwa-512x512.png pwa-64x64.png`

- [ ] **Step 6: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#111214" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Spools" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <title>Spool Library</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create styles and a temporary entry point**

`src/styles.css`:
```css
:root { --bg:#111214; --card:#1c1d21; --text:#f2f2f2; --muted:#9a9ca3; --accent:#4cc38a; --danger:#e5484d; --border:#2c2e33; color-scheme: dark; }
@media (prefers-color-scheme: light) {
  :root { --bg:#f6f6f4; --card:#ffffff; --text:#16171a; --muted:#666a70; --accent:#1f8a5b; --danger:#c62828; --border:#e2e2df; color-scheme: light; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.4 -apple-system, system-ui, sans-serif; -webkit-tap-highlight-color:transparent; }
#app { min-height:100dvh; padding:env(safe-area-inset-top) 16px calc(72px + env(safe-area-inset-bottom)); }
h1 { font-size:22px; margin:0; } h2 { font-size:18px; margin:20px 0 8px; } h3 { font-size:16px; margin:16px 0 4px; }
header.bar { display:flex; align-items:center; gap:8px; padding:12px 0; position:sticky; top:0; background:var(--bg); z-index:5; }
header.bar h1 { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
button, .btn { font:inherit; border:1px solid var(--border); background:var(--card); color:var(--text); border-radius:10px; padding:8px 12px; min-height:40px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; }
button:disabled { opacity:.5; }
.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
.danger { color:var(--danger); }
button[aria-pressed="true"] { background:var(--accent); border-color:var(--accent); color:#fff; }
.icon-btn { position:relative; min-width:40px; }
.badge { position:absolute; top:4px; right:4px; width:9px; height:9px; border-radius:50%; background:var(--danger); }
input, select, textarea { font:inherit; font-size:16px; width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); }
label { display:block; font-size:13px; color:var(--muted); margin:10px 0 4px; }
.row { display:flex; gap:8px; margin:8px 0; } .row > * { flex:1; min-width:0; }
.chips { display:flex; gap:6px; overflow-x:auto; padding:6px 0; }
.chips button { white-space:nowrap; min-height:32px; padding:4px 10px; border-radius:16px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:10px; margin-top:8px; }
.tile { --hole:var(--card); display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 6px; background:var(--card); border:1px solid var(--border); border-radius:14px; color:inherit; text-decoration:none; text-align:center; font-size:13px; }
.tile.dim { opacity:.5; }
.muted { color:var(--muted); font-size:13px; }
.error { color:var(--danger); font-size:13px; }
.settings-table { width:100%; border-collapse:collapse; } .settings-table td { padding:4px 0; }
.level { height:8px; background:var(--border); border-radius:4px; overflow:hidden; flex:1; display:block; }
.level > span { display:block; height:100%; background:var(--accent); }
.unit-row { display:flex; align-items:center; gap:10px; width:100%; text-align:left; margin:6px 0; justify-content:flex-start; }
.sheet-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:flex-end; z-index:20; }
.sheet { background:var(--bg); width:100%; border-radius:16px 16px 0 0; padding:16px 16px calc(16px + env(safe-area-inset-bottom)); max-height:85dvh; overflow:auto; }
nav.tabs { position:fixed; left:0; right:0; bottom:0; display:flex; border-top:1px solid var(--border); background:var(--bg); padding-bottom:env(safe-area-inset-bottom); z-index:10; }
nav.tabs a { flex:1; text-align:center; padding:12px; color:var(--muted); text-decoration:none; }
nav.tabs a[aria-current="page"] { color:var(--accent); font-weight:600; }
.toasts { position:fixed; left:16px; right:16px; bottom:calc(80px + env(safe-area-inset-bottom)); display:grid; gap:8px; z-index:30; }
.toast { background:var(--text); color:var(--bg); padding:10px 14px; border-radius:10px; display:flex; gap:8px; align-items:center; justify-content:space-between; }
.gate, .fatal { max-width:480px; margin:10vh auto; text-align:center; }
.gate ol { text-align:left; }
.photo { width:100%; max-height:260px; object-fit:cover; border-radius:12px; }
table.preview { width:100%; border-collapse:collapse; } table.preview td, table.preview th { padding:4px; text-align:left; }
```

`src/main.jsx` (temporary, replaced in Task 9):
```jsx
import { render } from 'preact'
import './styles.css'

render(<h1>Spool Library</h1>, document.getElementById('app'))
```

- [ ] **Step 8: Test setup and a sanity test**

`tests/setup.js`:
```js
import 'fake-indexeddb/auto'
```

`tests/unit/setup.test.js`:
```js
import { expect, test } from 'vitest'

test('fake IndexedDB is available in unit tests', () => {
  expect(globalThis.indexedDB).toBeDefined()
})
```

- [ ] **Step 9: Verify**

Run: `npm test`
Expected: 1 passed.

Run: `npm run build && ls dist`
Expected: build succeeds; `dist` contains `index.html`, `manifest.webmanifest`, `sw.js`, icons.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + Preact PWA with Vitest"
```

---

### Task 2: Colour helpers

**Files:**
- Create: `src/core/color.js`
- Test: `tests/unit/color.test.js`

**Interfaces:**
- Produces: `HEX_RE`, `isHex(v) -> boolean`, `hexToHsl(hex) -> { h: 0-360, s: 0-100, l: 0-100 }`, `COLOR_FAMILIES: string[]`, `colorFamily(hex) -> 'red'|'orange'|'yellow'|'green'|'blue'|'purple'|'neutral'`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, test } from 'vitest'
import { colorFamily, hexToHsl, isHex } from '../../src/core/color.js'

describe('isHex', () => {
  test.each(['#E63946', '#ffffff', '#000000'])('accepts %s', v => expect(isHex(v)).toBe(true))
  test.each(['E63946', '#fff', '#GGGGGG', '', null, undefined, '#1234567'])('rejects %s', v => expect(isHex(v)).toBe(false))
})

describe('hexToHsl', () => {
  test('pure red', () => {
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 })
  })
})

describe('colorFamily', () => {
  test.each([
    ['#E63946', 'red'],
    ['#FF8C00', 'orange'],
    ['#8B4513', 'orange'], // brown lands in orange (documented)
    ['#FFD700', 'yellow'],
    ['#2E8B57', 'green'],
    ['#1E90FF', 'blue'],
    ['#8A2BE2', 'purple'],
    ['#000000', 'neutral'],
    ['#FFFFFF', 'neutral'],
    ['#808080', 'neutral'],
    ['not-a-hex', 'neutral'],
  ])('%s -> %s', (hex, family) => expect(colorFamily(hex)).toBe(family))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/color.test.js`
Expected: FAIL, cannot find module `src/core/color.js`.

- [ ] **Step 3: Implement**

```js
export const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isHex(v) {
  return typeof v === 'string' && HEX_RE.test(v)
}

export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export const COLOR_FAMILIES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'neutral']

export function colorFamily(hex) {
  if (!isHex(hex)) return 'neutral'
  const { h, s, l } = hexToHsl(hex)
  if (s < 15 || l < 12 || l > 92) return 'neutral'
  if (h >= 345 || h < 15) return 'red'
  if (h < 45) return 'orange'
  if (h < 70) return 'yellow'
  if (h < 170) return 'green'
  if (h < 260) return 'blue'
  return 'purple'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/color.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/color.js tests/unit/color.test.js
git commit -m "Add colour helpers and colour family buckets"
```

---

### Task 3: Amount maths

**Files:**
- Create: `src/core/amount.js`
- Test: `tests/unit/amount.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (a "cap" is `{ net_g, empty_spool_g }` taken from the product):
  - `LEVELS: { value: number, label: string }[]` (1 Full, 0.75 3/4, 0.5 1/2, 0.25 1/4, 0.1 Low, 0 Empty)
  - `unitRemaining(unit, cap) -> number` (grams, or count in count mode)
  - `unitLevel(unit, cap) -> number` (0-1)
  - `isEstimate(unit) -> boolean`, `isActive(unit) -> boolean`
  - `productRemaining(units, cap) -> number` (active units only)
  - `setLevel(unit, level) -> unit`, `setWeight(unit, gross_g, cap) -> unit`
  - `formatGrams(g, estimate = false) -> string` ("600 g", "~1.4 kg")
  - `levelLabel(level) -> string`

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, test } from 'vitest'
import {
  LEVELS, formatGrams, isActive, isEstimate, levelLabel, productRemaining,
  setLevel, setWeight, unitLevel, unitRemaining,
} from '../../src/core/amount.js'

const cap = { net_g: 1000, empty_spool_g: 250 }

describe('unitRemaining', () => {
  test('level mode rounds level * net', () => {
    expect(unitRemaining({ amount_mode: 'level', level: 0.75 }, cap)).toBe(750)
  })
  test('weight mode subtracts empty spool', () => {
    expect(unitRemaining({ amount_mode: 'weight', gross_g: 850 }, cap)).toBe(600)
  })
  test('weight mode caps at net weight', () => {
    expect(unitRemaining({ amount_mode: 'weight', gross_g: 1400 }, cap)).toBe(1000)
  })
  // Review focus 1: reading below empty spool weight, including 0
  test.each([200, 0, 250])('weight %i at or below empty spool gives 0, never negative', g => {
    expect(unitRemaining({ amount_mode: 'weight', gross_g: g }, cap)).toBe(0)
  })
  test('count mode returns count', () => {
    expect(unitRemaining({ amount_mode: 'count', count: 5 }, cap)).toBe(5)
  })
})

describe('unitLevel', () => {
  test('derived from weight', () => {
    expect(unitLevel({ amount_mode: 'weight', gross_g: 750 }, cap)).toBe(0.5)
  })
  test('level mode returns stored level', () => {
    expect(unitLevel({ amount_mode: 'level', level: 0.25 }, cap)).toBe(0.25)
  })
})

describe('productRemaining', () => {
  test('sums only active (not archived, not deleted) units', () => {
    const units = [
      { amount_mode: 'level', level: 1 },
      { amount_mode: 'weight', gross_g: 650 },
      { amount_mode: 'level', level: 1, archived: true },
      { amount_mode: 'level', level: 1, deleted: true },
    ]
    expect(productRemaining(units, cap)).toBe(1400)
  })
})

describe('setters', () => {
  test('setLevel switches mode and clears weight', () => {
    expect(setLevel({ id: 'u', amount_mode: 'weight', gross_g: 900 }, 0.5))
      .toEqual({ id: 'u', amount_mode: 'level', level: 0.5, gross_g: null })
  })
  test('setWeight stores reading and derived level', () => {
    expect(setWeight({ id: 'u', amount_mode: 'level', level: 1 }, 750, cap))
      .toEqual({ id: 'u', amount_mode: 'weight', gross_g: 750, level: 0.5 })
  })
})

describe('formatting and flags', () => {
  test('formatGrams', () => {
    expect(formatGrams(600)).toBe('600 g')
    expect(formatGrams(1400, true)).toBe('~1.4 kg')
  })
  test('levelLabel', () => {
    expect(levelLabel(1)).toBe('Full')
    expect(levelLabel(0.1)).toBe('Low')
    expect(levelLabel(0.6)).toBe('60%')
  })
  test('isEstimate and isActive', () => {
    expect(isEstimate({ amount_mode: 'level' })).toBe(true)
    expect(isEstimate({ amount_mode: 'weight' })).toBe(false)
    expect(isActive({ archived: false })).toBe(true)
    expect(isActive({ archived: true })).toBe(false)
  })
  test('LEVELS has six steps from Full to Empty', () => {
    expect(LEVELS.map(l => l.value)).toEqual([1, 0.75, 0.5, 0.25, 0.1, 0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/amount.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
export const LEVELS = [
  { value: 1, label: 'Full' },
  { value: 0.75, label: '3/4' },
  { value: 0.5, label: '1/2' },
  { value: 0.25, label: '1/4' },
  { value: 0.1, label: 'Low' },
  { value: 0, label: 'Empty' },
]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function unitRemaining(unit, cap) {
  if (unit.amount_mode === 'count') return unit.count ?? 0
  if (unit.amount_mode === 'weight') return clamp((unit.gross_g ?? 0) - cap.empty_spool_g, 0, cap.net_g)
  return Math.round((unit.level ?? 0) * cap.net_g)
}

export function unitLevel(unit, cap) {
  if (unit.amount_mode === 'weight') return cap.net_g > 0 ? unitRemaining(unit, cap) / cap.net_g : 0
  return unit.level ?? 0
}

export function isEstimate(unit) {
  return unit.amount_mode === 'level'
}

export function isActive(unit) {
  return !unit.deleted && !unit.archived
}

export function productRemaining(units, cap) {
  return units.filter(isActive).reduce((sum, u) => sum + unitRemaining(u, cap), 0)
}

export function setLevel(unit, level) {
  return { ...unit, amount_mode: 'level', level, gross_g: null }
}

export function setWeight(unit, gross_g, cap) {
  const next = { ...unit, amount_mode: 'weight', gross_g }
  return { ...next, level: unitLevel(next, cap) }
}

export function formatGrams(g, estimate = false) {
  const text = g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`
  return estimate ? `~${text}` : text
}

export function levelLabel(level) {
  return LEVELS.find(l => l.value === level)?.label ?? `${Math.round(level * 100)}%`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/amount.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/amount.js tests/unit/amount.test.js
git commit -m "Add spool amount maths"
```

---

### Task 4: Validation helpers and preset merge

**Files:**
- Create: `src/core/validate.js`, `src/core/presets.js`
- Test: `tests/unit/validate.test.js`, `tests/unit/presets.test.js`

**Interfaces:**
- Produces:
  - `checkRange(errors, key, value, min, max, { required = false } = {})` mutates `errors[key]` with `'Required'` or `` `Must be ${min}-${max}` ``.
  - `checkOrder(errors, key, lo, hi)` sets `errors[key] = 'Max must be at least min'` when both set and `lo > hi` (and no error already on `key`).
  - `effectiveSettings(keys, preset, overrides) -> { values: object, overridden: Set<string> }`. An override counts only when it is not null/undefined and differs from the preset value. Blank means "use the preset".
  - `diffOverrides(keys, preset, values) -> object` keeps only keys whose value is non-null and differs from the preset.

- [ ] **Step 1: Write the failing tests**

`tests/unit/validate.test.js`:
```js
import { expect, test } from 'vitest'
import { checkOrder, checkRange } from '../../src/core/validate.js'

test('checkRange: blank optional is fine, blank required errors', () => {
  const e = {}
  checkRange(e, 'a', null, 0, 10)
  checkRange(e, 'b', undefined, 0, 10, { required: true })
  expect(e).toEqual({ b: 'Required' })
})

test('checkRange: out of range and non-numbers error', () => {
  const e = {}
  checkRange(e, 'low', -1, 0, 10)
  checkRange(e, 'high', 11, 0, 10)
  checkRange(e, 'nan', Number.NaN, 0, 10)
  checkRange(e, 'ok', 10, 0, 10)
  expect(e).toEqual({ low: 'Must be 0-10', high: 'Must be 0-10', nan: 'Must be 0-10' })
})

test('checkOrder flags max below min, skips when blank or already errored', () => {
  const e = { c: 'Must be 0-10' }
  checkOrder(e, 'a', 5, 4)
  checkOrder(e, 'b', null, 4)
  checkOrder(e, 'c', 9, 1)
  expect(e).toEqual({ a: 'Max must be at least min', c: 'Must be 0-10' })
})
```

`tests/unit/presets.test.js`:
```js
import { expect, test } from 'vitest'
import { diffOverrides, effectiveSettings } from '../../src/core/presets.js'

const keys = ['nozzle_min', 'nozzle_max', 'bed_min']
const preset = { nozzle_min: 190, nozzle_max: 230, bed_min: 55 }

test('effectiveSettings merges overrides and reports which differ', () => {
  const { values, overridden } = effectiveSettings(keys, preset, { nozzle_max: 240, bed_min: 55 })
  expect(values).toEqual({ nozzle_min: 190, nozzle_max: 240, bed_min: 55 })
  expect([...overridden]).toEqual(['nozzle_max'])
})

test('effectiveSettings treats null override as "use preset"', () => {
  const { values, overridden } = effectiveSettings(keys, preset, { nozzle_min: null })
  expect(values.nozzle_min).toBe(190)
  expect(overridden.size).toBe(0)
})

test('effectiveSettings tolerates missing preset and overrides', () => {
  expect(effectiveSettings(keys, undefined, undefined).values).toEqual({ nozzle_min: null, nozzle_max: null, bed_min: null })
})

test('diffOverrides keeps only non-null values that differ', () => {
  expect(diffOverrides(keys, preset, { nozzle_min: 190, nozzle_max: 245, bed_min: null })).toEqual({ nozzle_max: 245 })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/validate.test.js tests/unit/presets.test.js`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/validate.js`:
```js
export function checkRange(errors, key, value, min, max, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) errors[key] = 'Required'
    return
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors[key] = `Must be ${min}-${max}`
  }
}

export function checkOrder(errors, key, lo, hi) {
  if (lo == null || hi == null || errors[key]) return
  if (lo > hi) errors[key] = 'Max must be at least min'
}
```

`src/core/presets.js`:
```js
const isSet = v => v !== null && v !== undefined

export function effectiveSettings(keys, preset = {}, overrides = {}) {
  const values = {}
  const overridden = new Set()
  for (const k of keys) {
    const base = preset?.[k] ?? null
    const o = overrides?.[k]
    if (isSet(o) && o !== base) {
      values[k] = o
      overridden.add(k)
    } else {
      values[k] = base
    }
  }
  return { values, overridden }
}

export function diffOverrides(keys, preset = {}, values = {}) {
  const out = {}
  for (const k of keys) {
    const v = values?.[k]
    if (isSet(v) && v !== (preset?.[k] ?? null)) out[k] = v
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/validate.test.js tests/unit/presets.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/validate.js src/core/presets.js tests/unit/validate.test.js tests/unit/presets.test.js
git commit -m "Add validation helpers and preset override merge"
```

---

### Task 5: Filament library definition and swatch geometry

**Files:**
- Create: `src/libraries/filament/definition.js`, `src/libraries/filament/swatch-geometry.js`
- Test: `tests/unit/filament.test.js`, `tests/unit/swatch-geometry.test.js`

**Interfaces:**
- Consumes: `isHex`, `colorFamily`, `COLOR_FAMILIES` (Task 2); `productRemaining`, `formatGrams`, `isActive`, `isEstimate` (Task 3); `checkRange`, `checkOrder`, `effectiveSettings` (Task 4).
- Produces from `definition.js`:
  - `MATERIALS`, `FINISHES`, `SETTING_KEYS`, `SETTING_LABELS`, `presets` (material -> settings), `preset_key = 'material'`
  - `newFields() -> fields`, `defaultName(product) -> string`, `capOf(product) -> { net_g, empty_spool_g }`
  - `formatRange(min, max, unit) -> string|null`, `formatPresetLine(preset) -> string`
  - `validateSettings(values) -> errors`, `validate(product, preset) -> errors`
  - `facets: { key, label, options, get(product) }[]`, `summary(product, units) -> string`
- Produces from `swatch-geometry.js`: `seededRandom(seed) -> () => number`, `sparklePoints(seed, count = 36) -> {x,y,r,o}[]`, `pieSlices(colors) -> { color, d }[]` (empty when fewer than 2 colours), `shade(hex, amount) -> hex` (amount -1..1).

- [ ] **Step 1: Write the failing tests**

`tests/unit/filament.test.js`:
```js
import { describe, expect, test } from 'vitest'
import {
  FINISHES, MATERIALS, capOf, defaultName, facets, formatPresetLine, formatRange,
  newFields, presets, summary, validate, validateSettings,
} from '../../src/libraries/filament/definition.js'

const product = (fields = {}, extra = {}) => ({ library: 'filament', brand: 'Bambu', name: 'x', fields: { ...newFields(), ...fields }, ...extra })

describe('catalogue lists', () => {
  test('materials include the support and wood types', () => {
    expect(MATERIALS).toEqual(expect.arrayContaining(['PLA Wood', 'PLA Support', 'PLA/PETG Support']))
  })
  test('finishes include wood', () => {
    expect(FINISHES).toContain('wood')
  })
  test('every material has a preset', () => {
    for (const m of MATERIALS) expect(presets[m]).toBeDefined()
  })
  test('support presets match the Bambu datasheets', () => {
    expect(presets['PLA Support']).toEqual({ nozzle_min: 220, nozzle_max: 230, bed_min: 35, bed_max: 45, dry_temp: 55, dry_hours: 8, speed_max: 200 })
    expect(presets['PLA/PETG Support']).toEqual({ nozzle_min: 190, nozzle_max: 240, bed_min: 35, bed_max: 60, dry_temp: 75, dry_hours: 8, speed_max: 100 })
    expect(presets['PLA Wood']).toEqual({ nozzle_min: 210, nozzle_max: 235, bed_min: 45, bed_max: 60, dry_temp: null, dry_hours: null, speed_max: 150 })
  })
})

describe('defaultName', () => {
  test('joins brand, material and colour name', () => {
    expect(defaultName(product({ material: 'PETG', color_name: 'Jade White' }))).toBe('Bambu PETG Jade White')
  })
  // Review focus 2: everything optional blank
  test('falls back to the material when brand and colour name are blank', () => {
    expect(defaultName(product({ material: 'PETG', color_name: '  ' }, { brand: '' }))).toBe('PETG')
  })
})

describe('validate', () => {
  test('defaults are valid', () => {
    expect(validate(product(), presets.PLA)).toEqual({})
  })
  test('bad hex, material, finish and weights', () => {
    const e = validate(product({ color_hex: 'red', material: 'Cheese', finish: 'shiny', net_g: 0, empty_spool_g: null }), {})
    expect(e).toMatchObject({ color_hex: 'Use #RRGGBB', material: 'Pick a material', finish: 'Pick a finish', net_g: 'Must be 1-5000', empty_spool_g: 'Required' })
  })
  // Review focus 5: multi finish without a valid second colour
  test('multi finish needs a valid second colour', () => {
    expect(validate(product({ finish: 'multi', color_hex_2: null }), presets.PLA).color_hex_2).toMatch(/second colour/)
    expect(validate(product({ finish: 'multi', color_hex_2: '#12' }), presets.PLA).color_hex_2).toMatch(/second colour/)
    expect(validate(product({ finish: 'multi', color_hex_2: '#123456', color_hex_3: 'zzz' }), presets.PLA)).toEqual({ color_hex_3: 'Use #RRGGBB' })
  })
  test('override that pushes nozzle min above preset max is an error', () => {
    expect(validate(product({ overrides: { nozzle_min: 240 } }), presets.PLA).nozzle_max).toBe('Max must be at least min')
  })
})

describe('validateSettings', () => {
  test('ranges', () => {
    expect(validateSettings({ nozzle_min: 100, nozzle_max: 400, bed_min: 50, bed_max: 40, dry_temp: 20, dry_hours: 60, speed_max: 0 })).toEqual({
      nozzle_min: 'Must be 150-350', nozzle_max: 'Must be 150-350', bed_max: 'Max must be at least min',
      dry_temp: 'Must be 30-100', dry_hours: 'Must be 1-48', speed_max: 'Must be 1-1000',
    })
  })
  test('all blank is valid', () => {
    expect(validateSettings(presets.Other)).toEqual({})
  })
})

describe('formatting', () => {
  test('formatRange', () => {
    expect(formatRange(190, 230, '°C')).toBe('190-230 °C')
    expect(formatRange(55, 55, '°C')).toBe('55 °C')
    expect(formatRange(null, 60, '°C')).toBe('60 °C')
    expect(formatRange(null, null, '°C')).toBeNull()
  })
  test('formatPresetLine', () => {
    expect(formatPresetLine(presets.PLA)).toBe('190-230 °C · bed 55-60 °C')
    expect(formatPresetLine(presets.Other)).toBe('No settings')
  })
})

describe('facets and summary', () => {
  test('facets read material, finish and colour family', () => {
    const p = product({ material: 'PETG', finish: 'silk', color_hex: '#1E90FF' })
    expect(Object.fromEntries(facets.map(f => [f.key, f.get(p)]))).toEqual({ material: 'PETG', finish: 'silk', color: 'blue' })
  })
  test('summary counts active spools and marks estimates', () => {
    const p = product()
    const units = [{ amount_mode: 'level', level: 1 }, { amount_mode: 'level', level: 0.5 }, { amount_mode: 'level', level: 1, archived: true }]
    expect(summary(p, units)).toBe('PLA · ×2 · ~1.5 kg')
  })
  test('capOf', () => {
    expect(capOf(product({ net_g: 500, empty_spool_g: 180 }))).toEqual({ net_g: 500, empty_spool_g: 180 })
  })
})
```

`tests/unit/swatch-geometry.test.js`:
```js
import { expect, test } from 'vitest'
import { pieSlices, shade, sparklePoints } from '../../src/libraries/filament/swatch-geometry.js'

test('sparklePoints is deterministic per seed and inside the swatch', () => {
  const a = sparklePoints('abc')
  expect(sparklePoints('abc')).toEqual(a)
  expect(sparklePoints('abd')).not.toEqual(a)
  expect(a).toHaveLength(36)
  for (const p of a) {
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(100)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeLessThanOrEqual(100)
  }
})

test('pieSlices makes one slice per colour starting at the top', () => {
  const s = pieSlices(['#ff0000', '#0000ff'])
  expect(s).toHaveLength(2)
  expect(s[0].color).toBe('#ff0000')
  expect(s[0].d.startsWith('M50 50 L50.00 2.00')).toBe(true)
  expect(pieSlices(['#ff0000', '#00ff00', '#0000ff'])).toHaveLength(3)
})

test('pieSlices returns nothing for fewer than two colours', () => {
  expect(pieSlices(['#ff0000'])).toEqual([])
})

test('shade darkens and lightens', () => {
  expect(shade('#808080', -0.5)).toBe('#404040')
  expect(shade('#000000', 1)).toBe('#ffffff')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/filament.test.js tests/unit/swatch-geometry.test.js`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement definition.js**

```js
import { COLOR_FAMILIES, colorFamily, isHex } from '../../core/color.js'
import { formatGrams, isActive, isEstimate, productRemaining } from '../../core/amount.js'
import { effectiveSettings } from '../../core/presets.js'
import { checkOrder, checkRange } from '../../core/validate.js'

export const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'PLA Wood', 'PLA Support', 'PLA/PETG Support', 'Other']
export const FINISHES = ['basic', 'matte', 'silk', 'sparkle', 'translucent', 'multi', 'glow', 'wood']
export const SETTING_KEYS = ['nozzle_min', 'nozzle_max', 'bed_min', 'bed_max', 'dry_temp', 'dry_hours', 'speed_max']
export const SETTING_LABELS = {
  nozzle_min: 'Nozzle min',
  nozzle_max: 'Nozzle max',
  bed_min: 'Bed min',
  bed_max: 'Bed max',
  dry_temp: 'Dry °C',
  dry_hours: 'Dry hours',
  speed_max: 'Max speed (mm/s)',
}

const s = (nozzle_min, nozzle_max, bed_min, bed_max, dry_temp, dry_hours, speed_max) =>
  ({ nozzle_min, nozzle_max, bed_min, bed_max, dry_temp, dry_hours, speed_max })

export const presets = {
  PLA: s(190, 230, 55, 60, 55, 8, null),
  PETG: s(230, 260, 70, 80, 65, 8, null),
  ABS: s(240, 270, 90, 100, 80, 8, null),
  ASA: s(240, 270, 90, 100, 80, 8, null),
  TPU: s(210, 240, 30, 35, 70, 8, null),
  Nylon: s(260, 290, 80, 100, 80, 12, null),
  'PLA Wood': s(210, 235, 45, 60, null, null, 150),
  'PLA Support': s(220, 230, 35, 45, 55, 8, 200),
  'PLA/PETG Support': s(190, 240, 35, 60, 75, 8, 100),
  Other: s(null, null, null, null, null, null, null),
}

export const preset_key = 'material'

export function newFields() {
  return {
    material: 'PLA',
    color_name: '',
    color_hex: '#888888',
    color_hex_2: null,
    color_hex_3: null,
    finish: 'basic',
    diameter: 1.75,
    net_g: 1000,
    empty_spool_g: 250,
    overrides: {},
  }
}

export function defaultName(product) {
  return [product.brand, product.fields.material, product.fields.color_name]
    .map(v => (v ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export function capOf(product) {
  return { net_g: product.fields.net_g, empty_spool_g: product.fields.empty_spool_g }
}

export function formatRange(min, max, unit) {
  if (min == null && max == null) return null
  if (min == null || max == null || min === max) return `${min ?? max} ${unit}`
  return `${min}-${max} ${unit}`
}

export function formatPresetLine(preset) {
  const nozzle = formatRange(preset.nozzle_min, preset.nozzle_max, '°C')
  const bed = formatRange(preset.bed_min, preset.bed_max, '°C')
  return [nozzle, bed && `bed ${bed}`].filter(Boolean).join(' · ') || 'No settings'
}

export function validateSettings(v) {
  const e = {}
  checkRange(e, 'nozzle_min', v.nozzle_min, 150, 350)
  checkRange(e, 'nozzle_max', v.nozzle_max, 150, 350)
  checkOrder(e, 'nozzle_max', v.nozzle_min, v.nozzle_max)
  checkRange(e, 'bed_min', v.bed_min, 0, 120)
  checkRange(e, 'bed_max', v.bed_max, 0, 120)
  checkOrder(e, 'bed_max', v.bed_min, v.bed_max)
  checkRange(e, 'dry_temp', v.dry_temp, 30, 100)
  checkRange(e, 'dry_hours', v.dry_hours, 1, 48)
  checkRange(e, 'speed_max', v.speed_max, 1, 1000)
  return e
}

export function validate(product, preset = {}) {
  const f = product.fields
  const e = {}
  if (!MATERIALS.includes(f.material)) e.material = 'Pick a material'
  if (!FINISHES.includes(f.finish)) e.finish = 'Pick a finish'
  if (!isHex(f.color_hex)) e.color_hex = 'Use #RRGGBB'
  if (f.finish === 'multi' && !isHex(f.color_hex_2)) e.color_hex_2 = 'Multi needs a second colour (#RRGGBB)'
  else if (f.color_hex_2 != null && !isHex(f.color_hex_2)) e.color_hex_2 = 'Use #RRGGBB'
  if (f.color_hex_3 != null && !isHex(f.color_hex_3)) e.color_hex_3 = 'Use #RRGGBB'
  checkRange(e, 'diameter', f.diameter, 0.5, 5, { required: true })
  checkRange(e, 'net_g', f.net_g, 1, 5000, { required: true })
  checkRange(e, 'empty_spool_g', f.empty_spool_g, 1, 5000, { required: true })
  Object.assign(e, validateSettings(effectiveSettings(SETTING_KEYS, preset, f.overrides).values))
  return e
}

export const facets = [
  { key: 'material', label: 'Material', options: MATERIALS, get: p => p.fields.material },
  { key: 'finish', label: 'Finish', options: FINISHES, get: p => p.fields.finish },
  { key: 'color', label: 'Colour', options: COLOR_FAMILIES, get: p => colorFamily(p.fields.color_hex) },
]

export function summary(product, units) {
  const active = units.filter(isActive)
  const grams = productRemaining(units, capOf(product))
  return `${product.fields.material} · ×${active.length} · ${formatGrams(grams, active.some(isEstimate))}`
}
```

- [ ] **Step 4: Implement swatch-geometry.js**

```js
export function seededRandom(seed) {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sparklePoints(seed, count = 36) {
  const rnd = seededRandom(seed)
  return Array.from({ length: count }, () => ({
    x: 4 + rnd() * 92,
    y: 4 + rnd() * 92,
    r: 0.6 + rnd() * 1.4,
    o: 0.5 + rnd() * 0.5,
  }))
}

export function pieSlices(colors, cx = 50, cy = 50, r = 48) {
  const n = colors.length
  if (n < 2) return []
  return colors.map((color, i) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
    const x0 = (cx + r * Math.cos(a0)).toFixed(2)
    const y0 = (cy + r * Math.sin(a0)).toFixed(2)
    const x1 = (cx + r * Math.cos(a1)).toFixed(2)
    const y1 = (cy + r * Math.sin(a1)).toFixed(2)
    const large = a1 - a0 > Math.PI ? 1 : 0
    return { color, d: `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z` }
  })
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount))
  return `#${channels.map(c => c.toString(16).padStart(2, '0')).join('')}`
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/filament.test.js tests/unit/swatch-geometry.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/libraries/filament tests/unit/filament.test.js tests/unit/swatch-geometry.test.js
git commit -m "Add filament library definition and swatch geometry"
```

---

### Task 6: Database and repository

**Files:**
- Create: `src/core/db.js`, `src/core/repo.js`
- Test: `tests/unit/repo.test.js`

**Interfaces:**
- Consumes: Dexie.
- Produces:
  - `createDb(name = 'spool-library') -> Dexie` with tables `products(id, library, updated_at)`, `units(id, product_id, updated_at)`, `presets(id, library)`, `photos(id)`, `meta(key)`.
  - `createRepo(db, { now, uuid }) -> repo` with:
    - `listProducts(library) -> Promise<product[]>` (no tombstones)
    - `getProduct(id) -> Promise<product|undefined>` (undefined if missing or tombstoned)
    - `saveProduct(product) -> Promise<product>` (insert or update; keeps `created_at`, bumps `updated_at`)
    - `createProduct(product) -> Promise<product>` (product + one Full unit, one transaction)
    - `deleteProduct(id) -> Promise<void>` (tombstones product, its units and its photo)
    - `listUnits(productId) -> Promise<unit[]>` (includes archived, excludes tombstones)
    - `listAllUnits() -> Promise<unit[]>` (excludes tombstones)
    - `addUnit(productId) -> Promise<unit>` (Full, level mode)
    - `saveUnit(unit) -> Promise<unit>`, `deleteUnit(id)`
    - `seedPresets(library, presets)` (adds only missing materials), `listPresets(library) -> Promise<{ [material]: preset }>`, `savePreset(library, material, settings)`
    - `savePhoto({ type, data }) -> Promise<id>`, `getPhoto(id) -> Promise<photo|undefined>`, `deletePhoto(id)`
    - `getMeta(key) -> Promise<value|null>`, `setMeta(key, value)`
  - Unit shape: `{ id, product_id, amount_mode, level, gross_g, count, location, archived, created_at, updated_at, deleted }`.

- [ ] **Step 1: Write the failing test**

```js
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '../../src/core/db.js'
import { createRepo } from '../../src/core/repo.js'

let repo
let db

function clock() {
  let t = 0
  return () => new Date(Date.UTC(2026, 0, 1) + (t++) * 1000).toISOString()
}

beforeEach(() => {
  db = createDb(`test-${crypto.randomUUID()}`)
  let n = 0
  repo = createRepo(db, { now: clock(), uuid: () => `id-${++n}` })
})

const base = { library: 'filament', name: 'Black PLA', brand: 'Bambu', fields: { material: 'PLA', net_g: 1000, empty_spool_g: 250 } }

describe('products', () => {
  test('createProduct adds the product and one full spool', async () => {
    const p = await repo.createProduct(base)
    expect(p).toMatchObject({ id: 'id-1', deleted: false, created_at: p.updated_at })
    const units = await repo.listUnits(p.id)
    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({ product_id: p.id, amount_mode: 'level', level: 1, archived: false, deleted: false })
  })

  test('saveProduct keeps created_at and bumps updated_at', async () => {
    const p = await repo.saveProduct(base)
    const updated = await repo.saveProduct({ ...p, name: 'Renamed' })
    expect(updated.created_at).toBe(p.created_at)
    expect(updated.updated_at > p.updated_at).toBe(true)
    expect((await repo.getProduct(p.id)).name).toBe('Renamed')
  })

  test('listProducts filters by library and hides tombstones', async () => {
    const a = await repo.createProduct(base)
    await repo.createProduct({ ...base, library: 'electronics' })
    const c = await repo.createProduct(base)
    await repo.deleteProduct(c.id)
    expect((await repo.listProducts('filament')).map(p => p.id)).toEqual([a.id])
  })

  test('deleteProduct tombstones product, units and photo', async () => {
    const photoId = await repo.savePhoto({ type: 'image/jpeg', data: new Uint8Array([1, 2]).buffer })
    const p = await repo.createProduct({ ...base, photo_id: photoId })
    await repo.deleteProduct(p.id)
    expect(await repo.getProduct(p.id)).toBeUndefined()
    expect(await repo.listUnits(p.id)).toEqual([])
    expect(await repo.getPhoto(photoId)).toBeUndefined()
    expect((await db.products.get(p.id)).deleted).toBe(true)
    expect((await db.units.where('product_id').equals(p.id).toArray()).every(u => u.deleted)).toBe(true)
  })
})

describe('units', () => {
  test('addUnit, archive and delete', async () => {
    const p = await repo.createProduct(base)
    const u2 = await repo.addUnit(p.id)
    await repo.saveUnit({ ...u2, archived: true })
    expect((await repo.listUnits(p.id)).map(u => u.archived)).toEqual([false, true])
    await repo.deleteUnit(u2.id)
    expect(await repo.listUnits(p.id)).toHaveLength(1)
    expect(await repo.listAllUnits()).toHaveLength(1)
  })
})

describe('presets', () => {
  test('seedPresets adds missing materials without overwriting edits', async () => {
    await repo.seedPresets('filament', { PLA: { nozzle_min: 190 }, PETG: { nozzle_min: 230 } })
    await repo.savePreset('filament', 'PLA', { nozzle_min: 200 })
    await repo.seedPresets('filament', { PLA: { nozzle_min: 190 }, PETG: { nozzle_min: 230 }, TPU: { nozzle_min: 210 } })
    const presets = await repo.listPresets('filament')
    expect(presets.PLA.nozzle_min).toBe(200)
    expect(presets.PETG.nozzle_min).toBe(230)
    expect(presets.TPU.nozzle_min).toBe(210)
    expect(presets.PLA.updated_at).toBeTypeOf('string')
  })
})

describe('photos and meta', () => {
  test('photo round trip keeps bytes', async () => {
    const id = await repo.savePhoto({ type: 'image/jpeg', data: new Uint8Array([9, 8, 7]).buffer })
    const photo = await repo.getPhoto(id)
    expect(photo.type).toBe('image/jpeg')
    expect([...new Uint8Array(photo.data)]).toEqual([9, 8, 7])
  })
  test('meta get and set', async () => {
    expect(await repo.getMeta('last_backup_at')).toBeNull()
    await repo.setMeta('last_backup_at', '2026-01-01T00:00:00.000Z')
    expect(await repo.getMeta('last_backup_at')).toBe('2026-01-01T00:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/repo.test.js`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement db.js**

```js
import Dexie from 'dexie'

export function createDb(name = 'spool-library') {
  const db = new Dexie(name)
  db.version(1).stores({
    products: 'id, library, updated_at',
    units: 'id, product_id, updated_at',
    presets: 'id, library',
    photos: 'id',
    meta: 'key',
  })
  return db
}
```

- [ ] **Step 4: Implement repo.js**

```js
const live = rows => rows.filter(r => r && !r.deleted)

export function createRepo(db, { now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  async function listProducts(library) {
    return live(await db.products.where('library').equals(library).toArray())
  }

  async function getProduct(id) {
    const p = await db.products.get(id)
    return p && !p.deleted ? p : undefined
  }

  async function saveProduct(product) {
    const t = now()
    const existing = product.id ? await db.products.get(product.id) : undefined
    const rec = {
      deleted: false,
      ...existing,
      ...product,
      id: product.id ?? uuid(),
      created_at: existing?.created_at ?? t,
      updated_at: t,
    }
    await db.products.put(rec)
    return rec
  }

  function newUnit(productId) {
    const t = now()
    return {
      id: uuid(), product_id: productId, amount_mode: 'level', level: 1, gross_g: null, count: null,
      location: '', archived: false, created_at: t, updated_at: t, deleted: false,
    }
  }

  async function createProduct(product) {
    return db.transaction('rw', db.products, db.units, async () => {
      const p = await saveProduct(product)
      await db.units.put(newUnit(p.id))
      return p
    })
  }

  async function deleteProduct(id) {
    await db.transaction('rw', db.products, db.units, db.photos, async () => {
      const t = now()
      const p = await db.products.get(id)
      if (!p) return
      await db.products.update(id, { deleted: true, updated_at: t })
      const units = await db.units.where('product_id').equals(id).toArray()
      await Promise.all(units.map(u => db.units.update(u.id, { deleted: true, updated_at: t })))
      if (p.photo_id) await db.photos.update(p.photo_id, { deleted: true, updated_at: t })
    })
  }

  async function listUnits(productId) {
    return live(await db.units.where('product_id').equals(productId).toArray())
  }

  async function listAllUnits() {
    return live(await db.units.toArray())
  }

  async function addUnit(productId) {
    const u = newUnit(productId)
    await db.units.put(u)
    return u
  }

  async function saveUnit(unit) {
    const rec = { ...unit, updated_at: now() }
    await db.units.put(rec)
    return rec
  }

  async function deleteUnit(id) {
    await db.units.update(id, { deleted: true, updated_at: now() })
  }

  async function seedPresets(library, presets) {
    const ids = Object.keys(presets).map(m => `${library}:${m}`)
    const existing = await db.presets.bulkGet(ids)
    const t = now()
    const missing = Object.entries(presets)
      .filter((_, i) => !existing[i])
      .map(([material, settings]) => ({ ...settings, id: `${library}:${material}`, library, material, updated_at: t }))
    if (missing.length) await db.presets.bulkPut(missing)
  }

  async function listPresets(library) {
    const rows = await db.presets.where('library').equals(library).toArray()
    return Object.fromEntries(rows.map(r => [r.material, r]))
  }

  async function savePreset(library, material, settings) {
    await db.presets.put({ ...settings, id: `${library}:${material}`, library, material, updated_at: now() })
  }

  async function savePhoto({ type, data }) {
    const id = uuid()
    await db.photos.put({ id, type, data, updated_at: now(), deleted: false })
    return id
  }

  async function getPhoto(id) {
    const p = await db.photos.get(id)
    return p && !p.deleted ? p : undefined
  }

  async function deletePhoto(id) {
    await db.photos.update(id, { deleted: true, updated_at: now() })
  }

  async function getMeta(key) {
    return (await db.meta.get(key))?.value ?? null
  }

  async function setMeta(key, value) {
    await db.meta.put({ key, value })
  }

  return {
    db, listProducts, getProduct, saveProduct, createProduct, deleteProduct,
    listUnits, listAllUnits, addUnit, saveUnit, deleteUnit,
    seedPresets, listPresets, savePreset, savePhoto, getPhoto, deletePhoto, getMeta, setMeta,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/repo.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/db.js src/core/repo.js tests/unit/repo.test.js
git commit -m "Add Dexie database and repository with tombstones"
```

---

### Task 7: Search, filter and sort

**Files:**
- Create: `src/core/query.js`
- Test: `tests/unit/query.test.js`

**Interfaces:**
- Consumes: `isActive`, `productRemaining` (Task 3); a library object with `facets` and `capOf` (Task 5).
- Produces:
  - `groupUnits(units) -> Map<productId, unit[]>` (skips tombstones)
  - `matchesSearch(product, search) -> boolean` (case-insensitive substring over name, brand, colour name, notes)
  - `matchesFilters(product, lib, filters) -> boolean` (AND across facets, OR within; empty selection = no filter)
  - `queryProducts(products, unitsByProduct, lib, { search, filters, sort: 'name'|'remaining'|'updated', showArchived }) -> row[]` where `row = { product, units, activeCount, remaining, latest }`. Products with no active units sort last.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, test } from 'vitest'
import { groupUnits, matchesSearch, queryProducts } from '../../src/core/query.js'
import * as filament from '../../src/libraries/filament/definition.js'

const lib = filament
const prod = (id, name, fields, extra = {}) => ({
  id, name, brand: 'Bambu', notes: '', updated_at: `2026-01-0${id}T00:00:00.000Z`, library: 'filament',
  fields: { ...filament.newFields(), ...fields }, ...extra,
})
const unit = (id, product_id, extra = {}) => ({ id, product_id, amount_mode: 'level', level: 1, archived: false, deleted: false, updated_at: '2026-01-01T00:00:00.000Z', ...extra })

const products = [
  prod('1', 'Bambu PLA Black', { material: 'PLA', finish: 'matte', color_hex: '#111111', color_name: 'Black' }),
  prod('2', 'Bambu PETG Jade White', { material: 'PETG', color_hex: '#F0F0E8', color_name: 'Jade White' }),
  prod('3', 'Elegoo PLA Blue', { material: 'PLA', finish: 'silk', color_hex: '#1E90FF', color_name: 'Blue' }, { brand: 'Elegoo' }),
]
const units = groupUnits([
  unit('a', '1', { level: 0.25 }),
  unit('b', '2'), unit('c', '2'),
  unit('d', '3', { archived: true }),
  unit('e', '3', { deleted: true }),
])

describe('groupUnits', () => {
  test('groups by product and drops tombstones', () => {
    expect(units.get('3').map(u => u.id)).toEqual(['d'])
  })
})

describe('search', () => {
  test('matches name, brand, colour name and notes', () => {
    expect(queryProducts(products, units, lib, { search: 'jade' }).map(r => r.product.id)).toEqual(['2'])
    expect(queryProducts(products, units, lib, { search: 'elegoo' }).map(r => r.product.id)).toEqual(['3'])
  })
  // Review focus 4: regex characters, case and padding
  test('treats input as plain text', () => {
    expect(() => queryProducts(products, units, lib, { search: 'pla+(' })).not.toThrow()
    expect(queryProducts(products, units, lib, { search: 'pla+(' })).toEqual([])
    expect(matchesSearch(products[1], '  JADE ')).toBe(true)
    expect(matchesSearch(products[1], '   ')).toBe(true)
  })
})

describe('filters', () => {
  test('OR within a facet, AND across facets', () => {
    const ids = f => queryProducts(products, units, lib, { filters: f }).map(r => r.product.id).sort()
    expect(ids({ material: ['PLA'] })).toEqual(['1', '3'])
    expect(ids({ material: ['PLA', 'PETG'] })).toEqual(['1', '2', '3'])
    expect(ids({ material: ['PLA'], finish: ['silk'] })).toEqual(['3'])
    expect(ids({ color: ['blue'] })).toEqual(['3'])
    expect(ids({ material: [] })).toEqual(['1', '2', '3'])
  })
})

describe('rows and sorting', () => {
  test('rows carry totals; archived units hidden unless asked', () => {
    const rows = queryProducts(products, units, lib, {})
    const byId = Object.fromEntries(rows.map(r => [r.product.id, r]))
    expect(byId['2']).toMatchObject({ activeCount: 2, remaining: 2000 })
    expect(byId['3'].units).toEqual([])
    expect(queryProducts(products, units, lib, { showArchived: true }).find(r => r.product.id === '3').units).toHaveLength(1)
  })
  test('name sort puts products with no active units last', () => {
    // "Bambu PETG..." sorts before "Bambu PLA..."; Elegoo has no active spools so goes last
    expect(queryProducts(products, units, lib, { sort: 'name' }).map(r => r.product.id)).toEqual(['2', '1', '3'])
  })
  test('remaining sort is ascending', () => {
    expect(queryProducts(products, units, lib, { sort: 'remaining' }).map(r => r.product.id)).toEqual(['1', '2', '3'])
  })
  test('updated sort is newest first', () => {
    expect(queryProducts(products.slice(0, 2), units, lib, { sort: 'updated' }).map(r => r.product.id)).toEqual(['2', '1'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/query.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
import { isActive, productRemaining } from './amount.js'

export function groupUnits(units) {
  const map = new Map()
  for (const u of units) {
    if (u.deleted) continue
    if (!map.has(u.product_id)) map.set(u.product_id, [])
    map.get(u.product_id).push(u)
  }
  return map
}

export function matchesSearch(product, search) {
  const q = (search ?? '').trim().toLowerCase()
  if (!q) return true
  return [product.name, product.brand, product.fields?.color_name, product.notes]
    .some(v => (v ?? '').toLowerCase().includes(q))
}

export function matchesFilters(product, lib, filters) {
  return lib.facets.every(f => {
    const selected = filters?.[f.key] ?? []
    return selected.length === 0 || selected.includes(f.get(product))
  })
}

const byName = (a, b) => a.product.name.localeCompare(b.product.name)
const COMPARATORS = {
  name: byName,
  remaining: (a, b) => a.remaining - b.remaining || byName(a, b),
  updated: (a, b) => b.latest.localeCompare(a.latest) || byName(a, b),
}

export function queryProducts(products, unitsByProduct, lib, { search = '', filters = {}, sort = 'name', showArchived = false } = {}) {
  const rows = products
    .filter(p => !p.deleted && matchesSearch(p, search) && matchesFilters(p, lib, filters))
    .map(product => {
      const all = unitsByProduct.get(product.id) ?? []
      const active = all.filter(isActive)
      const latest = [product.updated_at, ...all.map(u => u.updated_at)].sort().at(-1)
      return {
        product,
        units: showArchived ? all : active,
        activeCount: active.length,
        remaining: productRemaining(all, lib.capOf(product)),
        latest,
      }
    })
  const cmp = COMPARATORS[sort] ?? byName
  return rows.sort((a, b) => (a.activeCount === 0) - (b.activeCount === 0) || cmp(a, b))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/query.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/query.js tests/unit/query.test.js
git commit -m "Add product search, filters and sorting"
```

---

### Task 8: Backup export, import merge and reminder

**Files:**
- Create: `src/core/export.js`, `src/core/reminder.js`
- Test: `tests/unit/export.test.js`, `tests/unit/reminder.test.js`

**Interfaces:**
- Consumes: `createDb`, `createRepo` (Task 6) in tests only.
- Produces:
  - `TABLES = ['products', 'units', 'presets', 'photos']`, `FORMAT_VERSION = 1`, `class ImportError extends Error`
  - `bufToBase64(ArrayBuffer) -> string`, `base64ToBuf(string) -> ArrayBuffer`
  - `buildExport(db, exportedAt) -> Promise<object>` (photos base64-encoded)
  - `parseImport(text) -> data` (throws `ImportError` with a readable message; photos decoded to ArrayBuffer)
  - `planImport(db, data) -> Promise<{ counts: { [table]: { new, updated, unchanged } }, writes: { [table]: record[] } }>`
  - `applyImport(db, plan) -> Promise<void>` (single transaction)
  - `backupFilename(date) -> 'spool-library-backup-YYYY-MM-DD.json'`
  - `daysSince(iso, nowMs) -> number|null`, `needsBackup(lastIso, productCount, nowMs) -> boolean`

- [ ] **Step 1: Write the failing tests**

`tests/unit/export.test.js`:
```js
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '../../src/core/db.js'
import { createRepo } from '../../src/core/repo.js'
import {
  ImportError, applyImport, backupFilename, base64ToBuf, bufToBase64, buildExport, parseImport, planImport,
} from '../../src/core/export.js'

let n = 0
const freshRepo = () => {
  let t = 0
  return createRepo(createDb(`test-${crypto.randomUUID()}`), {
    now: () => new Date(Date.UTC(2026, 0, 1) + (t++) * 1000).toISOString(),
    uuid: () => `id-${++n}`,
  })
}
const base = { library: 'filament', name: 'Black PLA', fields: { material: 'PLA', net_g: 1000, empty_spool_g: 250 } }

async function populated() {
  const repo = freshRepo()
  const photoId = await repo.savePhoto({ type: 'image/jpeg', data: new Uint8Array([1, 2, 3, 250]).buffer })
  const p = await repo.createProduct({ ...base, photo_id: photoId })
  await repo.addUnit(p.id)
  const gone = await repo.createProduct(base)
  await repo.deleteProduct(gone.id)
  await repo.seedPresets('filament', { PLA: { nozzle_min: 190 } })
  return repo
}

const snapshot = async db => {
  const out = {}
  for (const t of ['products', 'units', 'presets', 'photos']) {
    out[t] = (await db.table(t).toArray())
      .map(r => (r.data ? { ...r, data: [...new Uint8Array(r.data)] } : r))
      .sort((a, b) => a.id.localeCompare(b.id))
  }
  return out
}

describe('base64', () => {
  test('round trips bytes', () => {
    const buf = new Uint8Array([0, 1, 127, 128, 255]).buffer
    expect([...new Uint8Array(base64ToBuf(bufToBase64(buf)))]).toEqual([0, 1, 127, 128, 255])
  })
})

describe('export and import', () => {
  let source
  beforeEach(async () => { source = await populated() })

  test('round trip into an empty database reproduces every record, tombstones included', async () => {
    const text = JSON.stringify(await buildExport(source.db, '2026-02-01T00:00:00.000Z'))
    const target = freshRepo()
    const plan = await planImport(target.db, parseImport(text))
    expect(plan.counts.products).toEqual({ new: 2, updated: 0, unchanged: 0 })
    await applyImport(target.db, plan)
    expect(await snapshot(target.db)).toEqual(await snapshot(source.db))
  })

  test('merge: newer incoming wins, older and equal are ignored, tombstones apply', async () => {
    const target = freshRepo()
    await applyImport(target.db, await planImport(target.db, parseImport(JSON.stringify(await buildExport(source.db, 'x')))))
    const [live] = await source.listProducts('filament')
    const data = parseImport(JSON.stringify(await buildExport(source.db, 'x')))
    const newer = { ...live, name: 'Newer', updated_at: '2027-01-01T00:00:00.000Z' }
    const older = { ...live, name: 'Older', updated_at: '2020-01-01T00:00:00.000Z' }

    let plan = await planImport(target.db, { ...data, products: [newer] })
    expect(plan.counts.products).toEqual({ new: 0, updated: 1, unchanged: 0 })
    await applyImport(target.db, plan)
    expect((await target.db.products.get(live.id)).name).toBe('Newer')

    plan = await planImport(target.db, { ...data, products: [older] })
    expect(plan.counts.products).toEqual({ new: 0, updated: 0, unchanged: 1 })

    const tomb = { ...newer, deleted: true, updated_at: '2028-01-01T00:00:00.000Z' }
    await applyImport(target.db, await planImport(target.db, { ...data, products: [tomb] }))
    expect((await target.db.products.get(live.id)).deleted).toBe(true)
  })
})

// Review focus 3: bad files are rejected, partial failures roll back
describe('rejecting bad backups', () => {
  test.each([
    ['not json', /bad JSON/],
    [JSON.stringify({ format_version: 2, products: [], units: [], presets: [], photos: [] }), /Unsupported backup version: 2/],
    [JSON.stringify({ format_version: 1, products: [], units: [], presets: [] }), /missing "photos"/],
    [JSON.stringify({ format_version: 1, products: [{ name: 'x' }], units: [], presets: [], photos: [] }), /Bad record in "products"/],
    [JSON.stringify({ format_version: 1, products: [], units: [], presets: [], photos: [{ id: 'p', updated_at: 'x', data: 42 }] }), /Bad record in "photos"/],
  ])('%s', (text, message) => {
    expect(() => parseImport(text)).toThrow(ImportError)
    expect(() => parseImport(text)).toThrow(message)
  })

  test('a failure mid-write leaves the database untouched', async () => {
    const target = freshRepo()
    const plan = {
      counts: {},
      writes: {
        products: [{ id: 'ok', library: 'filament', updated_at: 'x', fields: {} }],
        units: [{ updated_at: 'x' }], // no primary key: bulkPut throws
        presets: [],
        photos: [],
      },
    }
    await expect(applyImport(target.db, plan)).rejects.toThrow()
    expect(await target.db.products.count()).toBe(0)
  })
})

test('backupFilename uses the date', () => {
  expect(backupFilename(new Date('2026-10-12T05:00:00Z'))).toBe('spool-library-backup-2026-10-12.json')
})
```

`tests/unit/reminder.test.js`:
```js
import { expect, test } from 'vitest'
import { daysSince, needsBackup } from '../../src/core/reminder.js'

const now = Date.parse('2026-10-20T12:00:00.000Z')

test('daysSince', () => {
  expect(daysSince(null, now)).toBeNull()
  expect(daysSince('2026-10-20T00:00:00.000Z', now)).toBe(0)
  expect(daysSince('2026-10-06T12:00:00.000Z', now)).toBe(14)
})

test('needsBackup', () => {
  expect(needsBackup(null, 0, now)).toBe(false)
  expect(needsBackup(null, 3, now)).toBe(true)
  expect(needsBackup('2026-10-07T12:00:00.000Z', 3, now)).toBe(false)
  expect(needsBackup('2026-10-06T12:00:00.000Z', 3, now)).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/export.test.js tests/unit/reminder.test.js`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement export.js**

```js
export const TABLES = ['products', 'units', 'presets', 'photos']
export const FORMAT_VERSION = 1

export class ImportError extends Error {}

export function bufToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function base64ToBuf(b64) {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

export async function buildExport(db, exportedAt) {
  const [products, units, presets, photos] = await Promise.all(TABLES.map(t => db.table(t).toArray()))
  return {
    format_version: FORMAT_VERSION,
    exported_at: exportedAt,
    products,
    units,
    presets,
    photos: photos.map(p => ({ ...p, data: bufToBase64(p.data) })),
  }
}

export function parseImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('Not a valid backup file (bad JSON)')
  }
  if (data?.format_version !== FORMAT_VERSION) throw new ImportError(`Unsupported backup version: ${data?.format_version}`)
  for (const t of TABLES) {
    if (!Array.isArray(data[t])) throw new ImportError(`Backup is missing "${t}"`)
    for (const r of data[t]) {
      if (typeof r?.id !== 'string' || typeof r?.updated_at !== 'string') throw new ImportError(`Bad record in "${t}"`)
    }
  }
  const photos = data.photos.map(p => {
    if (typeof p.data !== 'string') throw new ImportError('Bad record in "photos"')
    try {
      return { ...p, data: base64ToBuf(p.data) }
    } catch {
      throw new ImportError('Bad record in "photos"')
    }
  })
  return { ...data, photos }
}

export async function planImport(db, data) {
  const counts = {}
  const writes = {}
  for (const t of TABLES) {
    const incoming = data[t]
    const existing = await db.table(t).bulkGet(incoming.map(r => r.id))
    counts[t] = { new: 0, updated: 0, unchanged: 0 }
    writes[t] = []
    incoming.forEach((rec, i) => {
      const cur = existing[i]
      if (!cur) {
        counts[t].new++
        writes[t].push(rec)
      } else if (rec.updated_at > cur.updated_at) {
        counts[t].updated++
        writes[t].push(rec)
      } else {
        counts[t].unchanged++
      }
    })
  }
  return { counts, writes }
}

export async function applyImport(db, plan) {
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const t of TABLES) {
      if (plan.writes[t]?.length) await db.table(t).bulkPut(plan.writes[t])
    }
  })
}

export function backupFilename(date = new Date()) {
  return `spool-library-backup-${date.toISOString().slice(0, 10)}.json`
}
```

- [ ] **Step 4: Implement reminder.js**

```js
const DAY_MS = 86_400_000

export function daysSince(iso, nowMs) {
  if (!iso) return null
  return Math.floor((nowMs - Date.parse(iso)) / DAY_MS)
}

export function needsBackup(lastIso, productCount, nowMs) {
  if (productCount === 0) return false
  const days = daysSince(lastIso, nowMs)
  return days === null || days >= 14
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/export.test.js tests/unit/reminder.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/export.js src/core/reminder.js tests/unit/export.test.js tests/unit/reminder.test.js
git commit -m "Add backup export, merge import and reminder"
```

---

### Task 9: App shell, swatch and grid

**Files:**
- Create: `src/core/route.js`, `src/core/image.js`, `src/store.js`, `src/App.jsx`, `src/ui/router.js`, `src/ui/useLive.js`, `src/ui/toast.jsx`, `src/ui/backupActions.js`, `src/ui/ErrorBoundary.jsx`, `src/ui/InstallGate.jsx`, `src/ui/UpdatePrompt.jsx`, `src/ui/Grid.jsx`, `src/ui/Filters.jsx`, `src/ui/ProductCard.jsx`, `src/libraries/filament/Swatch.jsx`, `src/libraries/filament/index.js`, `src/libraries/index.js`
- Modify: `src/main.jsx` (replace)
- Test: `tests/unit/route.test.js`, `tests/unit/image.test.js`

**Interfaces:**
- Consumes: everything in Tasks 2-8.
- Produces:
  - `parseHash(hash) -> { name: 'grid'|'product'|'new'|'edit'|'settings', id?, from? }`
  - `fitWithin(width, height, maxEdge) -> { width, height }`, `resizeImage(file, maxEdge = 1200, quality = 0.8) -> Promise<{ type, data }>`
  - `store.js`: `db`, `repo`, `init()`
  - `ui/router.js`: `useRoute()`, `navigate(path)`
  - `ui/useLive.js`: `useLive(queryFn, deps, initial)`
  - `ui/toast.jsx`: `toast(message, { action?, timeout? })`, `dismiss(id)`, `<Toasts />`, `guard(fn, message?) -> Promise<result|undefined>`
  - `ui/backupActions.js`: `exportBackup() -> Promise<boolean>`
  - Library object (`libraries/filament/index.js` default export): `{ id: 'filament', label: 'Filament', unit_label: 'Spool', amount_mode: 'level', ...definition, Visual }` (Tasks 10-11 add `FormFields`, `DetailInfo`).
  - `libraries/index.js`: `LIBRARIES`, `getLibrary(id)`
  - Accessible names used by the e2e test (Task 13): heading "Add to Home Screen", button "Use in browser anyway", link "Add filament", link "Settings", search box "Search", chip groups "Material"/"Finish"/"Colour" with buttons named after each option, button "Show archived", product tiles are links named after the product name.

- [ ] **Step 1: Write failing tests for the pure helpers**

`tests/unit/route.test.js`:
```js
import { expect, test } from 'vitest'
import { parseHash } from '../../src/core/route.js'

test.each([
  ['', { name: 'grid' }],
  ['#/', { name: 'grid' }],
  ['#/p/abc', { name: 'product', id: 'abc' }],
  ['#/edit/abc', { name: 'edit', id: 'abc' }],
  ['#/new', { name: 'new', from: null }],
  ['#/new/abc', { name: 'new', from: 'abc' }],
  ['#/settings', { name: 'settings' }],
  ['#/nonsense', { name: 'grid' }],
  ['#/p', { name: 'grid' }],
])('%s', (hash, route) => expect(parseHash(hash)).toEqual(route))
```

`tests/unit/image.test.js`:
```js
import { expect, test } from 'vitest'
import { fitWithin } from '../../src/core/image.js'

test('scales the long edge down to the max', () => {
  expect(fitWithin(4032, 3024, 1200)).toEqual({ width: 1200, height: 900 })
  expect(fitWithin(3024, 4032, 1200)).toEqual({ width: 900, height: 1200 })
})

test('never upscales', () => {
  expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 })
})
```

Run: `npx vitest run tests/unit/route.test.js tests/unit/image.test.js`
Expected: FAIL, modules not found.

- [ ] **Step 2: Implement route.js and image.js**

`src/core/route.js`:
```js
export function parseHash(hash) {
  const parts = (hash ?? '').replace(/^#/, '').split('/').filter(Boolean)
  if (parts[0] === 'p' && parts[1]) return { name: 'product', id: parts[1] }
  if (parts[0] === 'edit' && parts[1]) return { name: 'edit', id: parts[1] }
  if (parts[0] === 'new') return { name: 'new', from: parts[1] ?? null }
  if (parts[0] === 'settings') return { name: 'settings' }
  return { name: 'grid' }
}
```

`src/core/image.js`:
```js
export function fitWithin(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function decode(file) {
  try {
    return await createImageBitmap(file)
  } catch {
    // Fallback for formats createImageBitmap rejects (e.g. some HEIC files): let <img> decode it
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function resizeImage(file, maxEdge = 1200, quality = 0.8) {
  const source = await decode(file)
  const { width, height } = fitWithin(source.width, source.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(source, 0, 0, width, height)
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/jpeg', quality))
  return { type: 'image/jpeg', data: await blob.arrayBuffer() }
}
```

Run: `npx vitest run tests/unit/route.test.js tests/unit/image.test.js`
Expected: PASS.

- [ ] **Step 3: Library registry and swatch**

`src/libraries/filament/Swatch.jsx`:
```jsx
import { useId } from 'preact/hooks'
import { isHex } from '../../core/color.js'
import { pieSlices, shade, sparklePoints } from './swatch-geometry.js'

const FULL = { width: 100, height: 100 }

export default function Swatch({ product, size = 64 }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = key => `${key}-${uid}`
  const f = product.fields
  const hex = isHex(f.color_hex) ? f.color_hex : '#888888'
  const extra = [f.color_hex_2, f.color_hex_3].filter(isHex)

  let body
  switch (f.finish) {
    case 'matte':
      body = <rect {...FULL} fill={hex} />
      break
    case 'silk':
      body = <><rect {...FULL} fill={hex} /><rect {...FULL} fill={`url(#${id('silk')})`} /></>
      break
    case 'sparkle':
      body = <>
        <rect {...FULL} fill={hex} />
        {sparklePoints(product.id ?? 'preview').map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#fff" fill-opacity={p.o} />)}
      </>
      break
    case 'translucent':
      body = <><rect {...FULL} fill={`url(#${id('check')})`} /><rect {...FULL} fill={hex} fill-opacity="0.6" /></>
      break
    case 'multi': {
      const slices = pieSlices([hex, ...extra])
      body = slices.length ? slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />) : <rect {...FULL} fill={hex} />
      break
    }
    case 'glow':
      body = <>
        <rect {...FULL} fill={hex} />
        <circle cx="50" cy="50" r="44" fill="none" stroke={shade(hex, 0.6)} stroke-width="5" filter={`url(#${id('blur')})`} />
      </>
      break
    case 'wood':
      body = <>
        <rect {...FULL} fill={hex} />
        {[12, 26, 40, 54, 68, 82].map((y, i) => (
          <path key={y} d={`M0 ${y} Q50 ${y + (i % 2 ? 7 : -7)} 100 ${y}`} fill="none" stroke={shade(hex, -0.35)} stroke-opacity="0.55" stroke-width="2.5" />
        ))}
      </>
      break
    default:
      body = <><rect {...FULL} fill={hex} /><rect {...FULL} fill={`url(#${id('gloss')})`} /></>
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${f.color_name || hex}, ${f.finish}`}>
      <defs>
        <clipPath id={id('clip')}><circle cx="50" cy="50" r="48" /></clipPath>
        <radialGradient id={id('gloss')} cx="35%" cy="25%" r="60%">
          <stop offset="0" stop-color="#fff" stop-opacity="0.45" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <linearGradient id={id('silk')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity="0.15" />
          <stop offset="0.45" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.75" />
          <stop offset="0.58" stop-color="#fff" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.25" />
        </linearGradient>
        <pattern id={id('check')} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#fff" />
          <rect width="8" height="8" fill="#ccc" />
          <rect x="8" y="8" width="8" height="8" fill="#ccc" />
        </pattern>
        <filter id={id('blur')}><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <g clip-path={`url(#${id('clip')})`}>{body}</g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1.5" />
      <circle cx="50" cy="50" r="13" fill="var(--hole, var(--bg))" stroke="#000" stroke-opacity="0.25" stroke-width="1.5" />
    </svg>
  )
}
```

`src/libraries/filament/index.js`:
```js
import * as definition from './definition.js'
import Swatch from './Swatch.jsx'

export default {
  id: 'filament',
  label: 'Filament',
  unit_label: 'Spool',
  amount_mode: 'level',
  ...definition,
  Visual: Swatch,
}
```

`src/libraries/index.js`:
```js
import filament from './filament/index.js'

export const LIBRARIES = [filament]

export function getLibrary(id) {
  return LIBRARIES.find(l => l.id === id)
}
```

- [ ] **Step 4: Store, hooks, toast, router**

`src/store.js`:
```js
import { createDb } from './core/db.js'
import { createRepo } from './core/repo.js'
import { LIBRARIES } from './libraries/index.js'

export const db = createDb()
export const repo = createRepo(db)

export async function init() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // persistence is best effort; the backup reminder covers the rest
  }
  for (const lib of LIBRARIES) {
    if (lib.presets) await repo.seedPresets(lib.id, lib.presets)
  }
}
```

`src/ui/router.js`:
```js
import { useEffect, useState } from 'preact/hooks'
import { parseHash } from '../core/route.js'

export function navigate(path) {
  location.hash = path
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash))
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return route
}
```

`src/ui/useLive.js`:
```js
import { useEffect, useState } from 'preact/hooks'
import { liveQuery } from 'dexie'

export function useLive(query, deps, initial) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: e => console.error(e) })
    return () => sub.unsubscribe()
  }, deps)
  return value
}
```

`src/ui/toast.jsx`:
```jsx
import { useEffect, useState } from 'preact/hooks'

let items = []
let nextId = 1
const listeners = new Set()
const emit = () => listeners.forEach(l => l(items))

export function dismiss(id) {
  items = items.filter(t => t.id !== id)
  emit()
}

export function toast(message, { action, timeout = 4000 } = {}) {
  const id = nextId++
  items = [...items, { id, message, action }]
  emit()
  if (timeout) setTimeout(() => dismiss(id), timeout)
  return id
}

export async function guard(fn, message = "Couldn't save - try again") {
  try {
    return await fn()
  } catch (e) {
    console.error(e)
    toast(message)
    return undefined
  }
}

export function Toasts() {
  const [list, setList] = useState(items)
  useEffect(() => {
    listeners.add(setList)
    return () => listeners.delete(setList)
  }, [])
  return (
    <div class="toasts" role="status">
      {list.map(t => (
        <div class="toast" key={t.id}>
          <span>{t.message}</span>
          {t.action && <button onClick={() => { t.action.run(); dismiss(t.id) }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
```

`src/ui/backupActions.js`:
```js
import { backupFilename, buildExport } from '../core/export.js'
import { db, repo } from '../store.js'

export async function exportBackup() {
  const now = new Date()
  const data = await buildExport(db, now.toISOString())
  const file = new File([JSON.stringify(data)], backupFilename(now), { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Spool Library backup' })
      await repo.setMeta('last_backup_at', now.toISOString())
      return true
    } catch (e) {
      if (e.name === 'AbortError') return false
      // any other share failure: fall through to a plain download
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await repo.setMeta('last_backup_at', now.toISOString())
  return true
}
```

- [ ] **Step 5: Error boundary, install gate, update prompt**

`src/ui/ErrorBoundary.jsx`:
```jsx
import { Component } from 'preact'
import { exportBackup } from './backupActions.js'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render({ children }, { error }) {
    if (!error) return children
    return (
      <div class="fatal">
        <h1>Something broke</h1>
        <p class="muted">{String(error?.message ?? error)}</p>
        <p>Your data is still on this phone. Export a backup to be safe, then reload.</p>
        <div class="row">
          <button class="primary" onClick={() => exportBackup()}>Export backup</button>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}
```

`src/ui/InstallGate.jsx`:
```jsx
import { useState } from 'preact/hooks'

const KEY = 'install-gate-dismissed'

export function isStandalone() {
  return navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

function wasDismissed() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export default function InstallGate({ children }) {
  const [open, setOpen] = useState(() => !isStandalone() && !wasDismissed())
  if (!open) return children
  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      // private mode: dismiss for this render only
    }
    setOpen(false)
  }
  return (
    <div class="gate">
      <h1>Add to Home Screen</h1>
      <p>Spool Library keeps your data on this phone. Safari tabs and home-screen apps store data separately, so install it first:</p>
      <ol>
        <li>Tap the Share button (square with an arrow).</li>
        <li>Choose <b>Add to Home Screen</b>.</li>
        <li>Open Spool Library from your home screen.</li>
      </ol>
      <button onClick={dismiss}>Use in browser anyway</button>
    </div>
  )
}
```

`src/ui/UpdatePrompt.jsx`:
```jsx
import { useRegisterSW } from 'virtual:pwa-register/preact'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div class="toasts">
      <div class="toast">
        <span>Update available</span>
        <button onClick={() => updateServiceWorker(true)}>Reload</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Grid, filters, product card**

`src/ui/ProductCard.jsx`:
```jsx
export default function ProductCard({ lib, row }) {
  const { product, units, activeCount } = row
  const Visual = lib.Visual
  return (
    <a class={`tile${activeCount === 0 ? ' dim' : ''}`} href={`#/p/${product.id}`} aria-label={product.name}>
      <Visual product={product} size={64} />
      <strong>{product.fields.color_name || product.name}</strong>
      <span class="muted">{lib.summary(product, units)}</span>
    </a>
  )
}
```

`src/ui/Filters.jsx`:
```jsx
export default function Filters({ lib, value, onChange }) {
  const set = patch => onChange({ ...value, ...patch })
  const toggle = (key, option) => {
    const current = value.filters[key] ?? []
    const next = current.includes(option) ? current.filter(o => o !== option) : [...current, option]
    set({ filters: { ...value.filters, [key]: next } })
  }
  return (
    <div>
      <input type="search" placeholder="Search..." aria-label="Search" value={value.search}
        onInput={e => set({ search: e.currentTarget.value })} />
      {lib.facets.map(f => (
        <div class="chips" role="group" aria-label={f.label} key={f.key}>
          {f.options.map(o => (
            <button type="button" key={o} aria-pressed={(value.filters[f.key] ?? []).includes(o)} onClick={() => toggle(f.key, o)}>{o}</button>
          ))}
        </div>
      ))}
      <div class="row">
        <select aria-label="Sort" value={value.sort} onChange={e => set({ sort: e.currentTarget.value })}>
          <option value="name">Name</option>
          <option value="remaining">Least remaining</option>
          <option value="updated">Recently updated</option>
        </select>
        <button type="button" aria-pressed={value.showArchived} onClick={() => set({ showArchived: !value.showArchived })}>Show archived</button>
      </div>
    </div>
  )
}
```

`src/ui/Grid.jsx`:
```jsx
import { useState } from 'preact/hooks'
import { repo } from '../store.js'
import { groupUnits, queryProducts } from '../core/query.js'
import { needsBackup } from '../core/reminder.js'
import { useLive } from './useLive.js'
import Filters from './Filters.jsx'
import ProductCard from './ProductCard.jsx'

export default function Grid({ lib }) {
  const products = useLive(() => repo.listProducts(lib.id), [lib.id], [])
  const units = useLive(() => repo.listAllUnits(), [], [])
  const lastBackup = useLive(() => repo.getMeta('last_backup_at'), [], null)
  const [query, setQuery] = useState({ search: '', filters: {}, sort: 'name', showArchived: false })
  const rows = queryProducts(products, groupUnits(units), lib, query)
  const remind = needsBackup(lastBackup, products.length, Date.now())
  const noun = lib.label.toLowerCase()

  return (
    <>
      <header class="bar">
        <h1>{lib.label}</h1>
        <a class="btn icon-btn" href="#/settings" aria-label="Settings">⚙{remind && <span class="badge" />}</a>
        <a class="btn primary" href="#/new" aria-label={`Add ${noun}`}>＋</a>
      </header>
      <Filters lib={lib} value={query} onChange={setQuery} />
      {products.length === 0
        ? <p class="muted">No {noun} yet. Tap ＋ to add one.</p>
        : rows.length === 0
          ? <p class="muted">Nothing matches.</p>
          : <div class="grid">{rows.map(r => <ProductCard key={r.product.id} lib={lib} row={r} />)}</div>}
    </>
  )
}
```

- [ ] **Step 7: App and entry point**

`src/App.jsx`:
```jsx
import { useState } from 'preact/hooks'
import { LIBRARIES, getLibrary } from './libraries/index.js'
import { useRoute } from './ui/router.js'
import { Toasts } from './ui/toast.jsx'
import InstallGate from './ui/InstallGate.jsx'
import UpdatePrompt from './ui/UpdatePrompt.jsx'
import Grid from './ui/Grid.jsx'

export default function App() {
  const route = useRoute()
  const [libId, setLibId] = useState(LIBRARIES[0].id)
  const lib = getLibrary(libId)

  let page
  switch (route.name) {
    default:
      page = <Grid lib={lib} />
  }

  return (
    <InstallGate>
      {page}
      <nav class="tabs">
        {LIBRARIES.map(l => (
          <a key={l.id} href="#/" aria-current={l.id === libId ? 'page' : undefined} onClick={() => setLibId(l.id)}>{l.label}</a>
        ))}
      </nav>
      <UpdatePrompt />
      <Toasts />
    </InstallGate>
  )
}
```

`src/main.jsx` (replace):
```jsx
import { render } from 'preact'
import App from './App.jsx'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import { init } from './store.js'
import './styles.css'

init().finally(() => {
  render(<ErrorBoundary><App /></ErrorBoundary>, document.getElementById('app'))
})
```

- [ ] **Step 8: Verify**

Run: `npm test`
Expected: all unit tests pass.

Run: `npm run build`
Expected: build succeeds, no unresolved imports.

Run `npm run dev`, open `http://localhost:5173/spool-library/` in the browser pane at mobile size (375x812). Expected: the "Add to Home Screen" gate; tapping "Use in browser anyway" shows the Filament header, search box, three chip rows, sort + Show archived, the empty-state text, and the bottom tab bar. Check light and dark colour schemes. Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add app shell, install gate, swatch and grid"
```

---

### Task 10: Product form (new, edit, duplicate, photo)

**Files:**
- Create: `src/ui/ProductForm.jsx`, `src/ui/PhotoView.jsx`, `src/libraries/filament/FormFields.jsx`
- Modify: `src/libraries/filament/index.js` (add `FormFields`), `src/App.jsx` (add `new` and `edit` routes)

**Interfaces:**
- Consumes: `repo` (`getProduct`, `saveProduct`, `createProduct`, `savePhoto`, `deletePhoto`, `listPresets`), library object (`newFields`, `defaultName`, `validate`, `SETTING_KEYS`, `preset_key`, `Visual`), `diffOverrides`, `resizeImage`, `guard`, `navigate`, `useLive`.
- Produces:
  - `<ProductForm lib editId? duplicateFrom? />`
  - `<PhotoView id alt? />`
  - Library `FormFields` component: props `{ fields, overrides, preset, errors, onFields(patch), onOverrides(patch) }`.
  - Accessible names used by e2e: inputs labelled "Brand", "Material", "Finish", "Colour name", "Hex" (exact), "Nozzle min" (placeholder = preset value), "Name", button "Save".

- [ ] **Step 1: Filament form fields**

`src/libraries/filament/FormFields.jsx`:
```jsx
import { isHex } from '../../core/color.js'
import { FINISHES, MATERIALS, SETTING_LABELS } from './definition.js'

const num = v => (v === '' || v == null ? null : Number(v))

function ColorField({ id, label, value, onChange, error }) {
  return (
    <div>
      <label for={id}>{label}</label>
      <div class="row" style="align-items:center;margin:0">
        <input type="color" aria-label={`${label} picker`} value={isHex(value) ? value : '#888888'}
          onInput={e => onChange(e.currentTarget.value)} style="flex:0 0 52px;height:40px;padding:2px" />
        <input id={id} value={value ?? ''} placeholder="#RRGGBB" autocapitalize="off" autocomplete="off"
          onInput={e => onChange(e.currentTarget.value || null)} />
      </div>
      {error && <div class="error">{error}</div>}
    </div>
  )
}

export default function FormFields({ fields, overrides, preset, errors, onFields, onOverrides }) {
  const f = fields
  const text = key => e => onFields({ [key]: e.currentTarget.value })
  const number = key => e => onFields({ [key]: num(e.currentTarget.value) })
  const err = key => errors[key] && <div class="error">{errors[key]}</div>
  const setting = key => (
    <div>
      <label for={key}>{SETTING_LABELS[key]}</label>
      <input id={key} type="number" inputmode="numeric" placeholder={preset[key] ?? '-'} value={overrides[key] ?? ''}
        onInput={e => onOverrides({ [key]: num(e.currentTarget.value) })} />
      {err(key)}
    </div>
  )

  return (
    <>
      <div class="row">
        <div>
          <label for="material">Material</label>
          <select id="material" value={f.material} onChange={text('material')}>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {err('material')}
        </div>
        <div>
          <label for="finish">Finish</label>
          <select id="finish" value={f.finish} onChange={text('finish')}>
            {FINISHES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {err('finish')}
        </div>
      </div>
      <label for="color_name">Colour name</label>
      <input id="color_name" value={f.color_name} onInput={text('color_name')} />
      <ColorField id="color_hex" label="Hex" value={f.color_hex} error={errors.color_hex} onChange={v => onFields({ color_hex: v })} />
      {f.finish === 'multi' && (
        <>
          <ColorField id="color_hex_2" label="Hex 2" value={f.color_hex_2} error={errors.color_hex_2} onChange={v => onFields({ color_hex_2: v })} />
          <ColorField id="color_hex_3" label="Hex 3 (optional)" value={f.color_hex_3} error={errors.color_hex_3} onChange={v => onFields({ color_hex_3: v })} />
        </>
      )}
      <div class="row">
        <div>
          <label for="diameter">Diameter (mm)</label>
          <input id="diameter" type="number" step="0.01" value={f.diameter ?? ''} onInput={number('diameter')} />
          {err('diameter')}
        </div>
        <div>
          <label for="net_g">Net (g)</label>
          <input id="net_g" type="number" inputmode="numeric" value={f.net_g ?? ''} onInput={number('net_g')} />
          {err('net_g')}
        </div>
        <div>
          <label for="empty_spool_g">Empty spool (g)</label>
          <input id="empty_spool_g" type="number" inputmode="numeric" value={f.empty_spool_g ?? ''} onInput={number('empty_spool_g')} />
          {err('empty_spool_g')}
        </div>
      </div>
      <h3>Print settings <span class="muted">blank = {f.material} preset</span></h3>
      <div class="row">{setting('nozzle_min')}{setting('nozzle_max')}</div>
      <div class="row">{setting('bed_min')}{setting('bed_max')}</div>
      <div class="row">{setting('dry_temp')}{setting('dry_hours')}</div>
      {setting('speed_max')}
    </>
  )
}
```

Update `src/libraries/filament/index.js`:
```js
import * as definition from './definition.js'
import Swatch from './Swatch.jsx'
import FormFields from './FormFields.jsx'

export default {
  id: 'filament',
  label: 'Filament',
  unit_label: 'Spool',
  amount_mode: 'level',
  ...definition,
  Visual: Swatch,
  FormFields,
}
```

- [ ] **Step 2: Photo view**

`src/ui/PhotoView.jsx`:
```jsx
import { useEffect, useState } from 'preact/hooks'
import { repo } from '../store.js'
import { useLive } from './useLive.js'

export default function PhotoView({ id, alt = '' }) {
  const photo = useLive(() => repo.getPhoto(id), [id], null)
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!photo) return undefined
    const u = URL.createObjectURL(new Blob([photo.data], { type: photo.type }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  return url ? <img class="photo" src={url} alt={alt} /> : null
}
```

- [ ] **Step 3: Product form**

`src/ui/ProductForm.jsx`:
```jsx
import { useEffect, useState } from 'preact/hooks'
import { repo } from '../store.js'
import { getLibrary } from '../libraries/index.js'
import { diffOverrides } from '../core/presets.js'
import { resizeImage } from '../core/image.js'
import { guard } from './toast.jsx'
import { navigate } from './router.js'
import { useLive } from './useLive.js'
import PhotoView from './PhotoView.jsx'

function blankState(lib) {
  return { libId: lib.id, name: '', brand: '', notes: '', photo_id: null, original_photo_id: null, fields: lib.newFields(), overrides: {} }
}

function fromProduct(p, isEdit) {
  const { overrides = {}, ...fields } = p.fields
  return {
    libId: p.library,
    name: isEdit ? p.name : '',
    brand: p.brand ?? '',
    notes: p.notes ?? '',
    photo_id: isEdit ? p.photo_id ?? null : null,
    original_photo_id: isEdit ? p.photo_id ?? null : null,
    fields,
    overrides: { ...overrides },
  }
}

function buildProduct(lib, s, preset, id) {
  const p = {
    library: lib.id,
    brand: s.brand.trim(),
    notes: s.notes,
    photo_id: s.photo_id,
    fields: { ...s.fields, overrides: diffOverrides(lib.SETTING_KEYS, preset, s.overrides) },
  }
  if (id) p.id = id
  return { ...p, name: s.name.trim() || lib.defaultName(p) }
}

export default function ProductForm({ lib: defaultLib, editId, duplicateFrom }) {
  const sourceId = editId ?? duplicateFrom
  const [state, setState] = useState(sourceId ? null : blankState(defaultLib))
  const [missing, setMissing] = useState(false)
  const libId = state?.libId ?? defaultLib.id
  const presets = useLive(() => repo.listPresets(libId), [libId], {})

  useEffect(() => {
    if (!sourceId) {
      setState(blankState(defaultLib))
      return
    }
    repo.getProduct(sourceId).then(p => (p ? setState(fromProduct(p, Boolean(editId))) : setMissing(true)))
  }, [sourceId])

  if (missing) return <><header class="bar"><a class="btn" href="#/">Back</a></header><p>Product not found.</p></>
  if (!state) return null

  const lib = getLibrary(state.libId)
  const preset = presets[state.fields[lib.preset_key]] ?? {}
  const candidate = buildProduct(lib, state, preset, editId)
  const errors = lib.validate(candidate, preset)
  const valid = Object.keys(errors).length === 0
  const update = patch => setState(s => ({ ...s, ...patch }))
  const FormFields = lib.FormFields

  async function onPhoto(e) {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    const id = await guard(async () => repo.savePhoto(await resizeImage(file)), "Couldn't read that photo")
    if (id) update({ photo_id: id })
  }

  async function save(e) {
    e.preventDefault()
    if (!valid) return
    const saved = await guard(async () => {
      const result = editId ? await repo.saveProduct(candidate) : await repo.createProduct(candidate)
      if (state.original_photo_id && state.original_photo_id !== state.photo_id) await repo.deletePhoto(state.original_photo_id)
      return result
    })
    if (saved) navigate(`/p/${saved.id}`)
  }

  const title = editId ? 'Edit' : duplicateFrom ? 'Duplicate' : `New ${lib.label.toLowerCase()}`

  return (
    <form onSubmit={save}>
      <header class="bar">
        <a class="btn" href={editId ? `#/p/${editId}` : '#/'}>Cancel</a>
        <h1>{title}</h1>
        <button class="primary" type="submit" disabled={!valid}>Save</button>
      </header>
      <div style="display:flex;justify-content:center">
        <lib.Visual product={{ ...candidate, id: editId ?? 'preview' }} size={120} />
      </div>
      <label for="brand">Brand</label>
      <input id="brand" value={state.brand} onInput={e => update({ brand: e.currentTarget.value })} />
      <FormFields
        fields={state.fields}
        overrides={state.overrides}
        preset={preset}
        errors={errors}
        onFields={p => setState(s => ({ ...s, fields: { ...s.fields, ...p } }))}
        onOverrides={p => setState(s => ({ ...s, overrides: { ...s.overrides, ...p } }))}
      />
      <label for="name">Name</label>
      <input id="name" value={state.name} placeholder={lib.defaultName(candidate)} onInput={e => update({ name: e.currentTarget.value })} />
      <label for="photo">Photo (optional)</label>
      {state.photo_id
        ? <><PhotoView id={state.photo_id} /><button type="button" onClick={() => update({ photo_id: null })}>Remove photo</button></>
        : <input id="photo" type="file" accept="image/*" onChange={onPhoto} />}
      <label for="notes">Notes</label>
      <textarea id="notes" rows="3" value={state.notes} onInput={e => update({ notes: e.currentTarget.value })} />
    </form>
  )
}
```

- [ ] **Step 4: Wire routes**

In `src/App.jsx`, add the import and replace the switch:
```jsx
import ProductForm from './ui/ProductForm.jsx'
```
```jsx
  let page
  switch (route.name) {
    case 'new':
      page = <ProductForm key={`new-${route.from ?? ''}`} lib={lib} duplicateFrom={route.from} />
      break
    case 'edit':
      page = <ProductForm key={`edit-${route.id}`} lib={lib} editId={route.id} />
      break
    default:
      page = <Grid lib={lib} />
  }
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run build`
Expected: pass and build succeeds.

Run `npm run dev`, open the app in the browser pane at 375x812, dismiss the gate, tap ＋. Check:
- Material PETG makes "Nozzle min" placeholder 230; switching to PLA Support shows 220.
- Hex "red" shows "Use #RRGGBB" and Save is disabled; `#F0F0E8` clears it.
- Finish multi shows Hex 2 with an error until a colour is set; the preview swatch splits.
- Each finish (basic, matte, silk, sparkle, translucent, multi, glow, wood) draws a distinct preview.
- Save lands on `#/p/<id>` (blank page until Task 11). Back on the grid the tile shows the swatch, colour name and "PETG · ×1 · ~1.0 kg".
- Adding a photo from a file shows it in the form.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add product form with presets, swatch preview and photo"
```

---

### Task 11: Product detail and spool sheet

**Files:**
- Create: `src/ui/ProductDetail.jsx`, `src/ui/UnitRow.jsx`, `src/ui/UnitSheet.jsx`, `src/libraries/filament/DetailInfo.jsx`
- Modify: `src/libraries/filament/index.js` (add `DetailInfo`), `src/App.jsx` (add `product` route)

**Interfaces:**
- Consumes: `repo` (`getProduct`, `listUnits`, `listPresets`, `addUnit`, `saveUnit`, `deleteUnit`, `deleteProduct`), amount helpers (`LEVELS`, `unitRemaining`, `unitLevel`, `setLevel`, `setWeight`, `formatGrams`, `levelLabel`), `effectiveSettings`, library `capOf`, `formatRange`, `SETTING_KEYS`, `unit_label`.
- Produces:
  - `<ProductDetail id />`, `<UnitRow lib cap unit n onOpen />`, `<UnitSheet lib cap unit n onClose />`
  - Library `DetailInfo` component: props `{ product, preset }`.
  - Accessible names used by e2e: product name as heading; link "Back"; spool rows are buttons named "Spool #N"; sheet input labelled "Scale reading (g)" and a "<grams> left" preview; buttons "Archive" / "Unarchive", "Delete", "Done"; button "Show archived (N)".

- [ ] **Step 1: Filament detail info**

`src/libraries/filament/DetailInfo.jsx`:
```jsx
import { effectiveSettings } from '../../core/presets.js'
import { formatGrams } from '../../core/amount.js'
import { SETTING_KEYS, formatRange } from './definition.js'

export default function DetailInfo({ product, preset }) {
  const f = product.fields
  const { values: v, overridden } = effectiveSettings(SETTING_KEYS, preset, f.overrides)
  const star = (...keys) => (keys.some(k => overridden.has(k)) ? ' ★' : '')
  const dry = v.dry_temp != null ? `${v.dry_temp} °C${v.dry_hours != null ? ` · ${v.dry_hours} h` : ''}` : null
  const rows = [
    ['Nozzle', formatRange(v.nozzle_min, v.nozzle_max, '°C'), star('nozzle_min', 'nozzle_max')],
    ['Bed', formatRange(v.bed_min, v.bed_max, '°C'), star('bed_min', 'bed_max')],
    ['Dry', dry, star('dry_temp', 'dry_hours')],
    ['Max speed', v.speed_max != null ? `${v.speed_max} mm/s` : null, star('speed_max')],
  ].filter(r => r[1])

  return (
    <>
      <p>
        {f.color_name && <strong>{f.color_name} · </strong>}
        {f.finish} · {f.material} · {f.diameter} mm · {formatGrams(f.net_g)} spool
      </p>
      {rows.length > 0
        ? <table class="settings-table"><tbody>{rows.map(([k, val, s]) => <tr key={k}><td class="muted">{k}</td><td>{val}{s}</td></tr>)}</tbody></table>
        : <p class="muted">No print settings. Edit this product or the {f.material} preset.</p>}
      {overridden.size > 0 && <p class="muted">★ differs from the {f.material} preset</p>}
    </>
  )
}
```

Update `src/libraries/filament/index.js`:
```js
import * as definition from './definition.js'
import Swatch from './Swatch.jsx'
import FormFields from './FormFields.jsx'
import DetailInfo from './DetailInfo.jsx'

export default {
  id: 'filament',
  label: 'Filament',
  unit_label: 'Spool',
  amount_mode: 'level',
  ...definition,
  Visual: Swatch,
  FormFields,
  DetailInfo,
}
```

- [ ] **Step 2: Unit row and sheet**

`src/ui/UnitRow.jsx`:
```jsx
import { formatGrams, levelLabel, unitLevel, unitRemaining } from '../core/amount.js'

export default function UnitRow({ lib, cap, unit, n, onOpen }) {
  const level = unitLevel(unit, cap)
  const grams = unitRemaining(unit, cap)
  const text = unit.amount_mode === 'level' ? `${levelLabel(level)} · ${formatGrams(grams, true)}` : formatGrams(grams)
  return (
    <button class="unit-row" onClick={onOpen} aria-label={`${lib.unit_label} #${n}`}>
      <span>#{n}</span>
      <span class="level"><span style={{ width: `${Math.round(level * 100)}%` }} /></span>
      <span>{text}</span>
      {unit.archived && <span class="muted">archived</span>}
    </button>
  )
}
```

`src/ui/UnitSheet.jsx`:
```jsx
import { useState } from 'preact/hooks'
import { LEVELS, formatGrams, setLevel, setWeight, unitRemaining } from '../core/amount.js'
import { repo } from '../store.js'
import { guard } from './toast.jsx'

export default function UnitSheet({ lib, cap, unit, n, onClose }) {
  const [weight, setWeightText] = useState(unit?.gross_g ?? '')
  const [location, setLocation] = useState(unit?.location ?? '')
  if (!unit) return null

  const label = `${lib.unit_label} #${n}`
  const save = u => guard(() => repo.saveUnit(u))
  const grams = weight === '' ? null : Number(weight)
  const weightError = grams !== null && (!Number.isFinite(grams) || grams < 0) ? 'Enter 0 or more' : null
  const preview = grams !== null && !weightError ? unitRemaining({ amount_mode: 'weight', gross_g: grams }, cap) : null

  const commitWeight = () => {
    if (grams === null || weightError || grams === unit.gross_g) return
    save(setWeight(unit, grams, cap))
  }

  async function toggleArchive() {
    await save({ ...unit, archived: !unit.archived })
    onClose()
  }

  async function remove() {
    if (!confirm(`Delete ${label}?`)) return
    await guard(() => repo.deleteUnit(unit.id))
    onClose()
  }

  return (
    <div class="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label={label}>
        <header class="bar">
          <h2 style="flex:1;margin:0">{label}</h2>
          <button onClick={onClose}>Done</button>
        </header>
        <div class="chips" role="group" aria-label="Level">
          {LEVELS.map(l => (
            <button key={l.value} aria-pressed={unit.amount_mode === 'level' && unit.level === l.value}
              onClick={() => { setWeightText(''); save(setLevel(unit, l.value)) }}>{l.label}</button>
          ))}
        </div>
        <label for="gross">Scale reading (g)</label>
        <input id="gross" type="number" inputmode="numeric" value={weight}
          onInput={e => setWeightText(e.currentTarget.value)}
          onBlur={commitWeight}
          onKeyDown={e => e.key === 'Enter' && commitWeight()} />
        {weightError && <div class="error">{weightError}</div>}
        {preview !== null && (
          <p>
            → {formatGrams(preview)} left
            {grams < cap.empty_spool_g && <span class="error"> - below the empty spool weight ({cap.empty_spool_g} g), check it</span>}
          </p>
        )}
        <label for="location">Location</label>
        <input id="location" value={location} onInput={e => setLocation(e.currentTarget.value)}
          onBlur={() => location !== unit.location && save({ ...unit, location })} />
        <div class="row">
          <button onClick={toggleArchive}>{unit.archived ? 'Unarchive' : 'Archive'}</button>
          <button class="danger" onClick={remove}>Delete</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Product detail**

`src/ui/ProductDetail.jsx`:
```jsx
import { useState } from 'preact/hooks'
import { repo } from '../store.js'
import { getLibrary } from '../libraries/index.js'
import { guard } from './toast.jsx'
import { navigate } from './router.js'
import { useLive } from './useLive.js'
import PhotoView from './PhotoView.jsx'
import UnitRow from './UnitRow.jsx'
import UnitSheet from './UnitSheet.jsx'

export default function ProductDetail({ id }) {
  const product = useLive(() => repo.getProduct(id), [id], null)
  const units = useLive(() => repo.listUnits(id), [id], [])
  const library = product?.library
  const presets = useLive(() => (library ? repo.listPresets(library) : {}), [library], {})
  const [showArchived, setShowArchived] = useState(false)
  const [openUnitId, setOpenUnitId] = useState(null)

  if (product === null) return null
  if (!product) return <><header class="bar"><a class="btn" href="#/">Back</a></header><p>Product not found.</p></>

  const lib = getLibrary(product.library)
  const cap = lib.capOf(product)
  const preset = presets[product.fields[lib.preset_key]] ?? {}
  const numbered = [...units].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((u, i) => ({ u, n: i + 1 }))
  const active = numbered.filter(x => !x.u.archived)
  const archived = numbered.filter(x => x.u.archived)
  const open = numbered.find(x => x.u.id === openUnitId)
  const unitWord = lib.unit_label.toLowerCase()
  const DetailInfo = lib.DetailInfo

  async function remove() {
    if (!confirm(`Delete ${product.name} and all its ${unitWord}s?`)) return
    const ok = await guard(async () => { await repo.deleteProduct(id); return true })
    if (ok) navigate('/')
  }

  const row = ({ u, n }) => <UnitRow key={u.id} lib={lib} cap={cap} unit={u} n={n} onOpen={() => setOpenUnitId(u.id)} />

  return (
    <>
      <header class="bar">
        <a class="btn" href="#/">Back</a>
        <h1>{product.name}</h1>
      </header>
      <div class="row" style="align-items:center">
        <div style="flex:0 0 auto"><lib.Visual product={product} size={96} /></div>
        {product.photo_id && <PhotoView id={product.photo_id} alt={product.name} />}
      </div>
      <DetailInfo product={product} preset={preset} />
      {product.notes && <p>{product.notes}</p>}
      <h2>{lib.unit_label}s ({active.length})</h2>
      {active.map(row)}
      <button onClick={() => guard(() => repo.addUnit(id))}>＋ Add {unitWord}</button>
      {archived.length > 0 && (
        <div class="row">
          <button aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>Show archived ({archived.length})</button>
        </div>
      )}
      {showArchived && archived.map(row)}
      <div class="row">
        <a class="btn" href={`#/edit/${id}`}>Edit</a>
        <a class="btn" href={`#/new/${id}`}>Duplicate</a>
        <button class="danger" onClick={remove}>Delete</button>
      </div>
      {open && <UnitSheet key={open.u.id} lib={lib} cap={cap} unit={open.u} n={open.n} onClose={() => setOpenUnitId(null)} />}
    </>
  )
}
```

- [ ] **Step 4: Wire the route**

In `src/App.jsx`, add the import and the case (keep the `new` and `edit` cases from Task 10):
```jsx
import ProductDetail from './ui/ProductDetail.jsx'
```
```jsx
    case 'product':
      page = <ProductDetail key={route.id} id={route.id} />
      break
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run build`
Expected: pass and build succeeds.

Run `npm run dev` in the browser pane at 375x812:
- Add a PETG product, Save: detail shows the name heading, swatch, "Nozzle 230-260 °C", "Bed 70-80 °C", one spool "Full · ~1.0 kg".
- Edit, set Nozzle max 250, Save: Nozzle row shows ★ and the footnote.
- Open Spool #1, type 850, press Enter: preview "→ 600 g left", the row reads "600 g" after closing.
- Type 100: the warning about the empty spool weight shows, preview "0 g left".
- Tap 1/2: weight input clears, row shows "1/2 · ~500 g".
- Archive: sheet closes, "Show archived (1)" appears; the grid tile is dimmed and sorts last.
- Add spool, Duplicate (form prefilled, name blank), Delete product (confirm, back to grid).
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add product detail, spool rows and spool sheet"
```

---

### Task 12: Settings (presets, export, import)

**Files:**
- Create: `src/ui/Settings.jsx`
- Modify: `src/App.jsx` (add `settings` route)

**Interfaces:**
- Consumes: `db`, `repo` (`listPresets`, `savePreset`, `listProducts`, `getMeta`), `exportBackup`, `parseImport`, `planImport`, `applyImport`, `ImportError`, `TABLES`, `daysSince`, `needsBackup`, library `presets`, `SETTING_KEYS`, `SETTING_LABELS`, `validateSettings`, `formatPresetLine`.
- Produces: `<Settings lib />`. Accessible names used by e2e: link "Back", button "Export backup", text "Last backup: 0 days ago".

- [ ] **Step 1: Implement Settings.jsx**

```jsx
import { useEffect, useState } from 'preact/hooks'
import { db, repo } from '../store.js'
import { ImportError, TABLES, applyImport, parseImport, planImport } from '../core/export.js'
import { daysSince, needsBackup } from '../core/reminder.js'
import { exportBackup } from './backupActions.js'
import { guard, toast } from './toast.jsx'
import { useLive } from './useLive.js'

const num = v => (v === '' || v == null ? null : Number(v))

function ImportPreview({ plan, onApply, onCancel }) {
  const changes = TABLES.reduce((sum, t) => sum + plan.counts[t].new + plan.counts[t].updated, 0)
  return (
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-label="Import preview">
        <h2>Import preview</h2>
        <table class="preview">
          <thead><tr><th /><th>New</th><th>Updated</th><th>Unchanged</th></tr></thead>
          <tbody>
            {TABLES.map(t => (
              <tr key={t}><td>{t}</td><td>{plan.counts[t].new}</td><td>{plan.counts[t].updated}</td><td>{plan.counts[t].unchanged}</td></tr>
            ))}
          </tbody>
        </table>
        <p class="muted">Records only replace yours when the backup copy is newer.</p>
        <div class="row">
          <button onClick={onCancel}>Cancel</button>
          <button class="primary" disabled={changes === 0} onClick={onApply}>{changes === 0 ? 'Nothing to import' : 'Apply'}</button>
        </div>
      </div>
    </div>
  )
}

function PresetEditor({ lib, material, preset, open, onToggle }) {
  const [draft, setDraft] = useState(null)
  useEffect(() => {
    if (open) setDraft(Object.fromEntries(lib.SETTING_KEYS.map(k => [k, preset[k] ?? null])))
  }, [open])

  if (!open || !draft) {
    return (
      <button class="unit-row" onClick={onToggle}>
        <strong>{material}</strong>
        <span class="muted">{lib.formatPresetLine(preset)}</span>
      </button>
    )
  }

  const errors = lib.validateSettings(draft)
  const valid = Object.keys(errors).length === 0
  async function save() {
    const ok = await guard(async () => { await repo.savePreset(lib.id, material, draft); return true })
    if (ok) onToggle()
  }

  return (
    <div class="sheet" style="position:static;border-radius:12px;border:1px solid var(--border);margin:6px 0">
      <strong>{material}</strong>
      {lib.SETTING_KEYS.map(k => (
        <div key={k}>
          <label for={`preset-${k}`}>{lib.SETTING_LABELS[k]}</label>
          <input id={`preset-${k}`} type="number" inputmode="numeric" value={draft[k] ?? ''}
            onInput={e => setDraft({ ...draft, [k]: num(e.currentTarget.value) })} />
          {errors[k] && <div class="error">{errors[k]}</div>}
        </div>
      ))}
      <div class="row">
        <button onClick={onToggle}>Cancel</button>
        <button class="primary" disabled={!valid} onClick={save}>Save preset</button>
      </div>
    </div>
  )
}

export default function Settings({ lib }) {
  const presets = useLive(() => repo.listPresets(lib.id), [lib.id], {})
  const products = useLive(() => repo.listProducts(lib.id), [lib.id], [])
  const lastBackup = useLive(() => repo.getMeta('last_backup_at'), [], null)
  const [plan, setPlan] = useState(null)
  const [openMaterial, setOpenMaterial] = useState(null)
  const days = daysSince(lastBackup, Date.now())
  const overdue = needsBackup(lastBackup, products.length, Date.now())

  async function onImportFile(e) {
    const input = e.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      setPlan(await planImport(db, parseImport(await file.text())))
    } catch (err) {
      toast(err instanceof ImportError ? err.message : "Couldn't read that file")
    }
  }

  async function apply() {
    const ok = await guard(async () => { await applyImport(db, plan); return true }, 'Import failed - nothing was changed')
    if (ok) {
      toast('Backup imported')
      setPlan(null)
    }
  }

  return (
    <>
      <header class="bar">
        <a class="btn" href="#/">Back</a>
        <h1>Settings</h1>
      </header>

      <h2>Backup</h2>
      <p class={overdue ? 'error' : 'muted'}>
        {days === null ? 'Never backed up' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago`}
      </p>
      <p class="muted">
        Your data lives only on this phone. Removing Spool Library from your home screen deletes it.
        Export regularly and save the file to iCloud Drive.
      </p>
      <div class="row">
        <button class="primary" onClick={() => guard(exportBackup, "Couldn't export - try again")}>Export backup</button>
        <label class="btn" style="margin:0;color:var(--text);font-size:16px">
          Import backup
          <input type="file" accept="application/json,.json" hidden onChange={onImportFile} />
        </label>
      </div>
      {plan && <ImportPreview plan={plan} onApply={apply} onCancel={() => setPlan(null)} />}

      <h2>{lib.label} presets</h2>
      <p class="muted">Used to fill print settings for new and existing products. A product's own values override these.</p>
      {Object.keys(lib.presets).map(m => (
        <PresetEditor key={m} lib={lib} material={m} preset={presets[m] ?? {}} open={openMaterial === m}
          onToggle={() => setOpenMaterial(openMaterial === m ? null : m)} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Wire the route**

In `src/App.jsx`, add the import and the case:
```jsx
import Settings from './ui/Settings.jsx'
```
```jsx
    case 'settings':
      page = <Settings lib={lib} />
      break
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run build`
Expected: pass and build succeeds.

Run `npm run dev` in the browser pane at 375x812:
- With one product and no backup, the grid ⚙ shows a red badge; Settings says "Never backed up" in red.
- Export backup downloads `spool-library-backup-<today>.json`; Settings then reads "Last backup: 0 days ago" and the badge is gone.
- Edit the PLA preset nozzle max to 100: "Max must be at least min", Save preset disabled; set 235 and save; a PLA product's detail shows 190-235 °C.
- Import the exported file: preview shows all "Unchanged", Apply disabled ("Nothing to import"). Import a file containing `{}`: toast "Unsupported backup version: undefined".
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add settings with preset editor and backup import/export"
```

---

### Task 13: End-to-end smoke test, CI and deploy

**Files:**
- Create: `playwright.config.js`, `tests/e2e/smoke.spec.js`, `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: the accessible names listed in Tasks 9-12.
- Produces: `npm run e2e`; a GitHub Pages deployment at `https://hcoel.github.io/spool-library/`.

- [ ] **Step 1: Playwright config**

```js
import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:4173/spool-library/'

export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'], baseURL } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 2: Write the smoke test**

`tests/e2e/smoke.spec.js`:
```js
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Force the download fallback; a share sheet cannot be driven headlessly
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })
})

test('add, weigh, archive, filter and export', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Add to Home Screen' })).toBeVisible()
  await page.getByRole('button', { name: 'Use in browser anyway' }).click()

  // Add a product
  await page.getByRole('link', { name: 'Add filament' }).click()
  await page.getByLabel('Brand').fill('Bambu')
  await page.getByLabel('Material').selectOption('PETG')
  await expect(page.getByLabel('Nozzle min')).toHaveAttribute('placeholder', '230')
  await page.getByLabel('Colour name').fill('Jade White')
  await page.getByLabel('Hex', { exact: true }).fill('#F0F0E8')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Bambu PETG Jade White' })).toBeVisible()

  // Weigh the spool
  await page.getByRole('button', { name: 'Spool #1' }).click()
  const scale = page.getByLabel('Scale reading (g)')
  await scale.fill('850')
  await scale.press('Enter')
  await expect(page.getByText('600 g left')).toBeVisible()

  // Archive it
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show archived (1)' })).toBeVisible()

  // Filter on the grid
  await page.getByRole('link', { name: 'Back' }).click()
  const tile = page.getByRole('link', { name: 'Bambu PETG Jade White' })
  await expect(tile).toBeVisible()
  const material = page.getByRole('group', { name: 'Material' })
  await material.getByRole('button', { name: 'PLA', exact: true }).click()
  await expect(tile).toHaveCount(0)
  await material.getByRole('button', { name: 'PLA', exact: true }).click()
  await material.getByRole('button', { name: 'PETG', exact: true }).click()
  await expect(tile).toBeVisible()

  // Export
  await page.getByRole('link', { name: 'Settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  expect((await download).suggestedFilename()).toMatch(/^spool-library-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByText('Last backup: 0 days ago')).toBeVisible()
})
```

- [ ] **Step 3: Run it**

Run: `npx playwright install webkit && npm run e2e`
Expected: 1 passed. If a locator fails, fix the component's accessible name to match the names listed in Tasks 9-12 (the test is the contract), not the other way round.

- [ ] **Step 4: GitHub Actions workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Test and deploy

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps webkit
      - run: npm run e2e
        env:
          CI: true
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    needs: test-build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
Before committing, check each action's latest major (`gh api repos/actions/checkout/releases/latest --jq .tag_name`, same for `setup-node`, `upload-pages-artifact`, `deploy-pages`) and bump the `@vN` tags if newer majors exist.

- [ ] **Step 5: README with the manual device checklist**

`README.md`:
```markdown
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
```

- [ ] **Step 6: Run everything locally**

Run: `npm test && npm run e2e && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit, enable Pages, push**

```bash
git add -A
git commit -m "Add e2e smoke test, CI workflow and README"
gh api -X POST repos/HCoel/spool-library/pages -f build_type=workflow
git push
gh run watch --exit-status
```
Expected: the workflow completes green; `deploy` job prints the Pages URL.

- [ ] **Step 8: Verify the deployment**

Open `https://hcoel.github.io/spool-library/` in the browser pane at mobile size. Expected: the install gate appears; after dismissing, the app works and `manifest.webmanifest` loads (check the network panel). Then hand the README's manual device checklist to Hannah for the on-phone checks, which cannot be automated.
