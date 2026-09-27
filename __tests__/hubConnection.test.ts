import type { HubConnection } from '@microsoft/signalr';
import { hubRetryPolicy, startHubConnection } from '../services/hub-connection';

/**
 * The live channels (chat, notifications) must come back on their own, whatever went wrong.
 *
 * Both failure modes here were silent: REST kept working, so the app looked fine and simply
 * stopped being live until the user reloaded — a first connect that failed was never retried,
 * and a reconnect gave up for good after ~47s without the API (a redeploy is longer than that).
 */

const connectionThatFails = (failures: number) => {
  let calls = 0;
  const start = jest.fn(() => {
    calls++;
    return calls <= failures ? Promise.reject(new Error('negotiate failed')) : Promise.resolve();
  });
  return { connection: { start } as unknown as HubConnection, start };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('startHubConnection', () => {
  it('connects on the first attempt without waiting', async () => {
    const { connection, start } = connectionThatFails(0);
    await expect(startHubConnection(connection, () => false, 'test')).resolves.toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('retries a failed first connect until it goes through, and says how many failed', async () => {
    const { connection, start } = connectionThatFails(3);
    const result = startHubConnection(connection, () => false, 'test');

    await jest.advanceTimersByTimeAsync(60_000);

    await expect(result).resolves.toBe(3);
    expect(start).toHaveBeenCalledTimes(4);
  });

  it('stops retrying once its owner has gone', async () => {
    const { connection, start } = connectionThatFails(Infinity);
    let cancelled = false;
    const result = startHubConnection(connection, () => cancelled, 'test');

    await jest.advanceTimersByTimeAsync(1_000);
    cancelled = true;
    await jest.advanceTimersByTimeAsync(60_000);

    await expect(result).resolves.toBeNull();
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('hubRetryPolicy', () => {
  it('never gives up on a reconnect', () => {
    for (const previousRetryCount of [0, 1, 4, 5, 50, 10_000]) {
      const delay = hubRetryPolicy.nextRetryDelayInMilliseconds({
        previousRetryCount,
        elapsedMilliseconds: previousRetryCount * 30_000,
        retryReason: new Error('gone'),
      });
      // `null` is SignalR's "stop reconnecting".
      expect(delay).not.toBeNull();
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });
});
