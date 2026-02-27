/**
 * Local shielded balance tracker via localStorage.
 *
 * On devnet the simplified ElGamal decryption returns garbage values,
 * so we track shield/unshield operations locally to maintain an accurate
 * client-side balance for circuit witnesses.
 *
 * Stored as a raw bigint string (1e18 scale) keyed by wallet address.
 */

const STORAGE_KEY = 'obscura_shielded_balance_';

function key(walletAddress: string): string {
  return STORAGE_KEY + walletAddress.toLowerCase();
}

/** Get the locally tracked shielded balance (1e18 scale). */
export function getLocalShieldedBalance(walletAddress: string): bigint {
  try {
    const raw = localStorage.getItem(key(walletAddress));
    if (!raw) return BigInt(0);
    return BigInt(raw);
  } catch {
    return BigInt(0);
  }
}

/** Add to the shielded balance (after a successful shield). */
export function addShieldedBalance(walletAddress: string, amount: bigint): void {
  const current = getLocalShieldedBalance(walletAddress);
  localStorage.setItem(key(walletAddress), (current + amount).toString());
}

/** Subtract from the shielded balance (after a successful unshield). */
export function subtractShieldedBalance(walletAddress: string, amount: bigint): void {
  const current = getLocalShieldedBalance(walletAddress);
  const next = current > amount ? current - amount : BigInt(0);
  localStorage.setItem(key(walletAddress), next.toString());
}
