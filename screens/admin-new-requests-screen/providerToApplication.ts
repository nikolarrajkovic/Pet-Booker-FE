import {
  providerTypeLabel,
  extractProviderDocuments,
  ApprovalStatus,
  type ServiceProviderDto,
} from '../../services/service-providers';
import type { PartnerApplication } from './components';
import { formatShortDate } from '../../i18n/dates';

// Maps a raw ServiceProviderDto (a partner application) to the card's view shape. Phone and
// motivation come back only for an admin (or the applicant); ID images only from find-by-id, so
// list rows rely on the server's governmentIdPhotoCount.
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
    submittedDate: created ? formatShortDate(created) : '',
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
    phone: dto.contactPhone ?? '',
    address,
    yearsOfExperience: dto.yearsOfExperience ?? null,
    bio: dto.about ?? '',
    motivation: dto.motivation ?? '',
    certifications: (dto.certificates ?? [])
      .map((c) => c.name)
      .filter(Boolean)
      .join(', '),
    documents,
    governmentIdCount:
      dto.governmentIdPhotoCount ??
      (documents.governmentIdFront ? 1 : 0) + (documents.governmentIdBack ? 1 : 0),
    certificateIds: (dto.certificates ?? []).map((c) => c.id).filter((x): x is number => x != null),
  };
}
