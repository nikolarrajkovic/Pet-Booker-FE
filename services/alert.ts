import { Alert } from 'react-native';

/**
 * A dialog with a title, a message and up to a few buttons.
 *
 * On a phone this *is* `Alert.alert` — the platform dialog is the right control there, and this
 * module exists only so the web build can substitute its own. See `alert.web.ts`.
 */
export const showAlert = Alert.alert;
