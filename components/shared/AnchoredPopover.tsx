import React, { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type Rect = { x: number; y: number; width: number; height: number };

/** Something a popover can open under: a DOM node on the web, or anything RN can measure. */
export type PopoverAnchor = {
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void;
} | null;

/**
 * The element a press came from, to open a popover under it. On the web a press event's
 * `currentTarget` is the pressed element; it is read inside the handler, before React clears it.
 */
export function anchorOf(event: unknown): PopoverAnchor {
  const target = (event as { currentTarget?: PopoverAnchor } | null)?.currentTarget ?? null;
  return target && (target.getBoundingClientRect || target.measureInWindow) ? target : null;
}

function measure(anchor: PopoverAnchor, done: (rect: Rect) => void) {
  if (!anchor) return;
  if (typeof anchor.getBoundingClientRect === 'function') {
    const r = anchor.getBoundingClientRect();
    done({ x: r.left, y: r.top, width: r.width, height: r.height });
    return;
  }
  anchor.measureInWindow?.((x, y, width, height) => done({ x, y, width, height }));
}

type AnchoredPopoverProps = {
  visible: boolean;
  onClose: () => void;
  /** What it opens under: an element (see `anchorOf`) or a ref to one. */
  anchor: PopoverAnchor | RefObject<unknown>;
  children: ReactNode;
  /** Panel width; defaults to the anchor's own width, as a select's list is. */
  width?: number;
  minWidth?: number;
  /** Caps the anchor-wide default — a list under a full-width settings row needn't span it. */
  maxWidth?: number;
  maxHeight?: number;
  /** Which edge of the anchor the panel lines up with when narrower than it. */
  align?: 'start' | 'end';
  /** Scroll the content when it is taller than the room. Off for content that scrolls itself. */
  scroll?: boolean;
};

const GAP = 4;
const MARGIN = 8;

/**
 * Where the panel goes: under the anchor when its content fits there, else above it when there is
 * more room above; as wide as the anchor unless told otherwise, and always inside the window.
 */
export function placePanel({
  rect,
  winW,
  winH,
  width,
  minWidth,
  maxWidth = Number.POSITIVE_INFINITY,
  maxHeight,
  align = 'start',
  contentHeight,
}: {
  rect: Rect;
  winW: number;
  winH: number;
  width?: number;
  minWidth: number;
  maxWidth?: number;
  maxHeight: number;
  align?: 'start' | 'end';
  contentHeight: number | null;
}): { left: number; width: number; height: number; top?: number; bottom?: number } {
  const panelWidth = Math.min(
    Math.max(Math.min(width ?? rect.width, maxWidth), minWidth),
    winW - 2 * MARGIN
  );
  const start = align === 'end' ? rect.x + rect.width - panelWidth : rect.x;
  const left = Math.min(Math.max(MARGIN, start), winW - MARGIN - panelWidth);
  const roomBelow = winH - (rect.y + rect.height) - GAP - MARGIN;
  const roomAbove = rect.y - GAP - MARGIN;
  const needed = Math.min(maxHeight, contentHeight ?? maxHeight);
  const openUp = roomBelow < needed && roomAbove > roomBelow;
  const height = Math.max(120, Math.min(needed, openUp ? roomAbove : roomBelow));
  return openUp
    ? { left, width: panelWidth, height, bottom: winH - rect.y + GAP }
    : { left, width: panelWidth, height, top: rect.y + rect.height + GAP };
}

/**
 * A panel that opens directly under the control that opened it, the way a desktop dropdown
 * does — for the web design (feedback 2026-10-21). The pickers used to open as a sheet or a
 * dialog over a dimmed window, which on a phone is the right thing and on a monitor hides the
 * whole form to choose one value.
 *
 * Rendered in a transparent `Modal` rather than as an absolutely positioned child: the forms sit
 * inside cards and scroll panes that would clip a child panel, and the transparent layer is also
 * what closes it on a click anywhere else. It measures its content first (drawn invisibly for a
 * frame) and opens upwards when that doesn't fit below — a calendar opened low on the page was
 * cut off otherwise. **Esc** closes it, and so does resizing the window, which would leave it
 * floating away from its field.
 */
export default function AnchoredPopover({
  visible,
  onClose,
  anchor,
  children,
  width,
  minWidth = 200,
  maxWidth = Number.POSITIVE_INFINITY,
  maxHeight = 320,
  align = 'start',
  scroll = true,
}: AnchoredPopoverProps) {
  const { cardBg, borderColor } = useThemeColors();
  const { width: winW, height: winH } = useWindowDimensions();
  const [rect, setRect] = useState<Rect | null>(null);
  // The content's own height, measured before the panel is placed.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  useEscapeToClose(visible, onClose);

  useEffect(() => {
    setContentHeight(null);
    if (!visible) {
      setRect(null);
      return;
    }
    const target =
      anchor && 'current' in (anchor as object)
        ? ((anchor as RefObject<unknown>).current as PopoverAnchor)
        : (anchor as PopoverAnchor);
    measure(target, setRect);
  }, [visible, anchor]);

  const openedAt = useRef({ w: winW, h: winH });
  useEffect(() => {
    if (visible) openedAt.current = { w: winW, h: winH };
    // Only on opening: the size it opened at is what a later resize is compared with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(() => {
    if (visible && (openedAt.current.w !== winW || openedAt.current.h !== winH)) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winW, winH]);

  // Unmounted rather than hidden, like the other pickers: a `visible={false}` Modal can outlive
  // a re-render on the web as a detached portal.
  if (!visible || !rect) return null;

  const {
    height,
    width: panelWidth,
    ...place
  } = placePanel({
    rect,
    winW,
    winH,
    width,
    minWidth,
    maxWidth,
    maxHeight,
    align,
    contentHeight,
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        accessible={false}
        focusable={false}
        tabIndex={-1}
        onPress={onClose}
        style={{ flex: 1 }}>
        {/* Swallows the press so a click inside the panel doesn't reach the layer behind it. */}
        <Pressable
          accessible={false}
          focusable={false}
          tabIndex={-1}
          onPress={(e) => e.stopPropagation()}
          className={`${cardBg} border ${borderColor} rounded-xl`}
          style={{
            position: 'absolute',
            width: panelWidth,
            maxHeight: height,
            overflow: 'hidden',
            ...place,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
            // Hidden for the frame it takes to measure the content.
            opacity: contentHeight == null ? 0 : 1,
          }}>
          {scroll ? (
            <ScrollView style={{ maxHeight: height }} keyboardShouldPersistTaps="handled">
              <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
                {children}
              </View>
            </ScrollView>
          ) : (
            <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>{children}</View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
