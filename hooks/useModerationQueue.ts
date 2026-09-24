import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { usePagedList, type PagedListState } from './usePagedList';
import { subscribeResource } from '../services/cache';
import type { PagedResult } from '../services/http';
import {
  ApprovalStatus,
  SubmissionOrder,
  type SubmissionOrderValue,
} from '../services/service-providers';

/** The three tabs every moderation list has. */
export type ModerationTab = 'pending' | 'approved' | 'rejected';

const TAB_STATUS: Record<ModerationTab, number> = {
  pending: ApprovalStatus.Pending,
  approved: ApprovalStatus.Approved,
  rejected: ApprovalStatus.Declined,
};

/**
 * Each tab's order until the reviewer picks another.
 *
 * A pending queue is worked oldest first — whoever has waited longest is next, and a newest-first
 * queue buries the applicant who applied a week ago under everyone who applied since. Decisions
 * already made are read the other way: the one you want is almost always the one just made.
 */
export const DEFAULT_TAB_ORDER: Record<ModerationTab, SubmissionOrderValue> = {
  pending: SubmissionOrder.OldestFirst,
  approved: SubmissionOrder.NewestFirst,
  rejected: SubmissionOrder.NewestFirst,
};

/** The sort choices a moderation list offers. */
export const SUBMISSION_ORDER_OPTIONS = [
  { value: SubmissionOrder.NewestFirst, labelKey: 'admin.sortNewestFirst' },
  { value: SubmissionOrder.OldestFirst, labelKey: 'admin.sortOldestFirst' },
] as const;

export const MODERATION_PAGE_SIZE = 20;

export type ModerationPageQuery = {
  approvalStatus: number;
  order: SubmissionOrderValue;
  page: number;
  perPage: number;
};

export type ModerationQueueState<T> = PagedListState<T> & {
  activeTab: ModerationTab;
  setActiveTab: (tab: ModerationTab) => void;
  /** The active tab's order. */
  order: SubmissionOrderValue;
  setOrder: (order: SubmissionOrderValue) => void;
  /** How many items each tab holds — the server's count, not the rows loaded so far. */
  counts: Record<ModerationTab, number>;
};

/**
 * A moderation list on the web design: pending / approved / declined tabs, each paging itself from
 * the server as the reviewer scrolls, in its own order.
 *
 * The screens used to read *everything* up front and split it into tabs on the client — for
 * applications that was every provider in the system, one 200-row page after another, and for
 * reviews the first 200 only, so anything past that was unreachable. Here each tab asks the
 * server for its own status, one page at a time, and the badges ask for a count (one row each).
 *
 * `resource` keeps it current: an approve or decline — from this list or from the detail screen —
 * invalidates it, which refreshes the loaded pages in place and re-reads the counts.
 */
export function useModerationQueue<T>({
  fetchPage,
  count,
  resource,
  errorFallback,
}: {
  /** Must be stable (`useCallback` / a module function). */
  fetchPage: (query: ModerationPageQuery) => Promise<PagedResult<T>>;
  /** Must be stable. How many items carry this ApprovalStatus. */
  count: (approvalStatus: number) => Promise<number>;
  resource: string;
  errorFallback: string;
}): ModerationQueueState<T> {
  const [activeTab, setActiveTab] = useState<ModerationTab>('pending');
  // Per tab, so picking an order on one tab does not reorder the others behind the reviewer's back.
  const [orders, setOrders] = useState(DEFAULT_TAB_ORDER);
  const order = orders[activeTab];

  const fetchTabPage = useCallback(
    (page: number) =>
      fetchPage({
        approvalStatus: TAB_STATUS[activeTab],
        order,
        page,
        perPage: MODERATION_PAGE_SIZE,
      }),
    [fetchPage, activeTab, order]
  );
  const list = usePagedList<T>(fetchTabPage, { errorFallback, resource });

  const [counts, setCounts] = useState<Record<ModerationTab, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const refreshCounts = useCallback(() => {
    Promise.all([count(TAB_STATUS.pending), count(TAB_STATUS.approved), count(TAB_STATUS.rejected)])
      .then(([pending, approved, rejected]) => setCounts({ pending, approved, rejected }))
      // Fail-soft: a badge is a hint, and the list below reports its own load errors.
      .catch(() => {});
  }, [count]);

  // Returning from the detail screen, where a decision may just have been made.
  useFocusEffect(refreshCounts);
  // A decision made anywhere moves an item between tabs.
  useEffect(() => subscribeResource(resource, refreshCounts), [resource, refreshCounts]);

  const setOrder = useCallback(
    (next: SubmissionOrderValue) => setOrders((prev) => ({ ...prev, [activeTab]: next })),
    [activeTab]
  );

  return { ...list, activeTab, setActiveTab, order, setOrder, counts };
}
