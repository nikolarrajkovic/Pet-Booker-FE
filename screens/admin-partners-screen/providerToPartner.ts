import {
  ModerationStatus,
  providerAddress,
  providerTypeLabel,
  resolveImageUrl,
  type ModerationStatusValue,
  type ServiceProviderDto,
} from '../../services/service-providers';
import type { Partner, PartnerStatus } from './components';
import { formatMonthYear } from '../../i18n/dates';

// Maps a raw ServiceProviderDto into the Partner card/detail view shape.
// The starting price and recent bookings are not on the list row; Partner Details loads them.

/** The server's moderation status (derived from dates, so an expired timeout is Active). */
export function partnerStatusOf(status?: ModerationStatusValue | null): PartnerStatus {
  if (status === ModerationStatus.Banned) return 'banned';
  if (status === ModerationStatus.TimedOut) return 'timeout';
  return 'active';
}

/** Per-provider tallies the provider list itself doesn't carry. */
export type ProviderTallies = { services: number; reviews: number };

export function providerToPartner(dto: ServiceProviderDto, tallies?: ProviderTallies): Partner {
  const photos = dto.photos ?? [];
  const profilePhoto = photos.find((p) => p.isSelected) ?? photos[0];
  const created = dto.createdAt ? new Date(dto.createdAt) : null;
  // The business address, else the partner's account address.
  const addr = providerAddress(dto);
  const address = addr
    ? [addr.line1, addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')
    : '';
  const rating = dto.ratingAvg ?? 0;

  return {
    id: String(dto.id ?? 0),
    name: dto.name ?? 'Unknown Provider',
    image: resolveImageUrl(profilePhoto?.src),
    status: partnerStatusOf(dto.moderationStatus),
    rating,
    // Counted from the catalogue/review lists fetched alongside the providers. Both used to be
    // hardcoded 0, so every partner in this list read "0 services · (0)" no matter how many they
    // actually had — next to a real star rating, which made the rating look broken too.
    reviews: tallies?.reviews ?? 0,
    totalServices: tallies?.services ?? 0,
    services: [providerTypeLabel(dto.type)],
    distance: addr?.city ?? '',
    joinedDate: created ? formatMonthYear(created) : '',
    email: dto.contactEmail ?? '',
    // An admin reads these (the API withholds the phone from everyone else).
    phone: dto.contactPhone ?? '',
    address,
    bio: dto.about ?? '',
    currency: dto.currency,
    avgRating: rating,
    moderationReason: dto.moderationReason ?? null,
    timedOutUntil: dto.timedOutUntil ?? null,
    bannedAt: dto.bannedAt ?? null,
    documents: {
      profilePhoto: !!profilePhoto?.src,
      // List rows never carry the ID images; the server counts them for an admin instead.
      governmentId:
        (dto.governmentIdPhotoCount ?? (dto.governmentIdPhotos ?? []).filter((p) => p.src).length) >
        0,
      insuranceCertificate: (dto.certificates ?? []).some((c) => (c.files ?? []).length > 0),
    },
  };
}
