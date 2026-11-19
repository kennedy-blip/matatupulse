# MatatuPulse

**Public Transit Fleet, Remittance & Stage Dispatch OS** — an offline-first command centre for Kenyan matatu SACCOs, fleet owners, conductors, drivers and stage marshals.

MatatuPulse closes three everyday gaps:

1. **Revenue leakage** — every round-trip collection is logged per vehicle and per day, with fuel, stage fees, car wash and squad costs deducted automatically to show the exact net remittance owed to the owner.
2. **Unverified remittances** — owners settle a vehicle-day into a receipted record, reopen it if the ledger changes, and export CSV audit statements. Field staff can log money but cannot alter baselines or delete history.
3. **Missed maintenance** — mileage, oil-change countdowns, NTSA inspection renewals and PSV insurance expiries generate automatic warnings and a health score per PSV.

## Stack

- React 19 + Vite 8 + Tailwind CSS 3
- Framer Motion (spring physics: `stiffness: 300`, `damping: 25`)
- Lucide React icons
- Dexie.js over IndexedDB for every write (full offline operation)
- Workbox service worker via `vite-plugin-pwa` for an installable PWA shell
- Capacitor 8 Android wrapper and a GitHub Actions APK pipeline
- SPA config for Vercel in `vercel.json`

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static production bundle in dist/
npm run preview      # serve the production bundle
npm run test:smoke   # headless DOM + IndexedDB smoke test
```

On first launch the app seeds a demo fleet (KDG 412X, KDH 218M, KDB 774K, KDC 109Z) with seven days of collections, expenses, stage queue entries and compliance records. All data lives on the device; use **Settings → Backup & storage** to export or restore a JSON snapshot.

## Modules

| Tab | What it does |
| --- | --- |
| **Remittance Ledger** | Log round-trip collections (rounds × passengers × fare) and operational expenses, filter by vehicle/date/status, expand per-vehicle-day breakdowns, settle or reopen remittances, compare vehicle performance, export CSV audits. |
| **Stage Dispatch** | Live queue with per-bay timers, call-to-bay and depart actions, automatic delayed flags from the configurable interval, turnaround log, stage filters and marshal notes. |
| **Fleet Health** | Mileage and oil-change countdown rings, NTSA/PSV insurance expiry alerts, severity filters, compliance matrix, owner-only date editing and one-tap "Log service" reset. |
| **Settings & APK** | Role switcher, three-theme engine, operational baselines, storage statistics, JSON backup/restore, activity trail, offline cache check and the Android APK center. |

## Roles and privileges

Privileges are enforced in `src/db/actions.js` with `assertCan()` — not just hidden in the UI.

| Capability | Owner / SACCO Admin | Crew / Stage Marshal |
| --- | --- | --- |
| Log collections and expenses | ✅ | ✅ |
| Update dispatch times | ✅ | ✅ |
| Settle / reopen remittances | ✅ | ❌ |
| Set daily targets and expense limits | ✅ | ❌ |
| Edit compliance dates and log service | ✅ | ❌ |
| Delete historical ledger entries | ✅ | ❌ |
| Export audits / restore backups | ✅ | ❌ |
| Manage the stage queue and interval | ✅ | ❌ |

Use the segmented control at the top of **Settings** to switch roles. Every switch is recorded in the activity trail.

## Themes

- **Night Stage Neon** (default) — `#090a0f` obsidian, amber/violet mesh glow, frosted glass.
- **Daylight Commute** — milk-glass surfaces, slate borders, emerald profit badges.
- **High-Contrast Terminal** — amber-on-black, no blur, heavy borders for direct midday sunlight.

Themes are stored in IndexedDB and applied with `data-theme` on `<html>`.

## Deployment

### Web (Vercel)

`vercel.json` builds `npm run build`, serves `dist/` and rewrites client-side routes to `index.html`. Service worker headers are set to no-cache so updates propagate. Import the repository into Vercel or deploy from the connected Vercel app; no environment variables are required.

### Android APK

The Capacitor project lives in `android/`. The `.github/workflows/android-apk.yml` pipeline:

1. builds the same static bundle,
2. runs `npx cap sync android`,
3. compiles the APK with Java 17 + Android SDK 36,
4. uploads it as a workflow artifact, and
5. attaches `matatupulse.apk` to a GitHub release when a `v*` tag is pushed.

The in-app **Download Android APK** button checks for a bundled `/downloads/matatupulse.apk` first, then the latest GitHub release asset. If no binary is published yet, it shows working one-command build steps and links to the workflow.

Local build:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

`python3 scripts/generate_icons.py` regenerates the branded launcher, adaptive and splash icons from a single drawing routine (requires Pillow only at generation time).

## File structure

```
src/
  components/    RemittanceLedger, StageDispatch, FleetCompliance,
                 RoleSwitcher, ThemeToggle, DownloadAPKModal,
                 SettingsView and shared UI primitives
  context/       AppContext (role, theme, toasts, confirmations, connection)
  db/            Dexie schema, seed data, permission-checked actions
  lib/           Permissions, formatting/export helpers
  styles/        Glass utilities and animated mesh gradients
android/         Capacitor native Android project
public/          PWA manifest icons and SVG mark
scripts/         Headless smoke test and icon generator
```
