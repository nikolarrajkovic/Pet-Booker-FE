import { apiJson, apiList, apiVoid } from './http';
import { ServiceScheduleDto } from './services';

// Per-day working hours for a service. `day` is .NET DayOfWeek (0=Sun…6=Sat),
// `from`/`to` are "HH:mm:ss" times. The same shape is embedded on the service
// GET as `service.schedules[]`, so reads usually come from there — this module
// owns the writes (create/update/delete) used to persist the AddEditService
// "Working Hours" section.
export type { ServiceScheduleDto };

export function getServiceSchedules(serviceId: number): Promise<ServiceScheduleDto[]> {
  return apiList<ServiceScheduleDto>('/api/service-schedules', {
    query: { ServiceId: serviceId, PerPage: 50 },
    fallback: 'Failed to load working hours.',
    context: 'getServiceSchedules',
  });
}

export function createServiceSchedule(schedule: ServiceScheduleDto): Promise<ServiceScheduleDto> {
  return apiJson<ServiceScheduleDto>('/api/service-schedules', {
    method: 'POST',
    body: schedule,
    fallback: 'Failed to save working hours.',
    context: 'createServiceSchedule',
  });
}

export function updateServiceSchedule(
  id: number,
  schedule: ServiceScheduleDto
): Promise<ServiceScheduleDto> {
  return apiJson<ServiceScheduleDto>(`/api/service-schedules/${id}`, {
    method: 'PUT',
    body: { ...schedule, id },
    fallback: 'Failed to update working hours.',
    context: 'updateServiceSchedule',
  });
}

export function deleteServiceSchedule(id: number): Promise<void> {
  return apiVoid(`/api/service-schedules/${id}`, {
    method: 'DELETE',
    fallback: 'Failed to remove working hours.',
    context: 'deleteServiceSchedule',
  });
}

/**
 * Removes every one of a service's working-hour windows.
 *
 * The only schedule change the service write cannot express: a non-empty `schedules` array on
 * the POST/PUT replaces the stored windows wholesale, but an **empty** one means "leave them
 * untouched" (the Photos convention), so a provider switching every day off would otherwise
 * keep the hours they just cleared. Everything else — adding, retiming, dropping a single day —
 * rides along with the service in its own request; don't reintroduce a per-day reconciler.
 *
 * Pass the schedules already on the service (`service.schedules` from the GET). Rows with no
 * id are skipped: they were never persisted.
 */
export async function clearServiceSchedules(existing: ServiceScheduleDto[]): Promise<void> {
  await Promise.all(
    existing.filter((s) => s.id != null).map((s) => deleteServiceSchedule(s.id!))
  );
}
