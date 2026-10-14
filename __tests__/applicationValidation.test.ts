import {
  applicationStepErrors,
  firstIncompleteStep,
  type ApplicationForm,
} from '../screens/partner-application-screen/applicationValidation';

// The partner application marked nine things required and checked none: Continue walked through
// all three steps empty, and the only rule the server has (a name) failed on step 3.
const empty: ApplicationForm = {
  fullName: '',
  email: '',
  phone: '+381',
  streetAddress: '',
  city: '',
  zipCode: '',
  serviceType: null,
  yearsOfExperience: '',
  aboutYou: '',
  motivation: '',
};
const complete: ApplicationForm = {
  fullName: 'Stefan Ilić',
  email: 'stefan@example.com',
  phone: '+381 64 123 4567',
  streetAddress: 'Nemanjina 4',
  city: 'Belgrade',
  zipCode: '11000',
  serviceType: 1,
  yearsOfExperience: '4 years',
  aboutYou: 'I walk dogs.',
  motivation: 'I love dogs.',
};
const docs = { addressRequired: true, profilePhoto: 'data:x', governmentIdFront: 'data:y' };

describe('partner application validation', () => {
  it('names every required field of an empty step', () => {
    expect(Object.keys(applicationStepErrors(1, empty, docs)).sort()).toEqual(
      ['city', 'email', 'fullName', 'phone', 'streetAddress', 'zipCode'].sort()
    );
    expect(Object.keys(applicationStepErrors(2, empty, docs)).sort()).toEqual(
      ['aboutYou', 'motivation', 'serviceType', 'yearsOfExperience'].sort()
    );
    expect(
      Object.keys(
        applicationStepErrors(3, empty, { ...docs, profilePhoto: null, governmentIdFront: null })
      ).sort()
    ).toEqual(['governmentIdFront', 'profilePhoto']);
  });

  it('treats a bare dial code as no phone and a short number as invalid', () => {
    expect(applicationStepErrors(1, { ...complete, phone: '+381' }, docs).phone).toBe(
      'partnerApplication.fieldRequired'
    );
    expect(applicationStepErrors(1, { ...complete, phone: '+381 64' }, docs).phone).toBe(
      'register.errPhoneInvalid'
    );
    expect(applicationStepErrors(1, { ...complete, email: 'stefan@' }, docs).email).toBe(
      'register.errEmailInvalid'
    );
  });

  it('leaves the address optional when the account has one to fall back on', () => {
    const noAddress = { ...complete, streetAddress: '', city: '', zipCode: '' };
    expect(applicationStepErrors(1, noAddress, { ...docs, addressRequired: false })).toEqual({});
    expect(Object.keys(applicationStepErrors(1, noAddress, docs))).toHaveLength(3);
  });

  it('finds the first incomplete step, or none', () => {
    expect(firstIncompleteStep(complete, docs)).toBeNull();
    expect(firstIncompleteStep({ ...complete, motivation: ' ' }, docs)).toBe(2);
    expect(firstIncompleteStep(complete, { ...docs, governmentIdFront: null })).toBe(3);
  });
});
