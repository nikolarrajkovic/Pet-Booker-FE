# PetBooker — app

The PetBooker customer, partner and admin app: React Native + Expo (Android, iOS and the web), one
codebase with a phone design and a web design.

```bash
npm ci
cp .env.example .env    # EXPO_PUBLIC_API_BASE_URL=http://localhost:5161 for the local backend
npm run web             # or: npm start (device / emulator)
```

Checks CI runs: `npx tsc --noEmit`, `npm run lint`, `npx prettier -c "**/*.{js,jsx,ts,tsx,json}"`,
`npm test`, and the Playwright visual suite in `visual/`.

Where to read next:
- [`CLAUDE.md`](CLAUDE.md) — architecture, conventions, every service and screen.
- [`WEB_LAYOUT.md`](WEB_LAYOUT.md) — the two designs and the rules between them.
- [`WEB_DEPLOYMENT.md`](WEB_DEPLOYMENT.md) / [`ANDROID_BUILD.md`](ANDROID_BUILD.md) — shipping it.
- [`BACKEND_GAPS.md`](BACKEND_GAPS.md) — features the API does not back yet.
- [`docs/code-review-2026-10-14.md`](docs/code-review-2026-10-14.md) — the latest review.

The backend (PetBookerBackend) is a separate repository; its `docker compose up` brings up the
API this app talks to.
