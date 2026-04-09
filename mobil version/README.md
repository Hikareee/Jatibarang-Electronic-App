# IBASA — mobile version (Android APK)

This folder contains the **Capacitor** Android shell. The actual React app lives in the **parent directory**; builds are read from `../dist`.

## Prerequisites

1. **Node.js** (same as main project).
2. **Android Studio** with Android SDK + a device or emulator.
3. **JDK 17** (Android Studio usually bundles a suitable JDK).

## One-time setup

From this directory (`mobil version`):

```bash
npm install
```

If the `android/` folder does not exist yet (first clone), add the native project:

```bash
npm run build:web
npx cap add android
```

## Build web + sync into Android

```bash
npm run sync
```

This runs `VITE_APP_BASE=./ npm run build` in the parent app, then copies `../dist` into the Android project.

## Open in Android Studio (generate APK / AAB)

```bash
npm run open:android
```

In Android Studio:

- **Debug APK:** Build → Build Bundle(s) / APK(s) → Build APK(s).
- **Release:** Build → Generate Signed Bundle / APK → follow the wizard (you need a keystore for Play Store).

## Environment / Firebase

`VITE_*` variables from the parent `.env` are baked in at **web build** time. Set them in the **repository root** `.env` before `npm run sync`.

## Project layout

| Path | Role |
|------|------|
| `../` | Vite + React app |
| `../dist` | Static output consumed by Capacitor |
| `./android/` | Native Android project (after `cap add android`) |
| `capacitor.config.json` | App id, name, `webDir: ../dist` |

## Notes

- Use **HTTPS** APIs only; cleartext HTTP is disabled in config.
- For deep links or push notifications later, extend Capacitor plugins in this package.
