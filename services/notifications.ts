import { apiJson, apiList } from './http';

export type UserNotificationSettingsDto = {
  id?: number | null;
  userId: number;
  // Push and email are the only two opt-outs. The per-category toggles (booking updates,
  // reminders, messages) and the SMS channel were removed server-side: everything the app
  // dispatches is transactional, and SMS had no sender behind it.
  pushEnabled: boolean;
  emailEnabled: boolean;
  dndEnabled: boolean;
  dndStartTime: string; // "HH:MM:SS"
  dndEndTime: string; // "HH:MM:SS"
  // IANA zone the quiet-hours window is read in. The window is stored as wall-clock times, so
  // this is what makes 22:00 mean 22:00 where the user is — sending 'UTC' from a CEST device
  // moved the whole window two hours.
  timezone?: string | null;
  // ISO 639-1 language for emails/pushes sent outside a request context (server default 'en').
  preferredLanguage?: string | null;
  // Display-currency preference (server-validated against RSD/EUR/USD, default 'RSD').
  // Payments are always made and shown in RSD for now — no conversion happens yet.
  preferredCurrency?: string | null;
};

/**
 * The device's own IANA zone, e.g. "Europe/Belgrade". Falls back to UTC on the rare runtime that
 * reports nothing — the server rejects an unresolvable id, so a bad guess must not be sent.
 */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Defaults used when the user has no settings record yet. These MUST match the server's own
 * fallback (`new UserNotificationSettings()`), which is what actually governs delivery until the
 * first save: showing push as off while the server treated it as on made the screen describe a
 * state that did not exist.
 */
export function defaultNotificationSettings(userId: number): UserNotificationSettingsDto {
  return {
    userId,
    pushEnabled: true,
    emailEnabled: true,
    dndEnabled: false,
    dndStartTime: '22:00:00',
    dndEndTime: '08:00:00',
    timezone: deviceTimezone(),
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
