import { useEffect, useMemo, useState } from 'react';
import type { ServiceSearchItem } from '../search-screen/components/ListView';

const providerOf = (item: ServiceSearchItem) => item.dto.serviceProviderId ?? 0;

/**
 * Who a group request goes to: providers ticked one by one, or "every matching provider" —
 * minus any the owner unticks.
 *
 * A browse row is a service, but a request names providers: hand-picking keeps the service each
 * provider was picked from (it is preselected when they accept), while a row unticked under
 * "every matching" leaves its whole provider out. Turning "every matching" on starts from
 * everyone, as any "select all" does; changing the service type clears both, because a groomer
 * picked for a walk is not a walker.
 */
export function useProviderSelection(serviceType: number | null) {
  const [anyMatching, setAnyMatching] = useState(false);
  /** serviceId → the pick. */
  const [picked, setPicked] = useState<Map<number, ServiceSearchItem>>(new Map());
  /** serviceProviderIds left out of "every matching provider". */
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setPicked(new Map());
    setExcluded(new Set());
  }, [serviceType]);

  const toggleAnyMatching = () => {
    if (!anyMatching) setExcluded(new Set());
    setAnyMatching(!anyMatching);
  };

  const isTicked = (item: ServiceSearchItem) =>
    anyMatching ? !excluded.has(providerOf(item)) : picked.has(item.id);

  const toggle = (item: ServiceSearchItem) => {
    if (anyMatching) {
      setExcluded((prev) => {
        const next = new Set(prev);
        const id = providerOf(item);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setPicked((prev) => {
        const next = new Map(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.set(item.id, item);
        return next;
      });
    }
  };

  const pickedProviderCount = useMemo(
    () => new Set([...picked.values()].map(providerOf)).size,
    [picked]
  );

  return {
    anyMatching,
    toggleAnyMatching,
    isTicked,
    toggle,
    pickedProviderCount,
    excludedCount: excluded.size,
    /** The request body's audience half. */
    excludedProviderIds: anyMatching ? [...excluded] : [],
    providers: anyMatching
      ? []
      : [...picked.values()].map((p) => ({ serviceProviderId: providerOf(p), serviceId: p.id })),
  };
}
