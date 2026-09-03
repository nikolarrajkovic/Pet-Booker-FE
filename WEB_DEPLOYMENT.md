# Deploying the web app

The Expo app also builds for the browser. This is the runbook for serving that build publicly
from the same VM as the backend, at its own hostname, with a real certificate and no domain
purchase.

For local web development nothing here applies — keep using `npm run web`.

The exported bundle carries **both** of the app's designs — the phone one and the desktop one —
and picks between them from the window width at runtime, so there is nothing platform-specific to
build or serve differently. A visitor on a phone browser gets the phone design from the same
files. See [`WEB_LAYOUT.md`](WEB_LAYOUT.md).

---

## What gets deployed

`npx expo export --platform web` produces a ~7.6MB static site: one `index.html`, one hashed JS
bundle, one hashed CSS file, a favicon and ~30 font/image assets. No server, no Node at runtime.

A `web` container holds that export behind a tiny Caddy file server. It publishes no port; the
backend stack's edge Caddy — already the only thing on 80/443 — proxies to it by container name
over the shared compose network.

```
browser ──https──▶ edge Caddy ──▶ web            (app.<ip>.sslip.io)  static files
                              └──▶ petbookerapi  (<ip>.sslip.io)      API + hubs
```

## Why two hostnames and not one

The app has real URLs. `navigation/linking.ts` maps ~44 routes, and several sit exactly where API
routes already live:

| | App route | API route |
|---|---|---|
| | `/admin/partners` | `GET /admin/users` |
| | `/bookings/7` | `POST /bookings/7/confirm` |

Sharing one origin would mean an exact-path allowlist in the proxy, hand-synced with the front
end's router forever. When it drifts — and it drifts the first time someone adds a screen — the
failure is silent: a deep link returns JSON, or an API call returns HTML. Two hostnames cost one
CORS setting and remove the whole class of problem.

sslip.io resolves subdomains as happily as it resolves the root name, so `app.<ip>.sslip.io`
needs no registrar, no DNS record and no wait. Caddy obtains its certificate automatically.

## Config is baked in, not injected

`EXPO_PUBLIC_*` values are **inlined into the JavaScript bundle** by Metro. The backend URL ends
up as a string literal inside `AppEntry-<hash>.js`; nothing reads it at runtime.

So: **changing the API URL or the Maps key means `up -d --build`, never `restart`.** Setting them
as `environment:` in compose would do nothing at all, silently. They are build args for that
reason, and the Dockerfile greps the finished bundle for the URL so a failure to inline it breaks
the build instead of shipping a white screen.

---

## 1. Prerequisites

The backend stack from `PetBookerBackend/docker-compose.sandbox.yml` is already up (it owns the
network this joins, and the proxy that fronts it).

## 2. Backend: add the hostname and the CORS origin

On the server, in the **backend** checkout:

```bash
cd /opt/petbooker
git pull
nano .env
```

Add both — the second is the full origin, scheme included, and is what lets a browser call the
API cross-origin at all:

```
WEB_HOST=app.169.58.199.63.sslip.io
CORS_ORIGIN_0=https://app.169.58.199.63.sslip.io
```

`CORS_ORIGIN_0` changes the API's configuration, so that host does have to restart:

```bash
docker compose -f docker-compose.sandbox.yml up -d petbookerapi caddy
```

## 3. Deploy the web app

```bash
git clone <this-repo> /opt/petbooker-fe
cd /opt/petbooker-fe
cp .env.web.example .env.web && chmod 600 .env.web
nano .env.web        # EXPO_PUBLIC_API_BASE_URL=https://169.58.199.63.sslip.io  (the BACKEND host)
docker compose -f docker-compose.web.yml --env-file .env.web up -d --build
```

The first build takes a few minutes and downloads ~400MB of npm packages. Later builds reuse that
layer unless `package-lock.json` changed.

Bring this up **before** reloading the proxy, so the first request has something to reach.

## 4. Point the proxy at it

```bash
cd /opt/petbooker
docker compose -f docker-compose.sandbox.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

A reload rather than a restart: the Caddyfile is a bind mount, so `up -d` sees no change to the
service definition and would do nothing. Certificate issuance for the new hostname happens on the
first request and takes a few seconds.

## 5. Verify

```bash
curl -sI https://app.169.58.199.63.sslip.io/ | head -3          # 200, text/html
curl -s  https://app.169.58.199.63.sslip.io/ | grep -o '<title>.*</title>'
curl -sI https://app.169.58.199.63.sslip.io/bookings/7 | head -1 # 200 — the SPA fallback, not a 404
curl -s -o /dev/null -w '%{http_code}\n' https://169.58.199.63.sslip.io/health/live  # 200, API untouched
```

Then in a browser, because these are the parts curl cannot answer:

- **Sign in.** Proves CORS, the token flow and the API origin in one step. A CORS failure shows
  only in the devtools console — the UI just looks stuck.
- **Refresh on a deep link** (`/bookings/<id>`). Proves the SPA fallback.
- **Open a chat or wait for a notification.** Proves the WebSocket upgrade survives the proxy.
- **Load a screen with photos.** Proves `/files/...` resolves against the backend origin.
- **Open a map screen.** See the Maps note below.

---

## Operating

**Deploy a change**

```bash
cd /opt/petbooker-fe && git pull
docker compose -f docker-compose.web.yml --env-file .env.web up -d --build
```

The backend is untouched by this — no API restart, no migrations, no downtime for mobile clients.

**Roll back**

```bash
git checkout <previous-sha>
docker compose -f docker-compose.web.yml --env-file .env.web up -d --build
```

There is no state to unwind: the container is a pile of static files.

**Reclaim disk.** Each build leaves an intermediate Node layer behind. After a few deploys:

```bash
docker builder prune -f
```

---

## Known limits

**Google Maps needs its origin allowed.** The four web map surfaces (search map, address picker,
directions modal, live-session map) use a referrer-restricted key. The development key is
restricted to `localhost:8081` and will not work here — add `https://app.<ip>.sslip.io/*` to the
key's HTTP referrer restrictions in Google Cloud, and keep it restricted to the Maps JavaScript
API. The key ships inside a public bundle, so that restriction is the only thing protecting it.
Leaving the key out entirely is supported: maps render blank, nothing else changes.

**No device push on the web.** `services/push-registration.ts` no-ops off-device by design, so web
users get in-app notifications, SignalR and email — but nothing reaches them with the tab closed.

**Tokens live in `localStorage`.** `services/token-storage.ts` falls back from SecureStore on web.
Any XSS on this origin can read a session. Worth knowing before handing links to testers.

**No SSR.** One client-rendered 3.6MB bundle; search engines see an empty root element. Fine for
an app behind a login, not a basis for public marketing pages.

## Moving to a real domain later

Point an A record at the VM, then change three values and rebuild:

| Where | Key |
|---|---|
| backend `.env` | `PUBLIC_HOST`, `WEB_HOST`, `CORS_ORIGIN_0` |
| `.env.web` here | `EXPO_PUBLIC_API_BASE_URL` |
| `eas.json` | `EXPO_PUBLIC_API_BASE_URL` for the preview/production profiles |

Plus the referrer restriction on the Maps key. Nothing else moves.
