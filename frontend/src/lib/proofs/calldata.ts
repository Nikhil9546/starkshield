/**
 * Garaga calldata encoding for on-chain proof verification.
 * Converts proof bytes + public inputs into Starknet calldata format.
 */

import { PROOF_TYPE_IDS, type CircuitType } from './circuits';

export interface StarknetCalldata {
  proofType: number;
  proofData: string[];
  publicInputs: string[];
}

/**
 * Encode proof and public inputs into Starknet calldata format
 * compatible with the on-chain Garaga verifier.
 */
export function encodeCalldata(
  circuitType: CircuitType,
  proof: Uint8Array,
  publicInputs: string[]
): StarknetCalldata {
  const proofType = PROOF_TYPE_IDS[circuitType];

  // Convert proof bytes to felt252 array (31-byte chunks for Starknet)
  const proofData = bytesToFelts(proof);

  return {
    proofType,
    proofData,
    publicInputs,
  };
}

/**
 * Convert a byte array to an array of felt252 strings.
 * Each felt252 holds up to 31 bytes (248 bits < 252 bits).
 */
export function bytesToFelts(bytes: Uint8Array): string[] {
  const FELT_BYTES = 31;
  const felts: string[] = [];

  for (let i = 0; i < bytes.length; i += FELT_BYTES) {
    const chunk = bytes.slice(i, Math.min(i + FELT_BYTES, bytes.length));
    let value = BigInt(0);
    for (let j = 0; j < chunk.length; j++) {
      value = (value << BigInt(8)) | BigInt(chunk[j]);
    }
    felts.push('0x' + value.toString(16));
  }

  return felts;
}

/**
 * Build the full calldata array for a ShieldedVault or ShieldedCDP contract call.
 * Includes: [proof_type, proof_len, ...proof_data, public_inputs_len, ...public_inputs, nullifier, ...extra_args]
 */
export function buildContractCalldata(
  circuitType: CircuitType,
  proof: Uint8Array,
  publicInputs: string[],
  nullifier: bigint,
  extraArgs: string[] = []
): string[] {
  const encoded = encodeCalldata(circuitType, proof, publicInputs);

  return [
    encoded.proofType.toString(),
    encoded.proofData.length.toString(),
    ...encoded.proofData,
    encoded.publicInputs.length.toString(),
    ...encoded.publicInputs,
    '0x' + nullifier.toString(16),
    ...extraArgs,
  ];
}

/**
 * Generate a unique nullifier for replay protection.
 * Combines the circuit type, user address, and a random nonce.
 */
export function generateNullifier(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let nullifier = BigInt(0);
  for (let i = 0; i < 32; i++) {
    nullifier = (nullifier << BigInt(8)) | BigInt(bytes[i]);
  }
  // Ensure it fits in a felt252 (< 2^251)
  const FELT_MAX = BigInt(2) ** BigInt(251);
  return nullifier % FELT_MAX;
}
