/**
 * What each step of the partner application still needs before Continue moves on.
 *
 * The form marked full name, email, phone, address, experience, about, motivation, a profile
 * photo and a government ID as required, and checked none of them: Continue advanced through all
 * three steps empty, and the server's only rule (a name) came back on step 3 as "'Name' must not
 * be empty." With a name typed, an application went to the admin with no ID to verify.
 *
 * Returns field → i18n key of the message to show under it; an empty object means the step is
 * complete. Pure, so the rules are testable without rendering the screen.
 */
export type ApplicationField =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'streetAddress'
  | 'city'
  | 'zipCode'
  | 'serviceType'
  | 'yearsOfExperience'
  | 'aboutYou'
  | 'motivation'
  | 'profilePhoto'
  | 'governmentIdFront';

export type ApplicationErrors = Partial<Record<ApplicationField, string>>;

export type ApplicationForm = {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  zipCode: string;
  serviceType: number | null;
  yearsOfExperience: string;
  aboutYou: string;
  motivation: string;
};

export type ApplicationExtras = {
  /** No account address to fall back on, so the business address places the partner. */
  addressRequired: boolean;
  profilePhoto: string | null;
  governmentIdFront: string | null;
};

const REQUIRED = 'partnerApplication.fieldRequired';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The phone field always carries its dial code ("+381"), so "empty" means no national digits. */
function phoneError(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return REQUIRED;
  return digits.length < 8 || digits.length > 15 ? 'register.errPhoneInvalid' : undefined;
}

export function applicationStepErrors(
  step: number,
  form: ApplicationForm,
  extras: ApplicationExtras
): ApplicationErrors {
  const errors: ApplicationErrors = {};
  const blank = (v: string) => v.trim() === '';

  if (step === 1) {
    if (blank(form.fullName)) errors.fullName = REQUIRED;
    if (blank(form.email)) errors.email = REQUIRED;
    else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'register.errEmailInvalid';
    const phone = phoneError(form.phone);
    if (phone) errors.phone = phone;
    if (extras.addressRequired) {
      if (blank(form.streetAddress)) errors.streetAddress = REQUIRED;
      if (blank(form.city)) errors.city = REQUIRED;
      if (blank(form.zipCode)) errors.zipCode = REQUIRED;
    }
  } else if (step === 2) {
    if (form.serviceType === null) errors.serviceType = 'partnerApplication.serviceTypeRequired';
    if (!/\d/.test(form.yearsOfExperience)) errors.yearsOfExperience = REQUIRED;
    if (blank(form.aboutYou)) errors.aboutYou = REQUIRED;
    if (blank(form.motivation)) errors.motivation = REQUIRED;
  } else if (step === 3) {
    if (!extras.profilePhoto) errors.profilePhoto = REQUIRED;
    if (!extras.governmentIdFront) errors.governmentIdFront = REQUIRED;
  }
  return errors;
}

/** The first step (1–3) with something missing, or null when the application is complete. */
export function firstIncompleteStep(form: ApplicationForm, extras: ApplicationExtras) {
  for (const step of [1, 2, 3]) {
    if (Object.keys(applicationStepErrors(step, form, extras)).length > 0) return step;
  }
  return null;
}
