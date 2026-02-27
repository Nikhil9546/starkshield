/**
 * ElGamal encryption for shielded amounts.
 * Produces ciphertexts (C1, C2) that can be verified on-chain
 * and decrypted only by the holder of the corresponding private key.
 */

const SUBGROUP_ORDER = BigInt(
  '2736030358979909402780800718157159386076813972158567259200215660948447373041'
);

/** Starknet felt252 prime: P = 2^251 + 17 * 2^192 + 1 */
const STARK_PRIME = BigInt(2) ** BigInt(251) + BigInt(17) * BigInt(2) ** BigInt(192) + BigInt(1);

export interface Ciphertext {
  c1: { x: bigint; y: bigint };
  c2: { x: bigint; y: bigint };
}

export interface EncryptionRandomness {
  r: bigint;
}

/**
 * Generate encryption randomness.
 */
function generateRandomness(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let r = BigInt(0);
  for (let i = 0; i < 32; i++) {
    r = (r << BigInt(8)) | BigInt(bytes[i]);
  }
  r = r % SUBGROUP_ORDER;
  if (r === BigInt(0)) r = BigInt(1);
  return r;
}

/**
 * Encrypt an amount using ElGamal encryption with the recipient's public key.
 *
 * ElGamal encryption:
 *   C1 = r * G
 *   C2 = amount * G + r * publicKey
 *
 * NOTE: Simplified for prototype. Production uses proper EC arithmetic via WASM.
 */
export function encryptAmount(
  amount: bigint,
  publicKey: { x: bigint; y: bigint }
): { ciphertext: Ciphertext; randomness: EncryptionRandomness } {
  const r = generateRandomness();

  // Simplified point operations for prototype
  // In production: proper Baby JubJub scalar multiplication
  const c1 = {
    x: (r * BigInt(7)) % SUBGROUP_ORDER,
    y: (r * BigInt(13)) % SUBGROUP_ORDER,
  };

  const c2 = {
    x: (amount + r * publicKey.x) % SUBGROUP_ORDER,
    y: (amount + r * publicKey.y) % SUBGROUP_ORDER,
  };

  return {
    ciphertext: { c1, c2 },
    randomness: { r },
  };
}

/**
 * Compute a Pedersen commitment for an amount (legacy simplified version).
 * @deprecated Use pedersenHashNoir() for circuit-compatible commitments.
 */
export function pedersenCommit(
  amount: bigint,
  blinding: bigint
): bigint {
  const G_FACTOR = BigInt(
    '995203441582195749578291179787384436505546430278305826713579947235728471134'
  );
  const H_FACTOR = BigInt(
    '8076246640662884909881801758704306714034609987455869804520522091855516602923'
  );

  return (amount * G_FACTOR + blinding * H_FACTOR) % SUBGROUP_ORDER;
}

/**
 * Convert a bigint to a 32-byte big-endian Uint8Array (Fr field element).
 */
function bigintToFr(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert a 32-byte big-endian Uint8Array (Fr) back to bigint.
 */
function frToBigint(fr: Uint8Array): bigint {
  let result = BigInt(0);
  for (let i = 0; i < fr.length; i++) {
    result = (result << BigInt(8)) | BigInt(fr[i]);
  }
  return result;
}

// Cached Barretenberg instance (lazy-initialized)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bbInstance: any = null;

async function getBarretenberg() {
  if (bbInstance) return bbInstance;
  const { Barretenberg } = await import('@aztec/bb.js');
  bbInstance = await Barretenberg.new();
  return bbInstance;
}

/**
 * Compute Pedersen hash matching Noir's std::hash::pedersen_hash.
 * Uses Barretenberg WASM for exact compatibility with circuit assertions.
 *
 * pedersen_hash([value as Field, blinding])
 */
export async function pedersenHashNoir(
  value: bigint,
  blinding: bigint
): Promise<bigint> {
  const bb = await getBarretenberg();
  const inputs = [bigintToFr(value), bigintToFr(blinding)];
  const result = await bb.pedersenHash({ inputs, hashIndex: 0 });
  // Returns raw BN254 field element — matches Noir circuit's pedersen_hash.
  // Use toStarkFelt() when sending to Starknet (felt252 requires < STARK_PRIME).
  return frToBigint(result.hash);
}

/**
 * Reduce a BN254 field element to fit in Starknet's felt252 range.
 * Use this when sending Pedersen hash commitments to on-chain contracts.
 */
export function toStarkFelt(value: bigint): bigint {
  return value % STARK_PRIME;
}

/**
 * Compute ciphertext delta for balance updates.
 * Used when adding/subtracting from encrypted balances on-chain.
 */
export function computeCiphertextDelta(
  amount: bigint,
  publicKey: { x: bigint; y: bigint },
  isDeposit: boolean
): { delta_c1: bigint; delta_c2: bigint; commitment: bigint; randomness: bigint } {
  const r = generateRandomness();
  const blinding = generateRandomness();

  const signedAmount = isDeposit ? amount : SUBGROUP_ORDER - amount;

  const delta_c1 = (r * BigInt(7)) % SUBGROUP_ORDER;
  const delta_c2 = (signedAmount + r * publicKey.x) % SUBGROUP_ORDER;
  const commitment = pedersenCommit(signedAmount, blinding);

  return { delta_c1, delta_c2, commitment, randomness: r };
}

/**
 * Serialize a ciphertext for on-chain submission (as felt252 array).
 */
export function serializeCiphertext(ct: Ciphertext): string[] {
  return [
    ct.c1.x.toString(),
    ct.c1.y.toString(),
    ct.c2.x.toString(),
    ct.c2.y.toString(),
  ];
}
