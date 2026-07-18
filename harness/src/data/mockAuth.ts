/**
 * Deterministic mock auth. The public Coinbase endpoint we test against has no
 * usable production session in a fresh Expo app, so the "signed-in" scenario is
 * driven by a self-contained mock: any non-empty email+password signs the user
 * in and yields a FIXED balance/holdings snapshot. This keeps the signed-in
 * Home (balance shown) and the sign-in experience identical & reproducible
 * across all six data-layer variants. Live section/asset data stays REAL.
 */
export const MOCK_BALANCE_USD = 12873.42;
export const MOCK_CURRENCY = 'USD';

export function validateCredentials(email: string, password: string): boolean {
  return email.trim().length > 0 && password.length > 0;
}
