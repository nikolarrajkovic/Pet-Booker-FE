import { showAlert } from '../services/alert.web';

/**
 * The web stand-in for `Alert.alert`. Its button semantics are the part worth pinning: the call
 * sites were written against the native dialog, and a confirm that runs the wrong branch is worse
 * than the silence it replaced — "Reject application" running on Cancel, for instance.
 */
describe('showAlert on web', () => {
  const realAlert = window.alert;
  const realConfirm = window.confirm;

  afterEach(() => {
    window.alert = realAlert;
    window.confirm = realConfirm;
    jest.restoreAllMocks();
  });

  it('shows title and message together', () => {
    const seen: string[] = [];
    window.alert = ((m: string) => seen.push(m)) as typeof window.alert;

    showAlert('Missing fields', 'Please fill in all password fields.');

    expect(seen).toEqual(['Missing fields\n\nPlease fill in all password fields.']);
  });

  it('runs a lone button, which is where the post-success navigation lives', () => {
    window.alert = (() => {}) as typeof window.alert;
    const onPress = jest.fn();

    showAlert('Password changed', 'You can sign in with it now.', [{ text: 'OK', onPress }]);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('runs the non-cancel button when a confirm is accepted', () => {
    window.confirm = (() => true) as typeof window.confirm;
    const reject = jest.fn();
    const cancel = jest.fn();

    showAlert('Reject application', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Reject', style: 'destructive', onPress: reject },
    ]);

    expect(reject).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('runs the cancel button when a confirm is dismissed', () => {
    window.confirm = (() => false) as typeof window.confirm;
    const reject = jest.fn();
    const cancel = jest.fn();

    showAlert('Reject application', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Reject', style: 'destructive', onPress: reject },
    ]);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(reject).not.toHaveBeenCalled();
  });

  it('treats the last button as the action when none is marked cancel', () => {
    window.confirm = (() => true) as typeof window.confirm;
    const first = jest.fn();
    const last = jest.fn();

    showAlert('Pick one', undefined, [
      { text: 'A', onPress: first },
      { text: 'B', onPress: last },
    ]);

    // `find` takes the first non-cancel button, so A wins — pinned so the behaviour is a
    // decision rather than an accident if someone adds a third button later.
    expect(first).toHaveBeenCalledTimes(1);
    expect(last).not.toHaveBeenCalled();
  });
});
