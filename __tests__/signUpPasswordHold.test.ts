import { forgetSignUpPassword, heldSignUpPassword, holdSignUpPassword } from '../services/auth';

// Confirming an email needs the sign-up's password (review 2026-11-02, finding 1). The screens
// hold it in memory between typing it and typing the code.
describe('the sign-up password hold', () => {
  afterEach(() => forgetSignUpPassword());

  it('offers the password for the email it was typed with, in any case', () => {
    holdSignUpPassword(' Ana@Example.com ', 'Secret1!');
    expect(heldSignUpPassword('ana@example.com')).toBe('Secret1!');
    expect(heldSignUpPassword('someone@example.com')).toBe('');
  });

  it('offers a password typed with a username for whichever email the screen is told', () => {
    holdSignUpPassword('', 'Secret1!');
    expect(heldSignUpPassword('ana@example.com')).toBe('Secret1!');
  });

  it('holds nothing once forgotten', () => {
    holdSignUpPassword('ana@example.com', 'Secret1!');
    forgetSignUpPassword();
    expect(heldSignUpPassword('ana@example.com')).toBe('');
  });
});
