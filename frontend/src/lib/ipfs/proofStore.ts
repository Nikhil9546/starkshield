/**
 * Per-user IPFS proof storage.
 *
 * Each user gets a proof archive on IPFS:
 * - Individual proof records are pinned as JSON
 * - A per-user index manifest tracks all proof CIDs
 * - Index CID is stored in localStorage for quick lookup
 *
 * Structure on IPFS:
 *   index.json (manifest) → { wallet, proofs: [{ cid, circuit, timestamp }] }
 *   proof_001.json         → { wallet, circuit, proofHex, publicInputs, txHash, ... }
 */

import { pinJSON, fetchJSON, isIPFSConfigured, getIPFSUrl } from './client';
import type { CircuitType } from '../proofs/circuits';

/** Individual proof record stored on IPFS */
export interface IPFSProofRecord {
  wallet: string;
  circuit: CircuitType;
  proofHex: string;
  publicInputs: string[];
  txHash: string;
  timestamp: number;
  provingTimeMs?: number;
  proofSizeBytes?: number;
  verified: boolean;
}

/** Entry in the per-user index manifest */
export interface ProofIndexEntry {
  cid: string;
  circuit: CircuitType;
  txHash: string;
  timestamp: number;
  verified: boolean;
}

/** The per-user index manifest */
export interface ProofIndex {
  wallet: string;
  updatedAt: number;
  proofs: ProofIndexEntry[];
}

const INDEX_STORAGE_KEY = 'obscura_ipfs_index_';

/**
 * Get the stored index CID for a wallet from localStorage.
 */
export function getStoredIndexCID(wallet: string): string | null {
  return localStorage.getItem(INDEX_STORAGE_KEY + wallet.toLowerCase()) || null;
}

/**
 * Save the index CID to localStorage.
 */
function saveIndexCID(wallet: string, cid: string): void {
  localStorage.setItem(INDEX_STORAGE_KEY + wallet.toLowerCase(), cid);
}

/**
 * Upload a proof to IPFS and update the user's index.
 * Returns the proof CID and updated index CID.
 */
export async function uploadProof(
  wallet: string,
  record: IPFSProofRecord,
): Promise<{ proofCid: string; indexCid: string }> {
  if (!isIPFSConfigured()) {
    throw new Error('IPFS not configured');
  }

  // 1. Pin the individual proof
  const proofCid = await pinJSON(
    record as unknown as Record<string, unknown>,
    `obscura-proof-${record.circuit}-${record.timestamp}`,
  );

  // 2. Load existing index or create new
  let index: ProofIndex;
  const existingIndexCid = getStoredIndexCID(wallet);

  if (existingIndexCid) {
    try {
      index = await fetchJSON<ProofIndex>(existingIndexCid);
    } catch {
      // Index corrupted or unavailable, start fresh
      index = { wallet, updatedAt: Date.now(), proofs: [] };
    }
  } else {
    index = { wallet, updatedAt: Date.now(), proofs: [] };
  }

  // 3. Add new entry to index
  index.proofs.unshift({
    cid: proofCid,
    circuit: record.circuit,
    txHash: record.txHash,
    timestamp: record.timestamp,
    verified: record.verified,
  });
  index.updatedAt = Date.now();

  // Cap at 100 entries
  if (index.proofs.length > 100) {
    index.proofs.length = 100;
  }

  // 4. Pin updated index
  const indexCid = await pinJSON(
    index as unknown as Record<string, unknown>,
    `obscura-index-${wallet.slice(0, 10)}`,
  );

  // 5. Save index CID locally
  saveIndexCID(wallet, indexCid);

  return { proofCid, indexCid };
}

/**
 * Fetch the user's proof index from IPFS.
 */
export async function fetchProofIndex(wallet: string): Promise<ProofIndex | null> {
  const cid = getStoredIndexCID(wallet);
  if (!cid) return null;

  try {
    return await fetchJSON<ProofIndex>(cid);
  } catch {
    return null;
  }
}

/**
 * Fetch a specific proof record from IPFS by CID.
 */
export async function fetchProofRecord(cid: string): Promise<IPFSProofRecord> {
  return fetchJSON<IPFSProofRecord>(cid);
}

/**
 * Restore proof index from a known CID (e.g., shared or backed up).
 */
export function restoreIndexFromCID(wallet: string, cid: string): void {
  saveIndexCID(wallet, cid);
}

/**
 * Get IPFS gateway URL for a CID.
 */
export { getIPFSUrl };
