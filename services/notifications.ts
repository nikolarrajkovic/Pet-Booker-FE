import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

export type UserNotificationSettingsDto = {
  id?: number | null;
  userId: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  bookingUpdates: boolean;
  appointmentReminders: boolean;
  messages: boolean;
  promotionsOffers: boolean;
  newServices: boolean;
  dndEnabled: boolean;
  dndStartTime: string; // "HH:MM:SS"
  dndEndTime: string; // "HH:MM:SS"
  timezone?: string | null;
};

/** Sensible defaults used when the user has no settings record yet. */
export function defaultNotificationSettings(userId: number): UserNotificationSettingsDto {
  return {
    userId,
    pushEnabled: false,
    emailEnabled: true,
    smsEnabled: false,
    bookingUpdates: true,
    appointmentReminders: true,
    messages: true,
    promotionsOffers: false,
    newServices: false,
    dndEnabled: false,
    dndStartTime: '22:00:00',
    dndEndTime: '08:00:00',
    timezone: 'UTC',
  };
}

/** Returns the user's notification settings record, or null if none exists. */
export async function getNotificationSettings(
  userId: number
): Promise<UserNotificationSettingsDto | null> {
  const url = `${getApiBaseUrl()}/api/user-notification-settings?UserId=${userId}&Page=1&PerPage=1`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        'Failed to load notification settings.',
        'getNotificationSettings'
      )
    );
  }

  const raw = await response.json();
  return extractPageItems<UserNotificationSettingsDto>(raw)[0] ?? null;
}

/** Creates (no id) or updates (with id) the user's notification settings. */
export async function saveNotificationSettings(
  settings: UserNotificationSettingsDto
): Promise<UserNotificationSettingsDto> {
  const base = getApiBaseUrl();
  const isUpdate = settings.id != null && settings.id > 0;
  const url = isUpdate
    ? `${base}/api/user-notification-settings/${settings.id}`
    : `${base}/api/user-notification-settings`;
  const body = isUpdate ? settings : { ...settings, id: 0 };

  const response = await apiAuthFetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        'Failed to save notification settings.',
        'saveNotificationSettings'
      )
    );
  }

  return response.json();
}
