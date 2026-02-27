/**
 * Hook for managing proof generation with progress tracking.
 */

import { useState, useCallback } from 'react';
import {
  generateProof,
  type ProofResult,
  type ProofProgress,
} from '../lib/proofs/prover';
import type { CircuitWitness } from '../lib/proofs/witness';

interface UseProofReturn {
  progress: ProofProgress | null;
  proof: ProofResult | null;
  isProving: boolean;
  error: string | null;
  prove: (witness: CircuitWitness) => Promise<ProofResult>;
  reset: () => void;
}

export function useProof(): UseProofReturn {
  const [progress, setProgress] = useState<ProofProgress | null>(null);
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [isProving, setIsProving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prove = useCallback(async (witness: CircuitWitness): Promise<ProofResult> => {
    setIsProving(true);
    setError(null);
    setProof(null);
    setProgress(null);

    try {
      const result = await generateProof(witness, setProgress);
      setProof(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proof generation failed';
      setError(message);
      throw err;
    } finally {
      setIsProving(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setProof(null);
    setIsProving(false);
    setError(null);
  }, []);

  return { progress, proof, isProving, error, prove, reset };
}
