/**
 * Fixed sizes of the web design's chrome.
 *
 * Their own module rather than exports on the components that draw them: a screen sizing itself
 * against the top bar needs the number, not the bar — and importing `TopBar` for it drags the
 * notification context, the hub connection and the navigation ref in behind it, which is how a
 * plain layout constant ends up deciding what a test has to mock.
 */

/** Height of the persistent `TopBar` above every screen on the web design. */
export const TOPBAR_HEIGHT = 64;
