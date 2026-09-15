import { defineConfig, devices } from '@playwright/test';

/**
 * Pixel regression for the web design.
 *
 * Every visual problem found during the layout work this week — a form floating on the pattern,
 * a white button on a white ground, a filter row aligned to the window instead of the column, a
 * scrollbar in the middle of the page — was found by a person looking at a screenshot. None of
 * them would have failed a unit test, because none of them was wrong structurally. This is the
 * net for that class of bug.
 *
 * **The API is mocked, not running.** `visual/mock-api.ts` fulfils every call from fixtures, so a
 * run needs no database, no seed data and no backend container — and, more importantly, produces
 * the same pixels every time. Screenshots taken against live data would diff on a booking date.
 *
 * **Goldens are Linux, and specifically this container.** Font rendering is most of what a
 * screenshot comparison measures, so a Windows-generated baseline fails on CI for reasons that
 * have nothing to do with the change - and so does one taken on a bare Ubuntu runner, whose font
 * set is not the image's. The CI job runs inside the image below; regenerate them the same way,
 * with the dev server already running on the host:
 *
 *     docker run --rm -v "$PWD":/work -w /work -e HOME=/tmp  *       -e VISUAL_BASE_URL=http://host.docker.internal:8081  *       --add-host=host.docker.internal:host-gateway  *       mcr.microsoft.com/playwright:v1.56.0-noble  *       npx playwright test --config visual/playwright.config.ts --update-snapshots
 *
 * Drop `--update-snapshots` to compare instead. `npm run visual` runs it against whatever
 * platform you are on, which is useful while writing a test and useless for judging a diff.
 */
export default defineConfig({
  testDir: '.',
  // The dev server is slow to boot and the first navigation compiles the bundle.
  timeout: 90_000,
  expect: {
    toHaveScreenshot: {
      // Antialiasing differs by a pixel or two between runs of the same build; a hard zero here
      // produces failures nobody can act on, which is how a visual suite gets switched off.
      maxDiffPixelRatio: 0.01,
    },
  },
  // A visual baseline is only meaningful if the run is deterministic, and a retry that passes
  // hides a real flake.
  retries: 0,
  workers: 1,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',

  use: {
    baseURL: process.env.VISUAL_BASE_URL ?? 'http://localhost:8081',
    // Fixed so a golden never depends on the machine's scaling.
    deviceScaleFactor: 1,
  },

  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    // The phone design is the shipped product — it gets a baseline too.
    { name: 'mobile', use: { ...devices['iPhone 13'], isMobile: false, hasTouch: false } },
  ],
});
