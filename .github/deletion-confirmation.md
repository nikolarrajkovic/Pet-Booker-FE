# Deletion Confirmation — Practice Guide

## Rule: Always Confirm Before Destructive Actions

Any action that **permanently removes data** (delete, deactivate, bulk-clear, etc.) **must be confirmed by the user** before it is executed. Never perform a destructive API call on a single tap.

---

## Why

- Accidental taps on touch screens are common — a single mis-tap should not lose data.
- Deletions are usually irreversible; the cost of an extra confirmation is near zero compared to the cost of unintended data loss.
- Gives the user a final chance to read what will be deleted (name, count, scope).

---

## Component: `ActionPopup` (`components/shared/ActionPopup.tsx`)

Use the shared `ActionPopup` component for all confirmations, warnings, and error dialogs. It works cross-platform (iOS, Android, Web) without any platform branching.

### Props

| Prop | Type | Description |
|---|---|---|
| `visible` | `boolean` | Controls whether the popup is shown |
| `mode` | `'confirmation' \| 'warning' \| 'error'` | Controls the color of the action button |
| `text` | `string` | Message body displayed in the popup |
| `buttonText` | `string` | Label for the action (right) button |
| `onConfirm` | `() => void` | Called when the action button is pressed |
| `onCancel` | `() => void` | Called when Cancel or the backdrop is pressed |

### Button colors by mode

| Mode | Action button color |
|---|---|
| `confirmation` | Green (`brand-500`) |
| `warning` | Orange |
| `error` | Red |

The **Cancel** button is always present on the left and uses a neutral style.

### Usage pattern

```tsx
import ActionPopup from '../../../components/shared/ActionPopup';

// State
const [pendingDeleteItem, setPendingDeleteItem] = useState<MyItem | null>(null);
const [deleteError, setDeleteError] = useState<string | null>(null);

// Trigger confirmation
const handleDelete = (item: MyItem) => setPendingDeleteItem(item);

// Execute after confirmation
const confirmDelete = async () => {
  if (!pendingDeleteItem) return;
  const item = pendingDeleteItem;
  setPendingDeleteItem(null);
  try {
    await deleteItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  } catch (err: any) {
    setDeleteError(err?.message ?? 'Failed to delete. Please try again.');
  }
};

// In JSX (inside the screen root, after the ScrollView)
<ActionPopup
  visible={!!pendingDeleteItem}
  mode="error"
  text={`Are you sure you want to delete ${pendingDeleteItem?.name ?? 'this item'}? This action cannot be undone.`}
  buttonText="Delete"
  onConfirm={confirmDelete}
  onCancel={() => setPendingDeleteItem(null)}
/>

<ActionPopup
  visible={!!deleteError}
  mode="error"
  text={deleteError ?? ''}
  buttonText="OK"
  onConfirm={() => setDeleteError(null)}
  onCancel={() => setDeleteError(null)}
/>
```

---

## Loading / In-Flight State

While the deletion request is in-flight:

1. Track which item is being deleted: `const [deletingId, setDeletingId] = useState<string | null>(null);`
2. Disable the delete control: `disabled={isDeleting}`
3. Replace the icon with a spinner so the user knows work is happening:

```tsx
{isDeleting
  ? <ActivityIndicator size="small" color="#EF4444" />
  : <Ionicons name="trash-outline" size={20} color="#EF4444" />}
```

4. On success: remove the item from local state immediately (optimistic removal).
5. On failure: show the `ActionPopup` in `error` mode with the error message.

---

## Checklist

- [ ] `ActionPopup` is used — not `Alert.alert` or `window.confirm`
- [ ] Popup body includes the item name and "cannot be undone"
- [ ] Cancel is always the left button
- [ ] Mode matches the severity (`error` for permanent deletion)
- [ ] Delete control is disabled while in-flight
- [ ] In-flight spinner replaces the delete icon
- [ ] Errors are surfaced in a follow-up `ActionPopup` (mode `error`, buttonText `OK`)
- [ ] No navigation happens automatically after deletion (stay on the list)

---

## Applies To

This rule applies to any screen or component that triggers a `DELETE` (or equivalent) HTTP request, including but not limited to:

| Screen | Entity |
|---|---|
| `MyPetsScreen` | Pet |
| `MyServicesScreen` | Service |
| `PromotionsScreen` | Promotion |
| `AdminPartnersScreen` | Partner |
| `NotificationsScreen` | Notification |

