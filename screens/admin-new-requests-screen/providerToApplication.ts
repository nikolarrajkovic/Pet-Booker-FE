import {
  providerTypeLabel,
  extractProviderDocuments,
  ApprovalStatus,
  type ServiceProviderDto,
} from '../../services/service-providers';
import type { PartnerApplication } from './components';

// Maps a raw ServiceProviderDto (a partner application) to the card's view shape.
// Note: the provider DTO does not carry phone/bio/experience/availability —
// those are blank until the backend exposes them.
export function providerToApplication(dto: ServiceProviderDto): PartnerApplication {
  const created = dto.createdAt ? new Date(dto.createdAt) : null;
  const addr = dto.address;
  const address = addr
    ? [addr.line1, addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')
    : '';

  const documents = extractProviderDocuments(dto);

  return {
    id: String(dto.id ?? 0),
    providerId: dto.id ?? 0,
    applicantName: dto.name ?? 'Applicant',
    submittedDate: created
      ? created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '',
    submittedTime: created
      ? created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
      : '',
    services: [providerTypeLabel(dto.type)],
    status:
      dto.approvalStatus === ApprovalStatus.Declined
        ? 'rejected'
        : dto.approvalStatus === ApprovalStatus.Approved || dto.isApproved
          ? 'approved'
          : 'pending',
    email: dto.contactEmail ?? '',
    phone: '',
    address,
    experience: '',
    bio: '',
    certifications: (dto.certificates ?? [])
      .map((c) => c.name)
      .filter(Boolean)
      .join(', '),
    availability: '',
    documents,
    certificateIds: (dto.certificates ?? []).map((c) => c.id).filter((x): x is number => x != null),
  };
}
