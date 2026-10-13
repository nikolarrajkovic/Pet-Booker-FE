/**
 * Reading claims out of a JWT without verifying it — for client-side bookkeeping only (when a token
 * expires, how old it is). The server verifies every token it is sent; nothing here is trusted for
 * authorization.
 */
/** How long ago `token` was issued (its JWT `iat`), or Infinity when it can't be read. */
export function tokenAgeMs(token: string): number {
  const issuedAt = jwtClaim(token, 'iat');
  return issuedAt ? Date.now() - issuedAt * 1000 : Number.POSITIVE_INFINITY;
}

/** A numeric claim (`exp`, `iat`) from a JWT's payload, or null. Never throws. */
export function jwtClaim(token: string, claim: 'exp' | 'iat'): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof atob !== 'function') return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(
      atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    );
    const value = json?.[claim];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
