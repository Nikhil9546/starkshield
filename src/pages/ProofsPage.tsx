import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import SolvencyCard from '../components/SolvencyCard';
import { CircuitType, preloadCircuits } from '../lib/proofs/circuits';
import { isVaultSolvent, getVaultLastVerified, isCdpSafe, getCdpLastVerified } from '../lib/contracts/solvency';
import { getTotalDeposited } from '../lib/contracts/vault';
import { loadProofHistory, type ProofRecord } from '../lib/proofHistory';

export default function ProofsPage() {
  const { account, address } = useWallet();
  const [preloading, setPreloading] = useState(false);
  const [preloaded, setPreloaded] = useState(false);

  // Solvency data from SolvencyProver contract
  const [vaultSolvency, setVaultSolvency] = useState<{ solvent: boolean | null; lastVerified: number | null }>({
    solvent: null,
    lastVerified: null,
  });
  const [cdpSafety, setCdpSafety] = useState<{ solvent: boolean | null; lastVerified: number | null }>({
    solvent: null,
    lastVerified: null,
  });

  // Aggregate protocol stats
  const [totalDeposited, setTotalDeposited] = useState<bigint | null>(null);

  // Proof history from localStorage
  const [proofHistory, setProofHistory] = useState<ProofRecord[]>([]);
  const [solvencyLoading, setSolvencyLoading] = useState(false);

  const fetchSolvencyData = useCallback(async () => {
    if (!account) return;
    setSolvencyLoading(true);

    try {
      const [vSolvent, vTimestamp, cSafe, cTimestamp, deposited] = await Promise.all([
        isVaultSolvent(account).catch(() => null),
        getVaultLastVerified(account).catch(() => null),
        isCdpSafe(account).catch(() => null),
        getCdpLastVerified(account).catch(() => null),
        getTotalDeposited(account).catch(() => null),
      ]);

      setVaultSolvency({ solvent: vSolvent, lastVerified: vTimestamp });
      setCdpSafety({ solvent: cSafe, lastVerified: cTimestamp });
      setTotalDeposited(deposited);
    } catch {
      // Silently fail — data stays as null/unknown
    } finally {
      setSolvencyLoading(false);
    }
  }, [account]);

  // Fetch solvency data on mount
  useEffect(() => {
    if (account && address) {
      fetchSolvencyData();
    }
  }, [account, address, fetchSolvencyData]);

  // Load proof history from localStorage
  useEffect(() => {
    if (address) {
      setProofHistory(loadProofHistory(address));
    }
  }, [address]);

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

  const formatBalance = (val: bigint): string => {
    const whole = val / BigInt(1e18);
    const frac = val % BigInt(1e18);
    const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
    return `${whole}.${fracStr}`;
  };

  const circuitLabel = (circuit: CircuitType): string => {
    switch (circuit) {
      case CircuitType.RANGE_PROOF: return 'Range Proof';
      case CircuitType.BALANCE_SUFFICIENCY: return 'Balance Sufficiency';
      case CircuitType.COLLATERAL_RATIO: return 'Collateral Ratio';
      case CircuitType.DEBT_UPDATE_VALIDITY: return 'Debt Update';
      case CircuitType.ZERO_DEBT: return 'Zero Debt';
      case CircuitType.VAULT_SOLVENCY: return 'Vault Solvency';
      case CircuitType.CDP_SAFETY_BOUND: return 'CDP Safety';
      default: return String(circuit);
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

      {/* Solvency Cards */}
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

      {/* Aggregate Protocol Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Total Vault Deposits</span>
          <div className="text-xl font-bold text-gray-100 mt-1">
            {totalDeposited !== null ? formatBalance(totalDeposited) : '--'} BTC
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <span className="text-xs text-gray-400 uppercase tracking-wide">CDP Debt</span>
          <div className="text-xl font-bold text-gray-100 mt-1">
            Shielded
          </div>
          <span className="text-xs text-gray-500">Debt amounts are private (commitment-only)</span>
        </div>
      </div>

      <button
        onClick={fetchSolvencyData}
        disabled={!account || solvencyLoading}
        className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        {solvencyLoading ? 'Refreshing...' : 'Refresh Solvency Data'}
      </button>

      {/* Circuit Preloading */}
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

      {/* Proof History */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Proof History</h3>
          {proofHistory.length > 0 && (
            <span className="text-xs text-gray-500">{proofHistory.length} records</span>
          )}
        </div>
        {proofHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No proofs generated yet. Proofs are created when you shield, unshield, lock collateral, mint, or repay.
          </p>
        ) : (
          <div className="space-y-1">
            {proofHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-200">{circuitLabel(record.circuit)}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(record.timestamp).toLocaleString()}
                  </span>
                  {record.txHash && (
                    <span className="text-xs text-gray-600 font-mono">
                      tx: {record.txHash.slice(0, 10)}...
                    </span>
                  )}
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
