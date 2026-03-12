/**
 * Proof history persistence via localStorage + optional IPFS pinning.
 * Records proof generation results for display on the Proofs Dashboard.
 */

import type { CircuitType } from './proofs/circuits';
import { isIPFSConfigured } from './ipfs/client';
import { uploadProof, type IPFSProofRecord } from './ipfs/proofStore';

export interface ProofRecord {
  id: string;
  circuit: CircuitType;
  status: 'pending' | 'proving' | 'verified' | 'failed';
  timestamp: number;
  txHash?: string;
  provingTimeMs?: number;
  proofSizeBytes?: number;
  ipfsCid?: string;
}

const STORAGE_KEY = 'obscura_proof_history_';
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
 * Save proof history to localStorage.
 */
function saveProofHistory(walletAddress: string, records: ProofRecord[]): void {
  localStorage.setItem(
    STORAGE_KEY + walletAddress.toLowerCase(),
    JSON.stringify(records),
  );
}

/**
 * Add a proof record to history (newest first, capped at MAX_RECORDS).
 */
export function addProofRecord(walletAddress: string, record: ProofRecord): void {
  const existing = loadProofHistory(walletAddress);
  existing.unshift(record);
  if (existing.length > MAX_RECORDS) existing.length = MAX_RECORDS;
  saveProofHistory(walletAddress, existing);
}

/**
 * Update a proof record's IPFS CID in history.
 */
export function updateProofRecordCid(walletAddress: string, recordId: string, cid: string): void {
  const records = loadProofHistory(walletAddress);
  const record = records.find(r => r.id === recordId);
  if (record) {
    record.ipfsCid = cid;
    saveProofHistory(walletAddress, records);
  }
}

/**
 * Pin a verified proof to IPFS (fire-and-forget, non-blocking).
 * Updates the local proof record with the CID on success.
 */
export function pinProofToIPFS(
  walletAddress: string,
  record: ProofRecord,
  proofHex: string,
  publicInputs: string[],
): void {
  if (!isIPFSConfigured()) return;
  if (record.status !== 'verified' || !record.txHash) return;

  const ipfsRecord: IPFSProofRecord = {
    wallet: walletAddress,
    circuit: record.circuit,
    proofHex,
    publicInputs,
    txHash: record.txHash,
    timestamp: record.timestamp,
    provingTimeMs: record.provingTimeMs,
    proofSizeBytes: record.proofSizeBytes,
    verified: true,
  };

  // Non-blocking upload
  uploadProof(walletAddress, ipfsRecord)
    .then(({ proofCid }) => {
      updateProofRecordCid(walletAddress, record.id, proofCid);
    })
    .catch((err) => {
      console.warn('[IPFS] Failed to pin proof:', err.message);
    });
}
