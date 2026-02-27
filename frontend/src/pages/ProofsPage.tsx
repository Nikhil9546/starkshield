import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import SolvencyCard from '../components/SolvencyCard';
import { CircuitType, preloadCircuits } from '../lib/proofs/circuits';
import { isVaultSolvent, getVaultLastVerified, isCdpSafe, getCdpLastVerified, getVaultNumAccounts, getVaultAssetsCommitment, getCdpNumCdps, getCdpCollateralCommitment, getProver, submitVaultSolvencyProof, submitCdpSafetyProof } from '../lib/contracts/solvency';
import { getTotalDeposited } from '../lib/contracts/vault';
import { loadProofHistory, type ProofRecord } from '../lib/proofHistory';

export default function ProofsPage() {
  const { account, address } = useWallet();
  const [preloading, setPreloading] = useState(false);
  const [preloaded, setPreloaded] = useState(false);

  // Solvency data from SolvencyProver contract
  const [vaultSolvency, setVaultSolvency] = useState<{ solvent: boolean | null; lastVerified: number | null; numAccounts: number | null; commitment: string | null }>({
    solvent: null, lastVerified: null, numAccounts: null, commitment: null,
  });
  const [cdpSafety, setCdpSafety] = useState<{ solvent: boolean | null; lastVerified: number | null; numCdps: number | null; commitment: string | null }>({
    solvent: null, lastVerified: null, numCdps: null, commitment: null,
  });
  const [proverAddr, setProverAddr] = useState<string | null>(null);

  // Aggregate protocol stats
  const [totalDeposited, setTotalDeposited] = useState<bigint | null>(null);

  // Proof history from localStorage
  const [proofHistory, setProofHistory] = useState<ProofRecord[]>([]);
  const [solvencyLoading, setSolvencyLoading] = useState(false);
  const [submittingSolvency, setSubmittingSolvency] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSolvencyData = useCallback(async () => {
    if (!account) return;
    setSolvencyLoading(true);

    try {
      const [vSolvent, vTimestamp, cSafe, cTimestamp, deposited, vAccounts, vCommitment, cNumCdps, cCommitment, prover] = await Promise.all([
        isVaultSolvent(account).catch(() => null),
        getVaultLastVerified(account).catch(() => null),
        isCdpSafe(account).catch(() => null),
        getCdpLastVerified(account).catch(() => null),
        getTotalDeposited(account).catch(() => null),
        getVaultNumAccounts(account).catch(() => null),
        getVaultAssetsCommitment(account).catch(() => null),
        getCdpNumCdps(account).catch(() => null),
        getCdpCollateralCommitment(account).catch(() => null),
        getProver(account).catch(() => null),
      ]);

      setVaultSolvency({ solvent: vSolvent, lastVerified: vTimestamp, numAccounts: vAccounts, commitment: vCommitment });
      setCdpSafety({ solvent: cSafe, lastVerified: cTimestamp, numCdps: cNumCdps, commitment: cCommitment });
      setTotalDeposited(deposited);
      setProverAddr(prover);
    } catch {
      // Silently fail — data stays as null/unknown
    } finally {
      setSolvencyLoading(false);
    }
  }, [account]);

  const [solvencyStage, setSolvencyStage] = useState('');

  const handleSubmitSolvency = useCallback(async () => {
    if (!account) return;
    setSubmittingSolvency(true);
    setSubmitResult(null);
    setSolvencyStage('');
    try {
      setSolvencyStage('Generating vault solvency proof...');
      const vaultTx = await submitVaultSolvencyProof(account, (p) => setSolvencyStage(p.message));

      setSolvencyStage('Generating CDP safety proof...');
      const cdpTx = await submitCdpSafetyProof(account, (p) => setSolvencyStage(p.message));

      setSolvencyStage('');
      setSubmitResult({
        success: true,
        message: `Proofs submitted! Vault tx: ${vaultTx.slice(0, 14)}... CDP tx: ${cdpTx.slice(0, 14)}...`,
      });
      // Refresh solvency data after submission
      await fetchSolvencyData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSubmitResult({ success: false, message: message.slice(0, 200) });
      setSolvencyStage('');
    } finally {
      setSubmittingSolvency(false);
    }
  }, [account, fetchSolvencyData]);

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

  const statusBadge = (status: ProofRecord['status']) => {
    switch (status) {
      case 'verified': return 'badge-green';
      case 'failed': return 'badge-red';
      case 'proving': return 'badge-shield';
      default: return 'badge bg-white/5 text-gray-500 border border-white/10';
    }
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-shield-600/10 border border-shield-500/20 flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-shield-400" fill="none" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Proofs Dashboard</h2>
        <p className="text-gray-500 max-w-md">Connect your wallet to view proof history and protocol solvency.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-1">Proofs Dashboard</h2>
        <p className="text-gray-500">
          Monitor ZK proof generation, verification status, and protocol solvency.
        </p>
      </div>

      {/* Solvency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SolvencyCard
          domain="vault"
          isSolvent={vaultSolvency.solvent}
          lastVerified={vaultSolvency.lastVerified}
          numAccounts={vaultSolvency.numAccounts}
          commitment={vaultSolvency.commitment}
          proverAddress={proverAddr}
        />
        <SolvencyCard
          domain="cdp"
          isSolvent={cdpSafety.solvent}
          lastVerified={cdpSafety.lastVerified}
          numAccounts={cdpSafety.numCdps}
          commitment={cdpSafety.commitment}
          proverAddress={proverAddr}
        />
      </div>

      {/* Protocol Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-hover">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Total Vault Deposits</span>
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {totalDeposited !== null ? formatBalance(totalDeposited) : '--'}
            <span className="text-sm text-gray-500 ml-1.5 font-normal">BTC</span>
          </div>
        </div>
        <div className="card-hover">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">CDP Debt</span>
            <span className="badge-shield text-[10px]">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="opacity-70">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              private
            </span>
          </div>
          <div className="text-xl font-bold text-white tracking-tight">Shielded</div>
          <span className="text-[11px] text-gray-600">Debt amounts are private (commitment-only)</span>
        </div>
      </div>

      {/* Submit Solvency Proofs + Refresh */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSubmitSolvency}
          disabled={!account || submittingSolvency}
          className="btn-primary text-sm"
        >
          {submittingSolvency ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {solvencyStage || 'Submitting...'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              Submit Solvency Proofs
            </span>
          )}
        </button>
        <button
          onClick={fetchSolvencyData}
          disabled={!account || solvencyLoading}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2"
        >
          {solvencyLoading && <span className="w-3 h-3 border border-gray-500/30 border-t-gray-500 rounded-full animate-spin" />}
          {solvencyLoading ? 'Refreshing...' : 'Refresh Solvency Data'}
        </button>
      </div>

      {submitResult && (
        <div className={submitResult.success ? 'tx-success' : 'tx-error'}>
          {submitResult.message}
        </div>
      )}

      {/* Circuit Preloading */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">Circuit Preloading</h3>
            <p className="text-xs text-gray-500 mt-1">
              Preloading circuits improves proof generation speed. Cached in memory for the session.
            </p>
          </div>
          <button
            onClick={handlePreload}
            disabled={preloading || preloaded}
            className={preloaded ? 'badge-green' : 'btn-secondary text-sm'}
          >
            {preloaded ? (
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                Circuits Ready
              </span>
            ) : preloading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                Loading...
              </span>
            ) : 'Preload Circuits'}
          </button>
        </div>
      </div>

      {/* Proof History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Proof History</h3>
          {proofHistory.length > 0 && (
            <span className="badge bg-white/5 text-gray-500 border border-white/10 text-[10px]">
              {proofHistory.length} records
            </span>
          )}
        </div>

        {proofHistory.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-gray-600" fill="none" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              No proofs generated yet. Proofs are created when you shield, unshield, lock collateral, mint, or repay.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {proofHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-white/[0.02] border-b border-white/[0.04] last:border-0 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] ${
                    record.status === 'verified' ? 'bg-emerald-500/10 text-emerald-400' :
                    record.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-shield-500/10 text-shield-400'
                  }`}>
                    {record.status === 'verified' ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : record.status === 'failed' ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                      </svg>
                    ) : (
                      <span className="w-3 h-3 border-2 border-shield-400/30 border-t-shield-400 rounded-full animate-spin" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm text-gray-200 font-medium">{circuitLabel(record.circuit)}</span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-gray-600">
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                      {record.txHash && (
                        <a
                          href={`https://sepolia.starkscan.co/tx/${record.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-shield-400 hover:text-shield-300 font-mono transition-colors"
                        >
                          tx: {record.txHash.slice(0, 10)}...
                        </a>
                      )}
                      {record.provingTimeMs && (
                        <span className="text-[11px] text-gray-600">
                          {(record.provingTimeMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {record.proofSizeBytes && (
                        <span className="text-[11px] text-gray-600">
                          {(record.proofSizeBytes / 1024).toFixed(1)}KB
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={statusBadge(record.status)}>
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
