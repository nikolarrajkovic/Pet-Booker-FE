/**
 * Native no-op. See `document-scroll.web.ts` — a device screen *is* the window, so the behaviour
 * the web version has to undo is the correct behaviour here.
 */
export function enableDocumentScroll(): void {}
