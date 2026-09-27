import {
  providerTypeLabel,
  resolveImageUrl,
  type ServiceProviderDto,
} from '../../services/service-providers';
import type { Partner } from './components';

// Maps a raw ServiceProviderDto into the Partner card/detail view shape.
// The backend has no timeout/ban moderation concept, so every provider maps to
// 'active'; the admin can still timeout/ban in-session (kept as local overrides).
// Fields not exposed at the list level (reviews count, total services, phone,
// bio, starting price) default to 0/'' until the API provides them.
/** Per-provider tallies the provider list itself doesn't carry. */
export type ProviderTallies = { services: number; reviews: number };

export function providerToPartner(dto: ServiceProviderDto, tallies?: ProviderTallies): Partner {
  const photos = dto.photos ?? [];
  const profilePhoto = photos.find((p) => p.isSelected) ?? photos[0];
  const created = dto.createdAt ? new Date(dto.createdAt) : null;
  const addr = dto.address;
  const address = addr
    ? [addr.line1, addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')
    : '';
  const rating = dto.ratingAvg ?? 0;

  return {
    id: String(dto.id ?? 0),
    name: dto.name ?? 'Unknown Provider',
    image: resolveImageUrl(profilePhoto?.src),
    status: 'active',
    rating,
    // Counted from the catalogue/review lists fetched alongside the providers. Both used to be
    // hardcoded 0, so every partner in this list read "0 services · (0)" no matter how many they
    // actually had — next to a real star rating, which made the rating look broken too.
    reviews: tallies?.reviews ?? 0,
    totalServices: tallies?.services ?? 0,
    services: [providerTypeLabel(dto.type)],
    distance: addr?.city ?? '',
    joinedDate: created
      ? created.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : '',
    email: dto.contactEmail ?? '',
    phone: '',
    address,
    bio: '',
    startingPrice: 0,
    currency: dto.currency,
    avgRating: rating,
    documents: {
      profilePhoto: !!profilePhoto?.src,
      governmentId: (dto.governmentIdPhotos ?? []).some((p) => p.src),
      insuranceCertificate: (dto.certificates ?? []).some((c) => (c.files ?? []).length > 0),
    },
    serviceHistory: [],
  };
}
