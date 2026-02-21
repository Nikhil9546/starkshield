import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import SolvencyCard from '../components/SolvencyCard';
import { CircuitType, preloadCircuits } from '../lib/proofs/circuits';

interface ProofRecord {
  id: string;
  circuit: CircuitType;
  status: 'pending' | 'proving' | 'verified' | 'failed';
  timestamp: number;
}

export default function ProofsPage() {
  const { address } = useWallet();
  const [preloading, setPreloading] = useState(false);
  const [preloaded, setPreloaded] = useState(false);

  // Mock solvency data — in production, fetched from SolvencyProver contract
  const [vaultSolvency] = useState<{ solvent: boolean | null; lastVerified: number | null }>({
    solvent: null,
    lastVerified: null,
  });
  const [cdpSafety] = useState<{ solvent: boolean | null; lastVerified: number | null }>({
    solvent: null,
    lastVerified: null,
  });

  // Proof history — in production, stored locally and synced with on-chain events
  const [proofHistory] = useState<ProofRecord[]>([]);

  const handlePreload = async () => {
    setPreloading(true);
    try {
      await preloadCircuits([
        CircuitType.RANGE_PROOF,
        CircuitType.BALANCE_SUFFICIENCY,
        CircuitType.COLLATERAL_RATIO,
      ]);
      setPreloaded(true);
    } catch {
      // Circuit files may not be available in dev mode
    } finally {
      setPreloading(false);
    }
  };

  if (!address) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Proofs Dashboard</h2>
        <p className="text-gray-400">Connect your wallet to view proofs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Proofs Dashboard</h2>
      <p className="text-gray-400">
        Monitor ZK proof generation, verification status, and protocol solvency.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SolvencyCard
          domain="vault"
          isSolvent={vaultSolvency.solvent}
          lastVerified={vaultSolvency.lastVerified}
        />
        <SolvencyCard
          domain="cdp"
          isSolvent={cdpSafety.solvent}
          lastVerified={cdpSafety.lastVerified}
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Circuit Preloading</h3>
          <button
            onClick={handlePreload}
            disabled={preloading || preloaded}
            className="text-sm bg-gray-800 hover:bg-gray-700 disabled:text-gray-500 text-gray-200 px-4 py-1.5 rounded transition-colors"
          >
            {preloaded ? 'Circuits Ready' : preloading ? 'Loading...' : 'Preload Circuits'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Preloading circuits improves proof generation speed. Circuits are cached in memory
          for the duration of your session.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Proof History</h3>
        {proofHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No proofs generated yet. Proofs are created when you deposit, withdraw, mint, or repay.
          </p>
        ) : (
          <div className="space-y-2">
            {proofHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <div>
                  <span className="text-sm text-gray-200">{record.circuit}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(record.timestamp).toLocaleString()}
                  </span>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    record.status === 'verified'
                      ? 'bg-green-900/30 text-green-400'
                      : record.status === 'failed'
                      ? 'bg-red-900/30 text-red-400'
                      : record.status === 'proving'
                      ? 'bg-shield-900/30 text-shield-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
