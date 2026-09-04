import { renderHook } from '@testing-library/react-native';
import { useShowOnce, resetShownOnce } from '../../hooks/useShowOnce';

/**
 * "Show this once per app session."
 *
 * The whole value of the Home welcome card is that it greets you and then stops. Getting this
 * wrong is quiet in both directions: always-true makes it permanent clutter, always-false means
 * nobody ever sees it and the component looks broken rather than suppressed.
 */

afterEach(() => resetShownOnce());

describe('useShowOnce', () => {
  it('is true on first mount and false on every mount after', () => {
    expect(renderHook(() => useShowOnce('home-welcome')).result.current).toBe(true);
    expect(renderHook(() => useShowOnce('home-welcome')).result.current).toBe(false);
    expect(renderHook(() => useShowOnce('home-welcome')).result.current).toBe(false);
  });

  it('stays true across re-renders of the same mount', () => {
    // The banner must not vanish under the user because something above it re-rendered.
    const { result, rerender } = renderHook(() => useShowOnce('home-welcome'));
    expect(result.current).toBe(true);

    rerender(undefined);
    rerender(undefined);
    expect(result.current).toBe(true);
  });

  it('tracks each key separately', () => {
    expect(renderHook(() => useShowOnce('a')).result.current).toBe(true);
    // A second banner elsewhere must not be suppressed by the first one having shown.
    expect(renderHook(() => useShowOnce('b')).result.current).toBe(true);
    expect(renderHook(() => useShowOnce('a')).result.current).toBe(false);
  });

  it('forgets everything on reset, so the next account gets its own greeting', () => {
    // This is also what makes the flag session-scoped rather than persisted: the state lives in
    // memory, so a reload starts over and a welcome greets you each time you open the app rather
    // than once in your lifetime. Moving it to storage would mean changing this test.

    expect(renderHook(() => useShowOnce('home-welcome')).result.current).toBe(true);
    expect(renderHook(() => useShowOnce('home-welcome')).result.current).toBe(false);

    resetShownOnce();

    expect(renderHook(() => useShowOnce('home-welcome')).result.current).toBe(true);
  });
});
