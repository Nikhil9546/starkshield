/**
 * Proof generation pipeline using noir_js and bb.js.
 * Generates UltraKeccakZKHonk proofs in the browser.
 */

import { loadCircuit, type CircuitType } from './circuits';
import { generateWitnessInputs, type CircuitWitness } from './witness';

export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
  provingTimeMs?: number;
  proofSizeBytes?: number;
}

export interface ProofProgress {
  stage: 'loading' | 'witnessing' | 'proving' | 'encoding' | 'submitting' | 'confirming' | 'verified' | 'done' | 'error';
  percent: number;
  message: string;
}

export type ProgressCallback = (progress: ProofProgress) => void;

/**
 * Generate a ZK proof for a given circuit and witness.
 * Reports progress via callback for UI updates.
 */
export async function generateProof(
  witness: CircuitWitness,
  onProgress?: ProgressCallback
): Promise<ProofResult> {
  const report = (stage: ProofProgress['stage'], percent: number, message: string) => {
    onProgress?.({ stage, percent, message });
  };

  try {
    const startTime = performance.now();

    // Stage 1: Load circuit
    report('loading', 10, 'Loading circuit...');
    const circuit = await loadCircuit(witness.type);

    // Stage 2: Generate witness
    report('witnessing', 30, 'Generating witness...');
    const inputs = generateWitnessInputs(witness);

    // Stage 3: Create proof using noir_js + bb.js
    report('proving', 50, 'Generating proof (this may take a moment)...');

    // Dynamic imports to avoid loading heavy WASM on page load
    const { Noir } = await import('@noir-lang/noir_js');
    const { UltraHonkBackend } = await import('@aztec/bb.js');

    report('proving', 60, 'Initializing proving backend...');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = new UltraHonkBackend((circuit as any).bytecode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noir = new Noir(circuit as any);

    report('proving', 70, 'Computing witness...');
    const { witness: solvedWitness } = await noir.execute(inputs);

    report('proving', 85, 'Generating proof...');
    const proof = await backend.generateProof(solvedWitness, { keccakZK: true });

    const provingTimeMs = Math.round(performance.now() - startTime);

    report('done', 100, `Proof generated in ${(provingTimeMs / 1000).toFixed(1)}s`);

    return {
      proof: proof.proof,
      publicInputs: proof.publicInputs.map(String),
      provingTimeMs,
      proofSizeBytes: proof.proof.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proving error';
    report('error', 0, message);
    throw new Error(`Proof generation failed: ${message}`);
  }
}

/**
 * Verify a proof locally (for debugging before submitting on-chain).
 */
export async function verifyProofLocally(
  circuitType: CircuitType,
  proof: Uint8Array,
  publicInputs: string[]
): Promise<boolean> {
  try {
    const circuit = await loadCircuit(circuitType);
    const { UltraHonkBackend } = await import('@aztec/bb.js');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = new UltraHonkBackend((circuit as any).bytecode);
    return await backend.verifyProof({
      proof,
      publicInputs,
    });
  } catch {
    return false;
  }
}
