/**
 * Circuit loading and management.
 * Loads compiled Noir circuits (ACIR) for in-browser proof generation.
 */

export enum CircuitType {
  RANGE_PROOF = 'range_proof',
  BALANCE_SUFFICIENCY = 'balance_sufficiency',
  COLLATERAL_RATIO = 'collateral_ratio',
  DEBT_UPDATE_VALIDITY = 'debt_update_validity',
  ZERO_DEBT = 'zero_debt',
  VAULT_SOLVENCY = 'vault_solvency',
  CDP_SAFETY_BOUND = 'cdp_safety_bound',
}

/** On-chain proof type IDs matching contracts/src/types.cairo */
export const PROOF_TYPE_IDS: Record<CircuitType, number> = {
  [CircuitType.RANGE_PROOF]: 1,
  [CircuitType.BALANCE_SUFFICIENCY]: 2,
  [CircuitType.COLLATERAL_RATIO]: 3,
  [CircuitType.DEBT_UPDATE_VALIDITY]: 4,
  [CircuitType.ZERO_DEBT]: 5,
  [CircuitType.VAULT_SOLVENCY]: 6,
  [CircuitType.CDP_SAFETY_BOUND]: 7,
};

export interface CompiledCircuit {
  bytecode: string;
  abi: Record<string, unknown>;
}

const circuitCache = new Map<CircuitType, CompiledCircuit>();
const vkCache = new Map<CircuitType, Uint8Array>();

/**
 * Load a compiled circuit artifact from the public directory.
 * Circuit JSON files should be placed in /public/circuits/ during build.
 */
export async function loadCircuit(type: CircuitType): Promise<CompiledCircuit> {
  const cached = circuitCache.get(type);
  if (cached) return cached;

  const response = await fetch(`/circuits/${type}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load circuit ${type}: ${response.statusText}`);
  }

  const circuit: CompiledCircuit = await response.json();
  circuitCache.set(type, circuit);
  return circuit;
}

/**
 * Load the verification key binary for a circuit type.
 * VK files are stored as /public/circuits/<name>_vk.bin.
 */
export async function loadVK(type: CircuitType): Promise<Uint8Array> {
  const cached = vkCache.get(type);
  if (cached) return cached;

  const response = await fetch(`/circuits/${type}_vk.bin`);
  if (!response.ok) {
    throw new Error(`Failed to load VK for ${type}: ${response.statusText}`);
  }

  const vk = new Uint8Array(await response.arrayBuffer());
  vkCache.set(type, vk);
  return vk;
}

/**
 * Preload all circuits into cache for faster proof generation.
 */
export async function preloadCircuits(
  types: CircuitType[] = Object.values(CircuitType)
): Promise<void> {
  await Promise.all(types.map(loadCircuit));
}

/**
 * Clear the circuit cache (useful for memory management).
 */
export function clearCircuitCache(): void {
  circuitCache.clear();
  vkCache.clear();
}
