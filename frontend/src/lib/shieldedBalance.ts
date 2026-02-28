/**
 * Local shielded balance tracker via localStorage.
 *
 * On devnet the simplified ElGamal decryption returns garbage values,
 * so we track shield/unshield operations locally to maintain an accurate
 * client-side balance for circuit witnesses.
 *
 * Stores balance (1e18 scale), and separately stores witness-scale state
 * (balanceU64, blinding, commitment) so that subsequent shield operations
 * can construct DEBT_UPDATE_VALIDITY proofs referencing the old commitment.
 */

const STORAGE_KEY = 'obscura_shielded_balance_';
const WITNESS_KEY = 'obscura_shielded_witness_';

function balKey(walletAddress: string): string {
  return STORAGE_KEY + walletAddress.toLowerCase();
}

function witKey(walletAddress: string): string {
  return WITNESS_KEY + walletAddress.toLowerCase();
}

/** Witness state needed for subsequent shield proofs (DEBT_UPDATE_VALIDITY). */
export interface ShieldedWitnessState {
  /** Balance at 1e8 (circuit) scale */
  balanceU64: bigint;
  /** Blinding used in the latest commitment */
  blinding: bigint;
  /** The Pedersen commitment stored on-chain */
  commitment: bigint;
}

/** Get the locally tracked shielded balance (1e18 scale). */
export function getLocalShieldedBalance(walletAddress: string): bigint {
  try {
    const raw = localStorage.getItem(balKey(walletAddress));
    if (!raw) return BigInt(0);
    return BigInt(raw);
  } catch {
    return BigInt(0);
  }
}

/** Get the witness state needed for subsequent shield proofs. */
export function getShieldedWitnessState(walletAddress: string): ShieldedWitnessState | null {
  try {
    const raw = localStorage.getItem(witKey(walletAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      balanceU64: BigInt(parsed.balanceU64),
      blinding: BigInt(parsed.blinding),
      commitment: BigInt(parsed.commitment),
    };
  } catch {
    return null;
  }
}

/** Save witness state after a successful shield. */
export function setShieldedWitnessState(walletAddress: string, state: ShieldedWitnessState): void {
  localStorage.setItem(witKey(walletAddress), JSON.stringify({
    balanceU64: state.balanceU64.toString(),
    blinding: state.blinding.toString(),
    commitment: state.commitment.toString(),
  }));
}

/** Clear witness state (after unshielding to zero). */
export function clearShieldedWitnessState(walletAddress: string): void {
  localStorage.removeItem(witKey(walletAddress));
}

// =========================================================================
// CDP State (collateral + debt tracked locally for UI persistence)
// =========================================================================

const CDP_COL_KEY = 'obscura_cdp_collateral_';
const CDP_DEBT_KEY = 'obscura_cdp_debt_';
const CDP_COL_WITNESS_KEY = 'obscura_cdp_col_witness_';

function cdpColKey(walletAddress: string): string {
  return CDP_COL_KEY + walletAddress.toLowerCase();
}

function cdpDebtKey(walletAddress: string): string {
  return CDP_DEBT_KEY + walletAddress.toLowerCase();
}

function cdpColWitKey(walletAddress: string): string {
  return CDP_COL_WITNESS_KEY + walletAddress.toLowerCase();
}

/** Get locally tracked CDP collateral (u64 / 1e8 scale). */
export function getLocalCDPCollateral(walletAddress: string): bigint {
  try {
    const raw = localStorage.getItem(cdpColKey(walletAddress));
    if (!raw) return BigInt(0);
    return BigInt(raw);
  } catch {
    return BigInt(0);
  }
}

/** Set locally tracked CDP collateral. */
export function setLocalCDPCollateral(walletAddress: string, amount: bigint): void {
  localStorage.setItem(cdpColKey(walletAddress), amount.toString());
}

/** Get locally tracked CDP debt (u64 / 1e8 scale). */
export function getLocalCDPDebt(walletAddress: string): bigint {
  try {
    const raw = localStorage.getItem(cdpDebtKey(walletAddress));
    if (!raw) return BigInt(0);
    return BigInt(raw);
  } catch {
    return BigInt(0);
  }
}

/** Set locally tracked CDP debt. */
export function setLocalCDPDebt(walletAddress: string, amount: bigint): void {
  localStorage.setItem(cdpDebtKey(walletAddress), amount.toString());
}

/** Get collateral witness state for subsequent lock proofs. */
export function getCDPColWitness(walletAddress: string): ShieldedWitnessState | null {
  try {
    const raw = localStorage.getItem(cdpColWitKey(walletAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      balanceU64: BigInt(parsed.balanceU64),
      blinding: BigInt(parsed.blinding),
      commitment: BigInt(parsed.commitment),
    };
  } catch {
    return null;
  }
}

/** Save collateral witness state after a successful lock. */
export function setCDPColWitness(walletAddress: string, state: ShieldedWitnessState): void {
  localStorage.setItem(cdpColWitKey(walletAddress), JSON.stringify({
    balanceU64: state.balanceU64.toString(),
    blinding: state.blinding.toString(),
    commitment: state.commitment.toString(),
  }));
}

/** Clear all CDP local state (after closing CDP). */
export function clearCDPState(walletAddress: string): void {
  localStorage.removeItem(cdpColKey(walletAddress));
  localStorage.removeItem(cdpDebtKey(walletAddress));
  localStorage.removeItem(cdpColWitKey(walletAddress));
}

// =========================================================================
// Shielded Balance helpers
// =========================================================================

/** Add to the shielded balance (after a successful shield). */
export function addShieldedBalance(walletAddress: string, amount: bigint): void {
  const current = getLocalShieldedBalance(walletAddress);
  localStorage.setItem(balKey(walletAddress), (current + amount).toString());
}

/** Subtract from the shielded balance (after a successful unshield). */
export function subtractShieldedBalance(walletAddress: string, amount: bigint): void {
  const current = getLocalShieldedBalance(walletAddress);
  const next = current > amount ? current - amount : BigInt(0);
  localStorage.setItem(balKey(walletAddress), next.toString());
}
