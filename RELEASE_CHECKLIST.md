# Perfect Pupil Release Checklist

This checklist is for release preparation only. It does not auto-publish builds.

## Web Launch Checklist

- [ ] Copy `.env.example` to `.env.local` (or CI env) and set:
  - `VITE_BASE44_APP_ID`
  - `VITE_BASE44_APP_BASE_URL`
  - `VITE_BASE44_FUNCTIONS_VERSION` (optional)
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Smoke test `dist` with `npm run preview`
- [ ] Confirm app routing rewrite is configured on host (SPA fallback to `index.html`)
- [ ] Confirm `public/manifest.webmanifest` values match production brand/domain
- [ ] Verify icons exist and load:
  - `public/icons/icon-192.png`
  - `public/icons/icon-512.png`
  - `public/icons/apple-touch-icon.png`
  - `public/icons/favicon.svg`
- [ ] Verify service worker registration in production (`src/main.jsx`)
- [ ] Verify offline fallback page renders when network is disabled (`public/offline.html`)

## Windows Store (PWA) Checklist

- [ ] Validate installability in Edge (manifest + service worker + HTTPS)
- [ ] Confirm app installs with correct name, icon, and standalone window behavior
- [ ] Confirm offline fallback UX for navigation failures
- [ ] Use PWABuilder (or equivalent) to generate MSIX package from production URL
- [ ] Validate package identity/publisher settings for Store submission
- [ ] Run Windows App Certification Kit on generated package
- [ ] Verify deep-link behavior after install (SPA route fallback still required server-side)

## Mobile Wrapper (Capacitor) Checklist

- [ ] Use `capacitor.config.example.json` as a template for future `capacitor.config.*`
- [ ] Keep `webDir` as `dist` and build web first (`npm run build`)
- [ ] Add platform projects only after legal/privacy/payment policy is finalized
- [ ] Validate assumptions that may break in wrappers:
  - Browser-only auth redirect and URL-param flows (`window.location`, query params)
  - Browser download/upload UX for brain export/import (file picker + blob download)
  - BrowserRouter deep links and back-stack behavior
  - Service worker behavior (not relied on in native webviews)
- [ ] Decide whether auth is in-app webview only or external browser handoff
- [ ] Define secure storage strategy for tokens before mobile release

## Privacy / Policy Checklist

- [ ] Publish privacy policy and terms URLs referenced in-app/store metadata
- [ ] Document brain export/import data handling, encryption model, and retention
- [ ] Verify no plaintext secret keys or provider credentials are exposed client-side
- [ ] Confirm user data deletion/account deletion support path
- [ ] Verify telemetry/error logging does not include sensitive companion brain payloads

## Payments / Subscription Warnings

- [ ] Do not rely on client-only gating for paid features
- [ ] Keep server-side entitlement enforcement as source of truth for:
  - Companion roster limits
  - Premium evolution/customization gates
  - Brain export/import access
- [ ] Replace any placeholder tier switching UX with real billing provider/webhook flow before store launch
- [ ] Validate upgrade messaging and blocked-action errors are user-friendly

## Current Known Blockers / Follow-Ups

- `npm run build` passes, but `npm run typecheck` currently fails across many JSX files due pre-existing typing/config issues.
- Subscription tier changes currently include a direct tier-setting flow in UI; production billing integration and anti-tamper policy must be finalized before store submission.
- SPA host rewrite to `index.html` is required for deep links (`/Home`, `/Battle`, etc.) in web and installed PWA contexts.

