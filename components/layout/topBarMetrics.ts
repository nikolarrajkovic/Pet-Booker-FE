/**
 * The web design's top bar height, on its own.
 *
 * Split out of `TopBar.tsx` because the screens that need this number need *only* this number —
 * a thread sizing itself to `calc(100vh - TOPBAR_HEIGHT)` does not want the bar itself, and
 * importing the component to read a constant drags the notification and message contexts (and
 * through them the navigation container ref) into the module graph of anything that measures
 * against it.
 */
export const TOPBAR_HEIGHT = 64;
