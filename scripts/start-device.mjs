/**
 * Start Metro for a phone (dev-client) session.
 *
 * ## Why this is not just `expo start --dev-client`
 *
 * `EXPO_PUBLIC_API_BASE_URL` is inlined into the bundle by Metro, and `.env.local` points it at
 * `http://localhost:8787` — the dev CORS proxy the web build needs. A phone cannot reach the
 * laptop's localhost, so a bundle carrying that value fails every request on device with no
 * obvious cause. Rather than make the developer remember to edit `.env.local` before each phone
 * session (and remember to put it back), this sets the hosted API for this process only.
 *
 * A variable already in the environment wins: dotenv never overwrites `process.env`, which is
 * the same reason the shell one-liner works. So `PROXY`-style overrides still work:
 *
 *   $env:EXPO_PUBLIC_API_BASE_URL='http://192.168.1.3:5161'; npm run start:device
 *
 * Any extra arguments are passed through, so `npm run start:device -- --tunnel` reaches a phone
 * that is not on the same Wi-Fi, and `-- --clear` resets the bundler cache.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const HOSTED_API = 'https://169.58.199.63.sslip.io';

if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  process.env.EXPO_PUBLIC_API_BASE_URL = HOSTED_API;
}

console.log(`Device session — API: ${process.env.EXPO_PUBLIC_API_BASE_URL}`);
console.log(
  'Scan the QR with the dev-client build (not Expo Go — this app needs custom native code).\n'
);

// Spawned through Node against Expo's own entrypoint rather than "npx expo" through a shell:
// a shell concatenates the pass-through arguments unescaped, which Node now warns about.
const require = createRequire(import.meta.url);
const expoCli = require.resolve('expo/bin/cli');
const child = spawn(
  process.execPath,
  [expoCli, 'start', '--dev-client', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('exit', (code) => process.exit(code ?? 0));
