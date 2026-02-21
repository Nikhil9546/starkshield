/**
 * Proof history persistence via localStorage.
 * Records proof generation results for display on the Proofs Dashboard.
 */

import type { CircuitType } from './proofs/circuits';

export interface ProofRecord {
  id: string;
  circuit: CircuitType;
  status: 'pending' | 'proving' | 'verified' | 'failed';
  timestamp: number;
  txHash?: string;
}

const STORAGE_KEY = 'starkshield_proof_history_';
const MAX_RECORDS = 50;

/**
 * Load proof history for a wallet address.
 */
export function loadProofHistory(walletAddress: string): ProofRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + walletAddress.toLowerCase());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Add a proof record to history (newest first, capped at MAX_RECORDS).
 */
export function addProofRecord(walletAddress: string, record: ProofRecord): void {
  const existing = loadProofHistory(walletAddress);
  existing.unshift(record);
  if (existing.length > MAX_RECORDS) existing.length = MAX_RECORDS;
  localStorage.setItem(
    STORAGE_KEY + walletAddress.toLowerCase(),
    JSON.stringify(existing),
  );
}
