import { apiJson, apiList } from './http';

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
  // ISO 639-1 language for emails/pushes sent outside a request context (server default 'en').
  preferredLanguage?: string | null;
  // Display-currency preference (server-validated against RSD/EUR/USD, default 'RSD').
  // Payments are always made and shown in RSD for now — no conversion happens yet.
  preferredCurrency?: string | null;
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
    preferredCurrency: 'RSD',
  };
}

/** Returns the user's notification settings record, or null if none exists. */
export async function getNotificationSettings(
  userId: number
): Promise<UserNotificationSettingsDto | null> {
  const items = await apiList<UserNotificationSettingsDto>('/api/user-notification-settings', {
    query: { UserId: userId, Page: 1, PerPage: 1 },
    fallback: 'Failed to load notification settings.',
    context: 'getNotificationSettings',
  });
  return items[0] ?? null;
}

/** Creates (no id) or updates (with id) the user's notification settings. */
export function saveNotificationSettings(
  settings: UserNotificationSettingsDto
): Promise<UserNotificationSettingsDto> {
  const isUpdate = settings.id != null && settings.id > 0;

  return apiJson<UserNotificationSettingsDto>(
    isUpdate ? `/api/user-notification-settings/${settings.id}` : '/api/user-notification-settings',
    {
      method: isUpdate ? 'PUT' : 'POST',
      body: isUpdate ? settings : { ...settings, id: 0 },
      fallback: 'Failed to save notification settings.',
      context: 'saveNotificationSettings',
    }
  );
}
