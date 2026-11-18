import { apiJson, apiList, apiRequest } from './http';

/**
 * Days a partner's whole business is closed (backend `ProviderTimeOff`, decided 2026-11-18): no
 * bookings on any of their services, closed in the booking calendar, out of the day filter and the
 * group requests. Bookings already in those days stay, for the partner to decline. Both days are
 * included; dates are "YYYY-MM-DD". The note is the partner's own.
 */
export type TimeOffDto = {
  id?: number | null;
  serviceProviderId: number;
  from: string;
  to: string;
  note?: string | null;
  createdAt?: string | null;
};

/** The partner's own time off that hasn't ended (today on), soonest first. */
export function getTimeOff(endsFrom: string): Promise<TimeOffDto[]> {
  return apiList<TimeOffDto>('/api/provider-time-offs', {
    query: { EndsFrom: endsFrom, Page: 1, PerPage: 200 },
    fallback: 'Failed to load your time off.',
    context: 'getTimeOff',
  });
}

export function createTimeOff(input: TimeOffDto): Promise<TimeOffDto> {
  return apiJson<TimeOffDto>('/api/provider-time-offs', {
    method: 'POST',
    body: input,
    fallback: 'Failed to save the time off.',
    context: 'createTimeOff',
  });
}

export async function deleteTimeOff(id: number): Promise<void> {
  await apiRequest(`/api/provider-time-offs/${id}`, {
    method: 'DELETE',
    fallback: 'Failed to remove the time off.',
    context: 'deleteTimeOff',
  });
}
