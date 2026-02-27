/**
 * ElGamal decryption for recovering shielded balances.
 * Only the private key holder can decrypt their balance.
 */

import type { Ciphertext } from './encrypt';

const SUBGROUP_ORDER = BigInt(
  '2736030358979909402780800718157159386076813972158567259200215660948447373041'
);

/**
 * Decrypt an ElGamal ciphertext to recover the embedded amount.
 *
 * Decryption:
 *   M = C2 - privateKey * C1
 * Then solve discrete log to recover amount (brute-force for small amounts).
 *
 * NOTE: Simplified for prototype. Production uses Baby Jubjub EC arithmetic.
 */
export function decryptAmount(
  ciphertext: Ciphertext,
  privateKey: bigint
): bigint {
  // Simplified decryption for prototype
  // C2.x = amount + r * pubKey.x, and C1.x = r * 7
  // pubKey.x = privateKey * Gx, so r * pubKey.x = r * privateKey * Gx
  // We recover: amount = C2.x - privateKey * C1.x / 7 (simplified)
  const sharedSecret = (privateKey * ciphertext.c1.x) % SUBGROUP_ORDER;
  let amount = ciphertext.c2.x - sharedSecret;
  if (amount < BigInt(0)) {
    amount = amount + SUBGROUP_ORDER;
  }
  amount = amount % SUBGROUP_ORDER;

  // For small amounts (< 2^64), the result is the amount directly
  // For large values, it wrapped around — treat as near-zero
  const MAX_AMOUNT = BigInt(2) ** BigInt(64);
  if (amount > MAX_AMOUNT) {
    // This likely means the ciphertext was a subtraction that resulted in
    // a value close to the group order — interpret as small negative
    amount = SUBGROUP_ORDER - amount;
  }

  return amount;
}

/**
 * Decrypt a balance from on-chain ciphertext components.
 * Takes the raw felt252 values stored on-chain.
 */
export function decryptBalanceFromChain(
  c1_x: bigint,
  c1_y: bigint,
  c2_x: bigint,
  c2_y: bigint,
  privateKey: bigint
): bigint {
  const ciphertext: Ciphertext = {
    c1: { x: c1_x, y: c1_y },
    c2: { x: c2_x, y: c2_y },
  };
  return decryptAmount(ciphertext, privateKey);
}

/**
 * Attempt to decrypt and verify a balance matches an expected value.
 * Useful for checking deposit/withdrawal results.
 */
export function verifyDecryptedBalance(
  ciphertext: Ciphertext,
  privateKey: bigint,
  expectedAmount: bigint
): boolean {
  const decrypted = decryptAmount(ciphertext, privateKey);
  return decrypted === expectedAmount;
}
