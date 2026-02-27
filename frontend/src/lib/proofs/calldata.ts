/**
 * Garaga calldata encoding for on-chain proof verification.
 * Uses the garaga npm package for real calldata generation,
 * with a bytesToFelts fallback for mock/devnet mode.
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
  const proofData = bytesToFelts(proof);

  return {
    proofType,
    proofData,
    publicInputs,
  };
}

/**
 * Encode proof + public inputs + VK into Garaga-compatible calldata using the garaga npm package.
 * Returns an array of hex strings ready to be passed as Span<felt252> to the verifier.
 *
 * garaga.getZKHonkCallData(proof: Uint8Array, publicInputs: Uint8Array, vk: Uint8Array): bigint[]
 * publicInputs must be a flat Uint8Array of 32-byte big-endian field elements.
 */
export async function encodeGaragaCalldata(
  proof: Uint8Array,
  publicInputs: string[],
  vk: Uint8Array,
): Promise<string[]> {
  // Dynamic import to avoid loading WASM on page load
  const garaga = await import('garaga');
  if (garaga.init) {
    await garaga.init();
  }

  // Convert hex string public inputs to flat Uint8Array (32 bytes each, big-endian)
  const piBytes = new Uint8Array(publicInputs.length * 32);
  for (let i = 0; i < publicInputs.length; i++) {
    const hex = publicInputs[i].replace(/^0x/, '').padStart(64, '0');
    for (let j = 0; j < 32; j++) {
      piBytes[i * 32 + j] = parseInt(hex.slice(j * 2, j * 2 + 2), 16);
    }
  }

  const calldata: bigint[] = garaga.getZKHonkCallData(proof, piBytes, vk);
  // garaga returns [span_length, elem0, elem1, ...] — strip the length prefix
  // because vault.ts/cdp.ts add their own Span length when building calldata.
  const hexCalldata = calldata.map((v: bigint) => '0x' + v.toString(16));
  return hexCalldata.slice(1);
}

/**
 * Convert a byte array to an array of felt252 strings.
 * Each felt252 holds up to 31 bytes (248 bits < 252 bits).
 * Used as fallback for devnet/mock mode.
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
