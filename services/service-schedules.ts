import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import { ServiceScheduleDto } from './services';

// Per-day working hours for a service. `day` is .NET DayOfWeek (0=Sun…6=Sat),
// `from`/`to` are "HH:mm:ss" times. The same shape is embedded on the service
// GET as `service.schedules[]`, so reads usually come from there — this module
// owns the writes (create/update/delete) used to persist the AddEditService
// "Working Hours" section.
export type { ServiceScheduleDto };

export async function getServiceSchedules(serviceId: number): Promise<ServiceScheduleDto[]> {
  const query = new URLSearchParams();
  query.set('ServiceId', String(serviceId));
  query.set('PerPage', '50');
  const url = `${getApiBaseUrl()}/api/service-schedules?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load working hours.', 'getServiceSchedules')
    );
  }

  const raw = await response.json();
  return extractPageItems<ServiceScheduleDto>(raw);
}

export async function createServiceSchedule(
  schedule: ServiceScheduleDto
): Promise<ServiceScheduleDto> {
  const url = `${getApiBaseUrl()}/api/service-schedules`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(schedule),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to save working hours.', 'createServiceSchedule')
    );
  }

  return response.json();
}

export async function updateServiceSchedule(
  id: number,
  schedule: ServiceScheduleDto
): Promise<ServiceScheduleDto> {
  const url = `${getApiBaseUrl()}/api/service-schedules/${id}`;
  const response = await apiAuthFetch(url, {
    method: 'PUT',
    body: JSON.stringify({ ...schedule, id }),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to update working hours.', 'updateServiceSchedule')
    );
  }

  return response.json();
}

export async function deleteServiceSchedule(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-schedules/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to remove working hours.', 'deleteServiceSchedule')
    );
  }
}

/**
 * Reconciles a service's per-day schedules to match `desired` (one entry per
 * enabled day). Diffs against `existing` (the schedules already on the service,
 * e.g. `service.schedules` from the GET) keyed by `day`:
 *   - day present in both, times differ → PUT
 *   - day only in desired                → POST
 *   - day only in existing               → DELETE
 * Unchanged days make no request. Any accidental duplicate rows for a day are
 * collapsed to one. Runs the resulting calls in parallel.
 */
export async function saveServiceSchedules(
  serviceId: number,
  desired: ServiceScheduleDto[],
  existing: ServiceScheduleDto[] = []
): Promise<void> {
  const desiredByDay = new Map<number, ServiceScheduleDto>();
  for (const s of desired) desiredByDay.set(s.day, s);

  const existingByDay = new Map<number, ServiceScheduleDto[]>();
  for (const s of existing) {
    const list = existingByDay.get(s.day) ?? [];
    list.push(s);
    existingByDay.set(s.day, list);
  }

  const ops: Promise<unknown>[] = [];
  const days = new Set<number>([...desiredByDay.keys(), ...existingByDay.keys()]);

  for (const day of days) {
    const want = desiredByDay.get(day);
    const have = existingByDay.get(day) ?? [];

    if (want && have.length === 0) {
      ops.push(createServiceSchedule({ ...want, serviceId }));
    } else if (want && have.length > 0) {
      const [first, ...extras] = have;
      if (first.id != null && (first.from !== want.from || first.to !== want.to)) {
        ops.push(updateServiceSchedule(first.id, { ...want, serviceId, id: first.id }));
      }
      // Collapse any accidental duplicate rows for the same day.
      for (const dup of extras) if (dup.id != null) ops.push(deleteServiceSchedule(dup.id));
    } else if (!want) {
      for (const h of have) if (h.id != null) ops.push(deleteServiceSchedule(h.id));
    }
  }

  await Promise.all(ops);
}
