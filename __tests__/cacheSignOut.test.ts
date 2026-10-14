import { cacheKey, clearCache, fetchInto, peek } from '../services/cache';

// A request still running at sign-out was made with the previous account's token. It used to
// store its result after clearCache() had emptied the cache, so the next person to sign in on the
// device could be shown that account's rows (for any key not scoped by user id).
describe('cache across a sign-out', () => {
  afterEach(() => clearCache());

  it('drops a result that arrives after the cache was cleared', async () => {
    const key = cacheKey(['chat', 'conversations']);
    let resolve!: (rows: string[]) => void;
    const pending = fetchInto(key, () => new Promise<string[]>((r) => (resolve = r)));

    clearCache(); // sign-out
    resolve(['previous account thread']);
    await pending;

    expect(peek(key)).toBeUndefined();
  });

  it('a fetch started after the clear is stored as usual', async () => {
    const key = cacheKey(['chat', 'conversations']);
    clearCache();
    await fetchInto(key, async () => ['mine']);
    expect(peek<string[]>(key)?.data).toEqual(['mine']);
  });
});
