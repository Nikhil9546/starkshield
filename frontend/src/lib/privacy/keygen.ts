/**
 * ElGamal keypair generation for shielded balances.
 * Uses the Baby JubJub curve parameters compatible with Tongo's encryption.
 */

// Baby JubJub curve order (subgroup)
const SUBGROUP_ORDER = BigInt(
  '2736030358979909402780800718157159386076813972158567259200215660948447373041'
);

export interface ElGamalKeyPair {
  privateKey: bigint;
  publicKey: { x: bigint; y: bigint };
}

/**
 * Generate a cryptographically secure random private key within the curve subgroup order.
 */
function generatePrivateKey(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let key = BigInt(0);
  for (let i = 0; i < 32; i++) {
    key = (key << BigInt(8)) | BigInt(bytes[i]);
  }
  // Reduce modulo subgroup order, ensure non-zero
  key = key % SUBGROUP_ORDER;
  if (key === BigInt(0)) {
    key = BigInt(1);
  }
  return key;
}

/**
 * Derive a public key from a private key using scalar multiplication
 * on the Baby JubJub generator point.
 *
 * NOTE: In production, this would use a proper elliptic curve library.
 * For the frontend prototype, we use a simplified representation.
 * The actual curve arithmetic happens in the ZK circuits and on-chain.
 */
export function derivePublicKey(privateKey: bigint): { x: bigint; y: bigint } {
  // Generator point for Baby JubJub (Montgomery form)
  const Gx = BigInt(
    '995203441582195749578291179787384436505546430278305826713579947235728471134'
  );
  const Gy = BigInt(
    '5472060717959818805561601436314318772137091100104008585924551046643952123905'
  );

  // Simplified: in production, perform actual scalar multiplication G * privateKey
  // For the prototype, we derive a deterministic point from the private key
  // The real implementation will use a WASM-based curve library
  const hash1 = privateKey * Gx % SUBGROUP_ORDER;
  const hash2 = privateKey * Gy % SUBGROUP_ORDER;

  return { x: hash1, y: hash2 };
}

/**
 * Generate a fresh ElGamal keypair.
 */
export function generateKeyPair(): ElGamalKeyPair {
  const privateKey = generatePrivateKey();
  const publicKey = derivePublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Serialize a keypair to a JSON-compatible format for storage.
 */
export function serializeKeyPair(kp: ElGamalKeyPair): string {
  return JSON.stringify({
    privateKey: kp.privateKey.toString(),
    publicKey: {
      x: kp.publicKey.x.toString(),
      y: kp.publicKey.y.toString(),
    },
  });
}

/**
 * Deserialize a keypair from stored JSON string.
 */
export function deserializeKeyPair(json: string): ElGamalKeyPair {
  const obj = JSON.parse(json);
  return {
    privateKey: BigInt(obj.privateKey),
    publicKey: {
      x: BigInt(obj.publicKey.x),
      y: BigInt(obj.publicKey.y),
    },
  };
}
