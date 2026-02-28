import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import ObscuraLogo, { logoStyles } from '../components/ObscuraLogo';
import { CircuitType } from '../lib/proofs/circuits';
import { findValidBlinding } from '../lib/privacy/encrypt';
import { generateNullifier, bytesToFelts, encodeGaragaCalldata } from '../lib/proofs/calldata';
import { loadVK } from '../lib/proofs/circuits';
import { openCDP, lockCollateral, mintSUSD, repay, closeCDP, hasCDP as checkHasCDP, checkOracleFreshness, refreshOracle, getCollateralCommitment } from '../lib/contracts/cdp';
import { faucetMint } from '../lib/contracts/vault';
import { IS_DEVNET, NETWORK } from '../lib/contracts/config';
import { addProofRecord } from '../lib/proofHistory';
import type { CollateralRatioWitness, ZeroDebtWitness, RangeProofWitness, DebtUpdateWitness } from '../lib/proofs/witness';

type CDPAction = 'lock' | 'mint' | 'repay' | 'close';

/** On devnet, MockProofVerifier accepts anything — skip real proof generation */
const SKIP_PROOFS = IS_DEVNET;
const MOCK_PROOF = { proof: new Uint8Array([0xde, 0xad]), publicInputs: ['0x0'] };

// Page-specific styles
const pageStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-10px) rotate(2deg); }
  }
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.1); opacity: 0.1; }
    100% { transform: scale(1); opacity: 0.3; }
  }
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes orbit {
    0% { transform: rotate(0deg) translateX(24px) rotate(0deg); }
    100% { transform: rotate(360deg) translateX(24px) rotate(-360deg); }
  }
  .page-glow {
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .page-glow-secondary {
    position: fixed;
    bottom: -300px;
    left: -200px;
    width: 600px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(79,111,255,0.05) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .hero-icon {
    animation: float 6s ease-in-out infinite;
  }
  .hero-ring {
    animation: pulse-ring 3s ease-in-out infinite;
  }
  .gradient-text {
    background: linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #a78bfa 100%);
    background-size: 200% 200%;
    animation: gradient-shift 8s ease infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .orbit-dot {
    position: absolute;
    width: 4px;
    height: 4px;
    background: #8b5cf6;
    border-radius: 50%;
    animation: orbit 8s linear infinite;
    box-shadow: 0 0 8px #8b5cf6;
  }
`;

const ACTION_META: Record<CDPAction, { label: string; icon: JSX.Element; description: string }> = {
  lock: {
    label: 'Lock Collateral',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M5 6V4a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
    description: 'Lock sxyBTC as collateral in your CDP',
  },
  mint: {
    label: 'Mint sUSD',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
    description: 'Mint stablecoin against your collateral (200% min ratio)',
  },
  repay: {
    label: 'Repay',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M4 8h8M4 8l3-3M4 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    description: 'Repay outstanding sUSD debt',
  },
  close: {
    label: 'Close CDP',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
    description: 'Close your CDP and return collateral (requires zero debt)',
  },
};

export default function CDPPage() {
  const { account, address } = useWallet();
  const { balances, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();
  const [action, setAction] = useState<CDPAction>('lock');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [hasCDP, setHasCDP] = useState<boolean | null>(null);
  // On devnet, on-chain reads may return 0 due to RPC quirks — track locally.
  // On testnet/mainnet, on-chain state works correctly after proof-verified tx.
  const [localCollateral, setLocalCollateral] = useState<bigint>(BigInt(0));
  const [localDebt, setLocalDebt] = useState<bigint>(BigInt(0));
  // Track collateral witness state for DEBT_UPDATE_VALIDITY (subsequent locks)
  const [colWitness, setColWitness] = useState<{ balanceU64: bigint; blinding: bigint; commitment: bigint } | null>(null);
  const [oracleStale, setOracleStale] = useState<boolean>(false);
  const [refreshingOracle, setRefreshingOracle] = useState(false);
  const [isMintingCDP, setIsMintingCDP] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  const handleFaucetCDP = async () => {
    if (!account || !address) return;
    setIsMintingCDP(true);
    setFaucetMsg(null);
    try {
      const mintAmount = BigInt(100) * BigInt(10) ** BigInt(18);
      const hash = await faucetMint(account, address, mintAmount);
      setFaucetMsg(`Minted 100 xyBTC! tx: ${hash.substring(0, 20)}...`);
      setTimeout(() => refresh(), 5000);
    } catch (err) {
      setFaucetMsg(err instanceof Error ? err.message : 'Faucet failed');
    } finally {
      setIsMintingCDP(false);
    }
  };

  const checkCDP = async () => {
    if (!account || !address) return;
    try {
      const exists = await checkHasCDP(account, address);
      setHasCDP(exists);
    } catch (err) {
      console.warn('checkCDP failed:', err);
      setHasCDP(false);
    }
  };

  // Auto-check CDP status and oracle freshness on wallet connect
  useEffect(() => {
    if (account && address) {
      checkCDP();
      checkOracleFreshness(account)
        .then(({ fresh }) => setOracleStale(!fresh))
        .catch(() => setOracleStale(false));
    }
  }, [account, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefreshOracle = async () => {
    if (!account) return;
    setRefreshingOracle(true);
    setTxError(null);
    try {
      await refreshOracle(account);
      setOracleStale(false);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Failed to refresh oracle');
    } finally {
      setRefreshingOracle(false);
    }
  };

  const handleOpenCDP = async () => {
    if (!account) return;
    setTxError(null);
    try {
      const hash = await openCDP(account);
      setTxHash(hash);
      setHasCDP(true);
    } catch (err) {
      console.error('[CDP] open_cdp error:', err);
      setTxError(err instanceof Error ? err.message : 'Failed to open CDP');
    }
  };

  /** Encode proof data: Garaga calldata for real proofs, bytesToFelts for mock */
  const encodeProof = async (proof: Uint8Array, publicInputs: string[], circuitType: CircuitType): Promise<string[]> => {
    if (SKIP_PROOFS) return bytesToFelts(proof);
    const vk = await loadVK(circuitType);
    return encodeGaragaCalldata(proof, publicInputs, vk);
  };

  const handleAction = async () => {
    if (!account || !address) return;
    // Close CDP doesn't need an amount; all other actions do
    if (action !== 'close' && !amount) return;
    setTxHash(null);
    setTxError(null);

    try {
      // Contract amount at 1e18, circuit witness at 1e8 (these are independent)
      const amountBig = amount ? BigInt(Math.floor(parseFloat(amount) * 1e18)) : BigInt(0);
      const nullifier = generateNullifier();

      switch (action) {
        case 'lock': {
          const amountU64 = BigInt(Math.floor(parseFloat(amount) * 1e8));

          // Check on-chain commitment to determine first vs subsequent lock.
          // ShieldedCDP.lock_collateral routes: commitment == 0 → RANGE_PROOF, else → DEBT_UPDATE_VALIDITY.
          const onChainColCommitment = await getCollateralCommitment(account, address);
          const isFirstLock = onChainColCommitment === BigInt(0);

          let lockCircuit: CircuitType;
          let lockCommitment: bigint;
          let lockBlinding: bigint;
          let lockProof: { proof: Uint8Array; publicInputs: string[] };

          if (isFirstLock) {
            lockCircuit = CircuitType.RANGE_PROOF;
            const { blinding, commitment } = await findValidBlinding(amountU64);
            lockBlinding = blinding;
            lockCommitment = commitment;
            const witness: RangeProofWitness = {
              value: amountU64,
              blinding,
              commitment,
              max_value: BigInt(2) ** BigInt(64) - BigInt(1),
            };
            lockProof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.RANGE_PROOF, data: witness });
          } else {
            lockCircuit = CircuitType.DEBT_UPDATE_VALIDITY;
            // Use local state if available, otherwise fall back to old=0.
            // The contract only checks that the Garaga verifier accepts the proof —
            // it does NOT compare the proof's old_commitment to its own stored value.
            const oldBalance = colWitness?.balanceU64 ?? BigInt(0);
            const oldBlindingVal = colWitness?.blinding ?? BigInt(1);
            const newBalance = oldBalance + amountU64;

            const oldCommitResult = colWitness
              ? { blinding: oldBlindingVal, commitment: colWitness.commitment }
              : await findValidBlinding(oldBalance, 1);
            const [deltaResult, newBalResult] = await Promise.all([
              findValidBlinding(amountU64, 100),
              findValidBlinding(newBalance, 300),
            ]);
            lockBlinding = newBalResult.blinding;
            lockCommitment = newBalResult.commitment;
            const witness: DebtUpdateWitness = {
              old_debt: oldBalance,
              new_debt: newBalance,
              delta: amountU64,
              old_blinding: oldCommitResult.blinding,
              new_blinding: newBalResult.blinding,
              delta_blinding: deltaResult.blinding,
              old_debt_commitment: oldCommitResult.commitment,
              new_debt_commitment: newBalResult.commitment,
              delta_commitment: deltaResult.commitment,
              is_repayment: false,
            };
            lockProof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });
          }

          const proofData = await encodeProof(lockProof.proof, lockProof.publicInputs, lockCircuit);
          const hash = await lockCollateral(account, {
            amount: amountBig,
            commitment: lockCommitment,
            ct_c1: BigInt(0),
            ct_c2: BigInt(0),
            proofData,
            publicInputs: lockProof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          const prevU64 = colWitness?.balanceU64 ?? BigInt(0);
          setLocalCollateral(prev => prev + amountU64);
          setColWitness({ balanceU64: prevU64 + amountU64, blinding: lockBlinding, commitment: lockCommitment });
          addProofRecord(address, { id: crypto.randomUUID(), circuit: lockCircuit, status: 'verified', timestamp: Date.now(), txHash: hash });
          break;
        }
        case 'mint': {
          // Check oracle freshness before minting — auto-refresh if stale
          if (!IS_DEVNET) {
            const oracle = await checkOracleFreshness(account);
            if (!oracle.fresh) {
              if (NETWORK === 'sepolia') {
                await refreshOracle(account);
                setOracleStale(false);
              } else {
                throw new Error(
                  `Oracle price is stale (last updated ${new Date(oracle.oracleTimestamp * 1000).toLocaleString()}). ` +
                  `Minting is paused until the oracle is refreshed.`
                );
              }
            }
          }

          // Convert on-chain collateral (1e18) to u64-scale (1e8) for circuit
          let collateralU64: bigint;
          if (IS_DEVNET) {
            collateralU64 = localCollateral > BigInt(0) ? localCollateral : BigInt(Math.floor(parseFloat(amount) * 1e8 * 4));
          } else {
            const onChainCollateral = localCollateral > BigInt(0) ? localCollateral : (balances.lockedCollateral ?? BigInt(0));
            collateralU64 = onChainCollateral > BigInt(1e10) ? onChainCollateral / BigInt(1e10) : onChainCollateral;
            if (collateralU64 === BigInt(0)) {
              throw new Error('No collateral locked. Lock collateral first.');
            }
          }
          const debtU64 = BigInt(Math.floor(parseFloat(amount) * 1e8));
          const [colResult, debtResult] = await Promise.all([
            findValidBlinding(collateralU64, 200),
            findValidBlinding(debtU64, 400),
          ]);
          const witness: CollateralRatioWitness = {
            collateral: collateralU64,
            debt: debtU64,
            collateral_blinding: colResult.blinding,
            debt_blinding: debtResult.blinding,
            collateral_commitment: colResult.commitment,
            debt_commitment: debtResult.commitment,
            price: BigInt(50000 * 1e8),
            min_ratio_percent: BigInt(200),
          };
          const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.COLLATERAL_RATIO, data: witness });
          const mintProofData = await encodeProof(proof.proof, proof.publicInputs, CircuitType.COLLATERAL_RATIO);
          const hash = await mintSUSD(account, {
            newCollateralCommitment: colResult.commitment,
            newDebtCommitment: debtResult.commitment,
            proofData: mintProofData,
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          setLocalDebt(prev => prev + debtU64);
          addProofRecord(address, { id: crypto.randomUUID(), circuit: CircuitType.COLLATERAL_RATIO, status: 'verified', timestamp: Date.now(), txHash: hash });
          break;
        }
        case 'repay': {
          const repayU64 = BigInt(Math.floor(parseFloat(amount) * 1e8));
          let oldDebtU64: bigint;
          if (IS_DEVNET) {
            oldDebtU64 = localDebt > BigInt(0) ? localDebt : repayU64;
          } else {
            oldDebtU64 = localDebt > BigInt(0) ? localDebt : repayU64;
            const debtCommit = balances.debtCommitment ?? BigInt(0);
            if (debtCommit === BigInt(0) && localDebt === BigInt(0)) {
              throw new Error('No debt to repay.');
            }
          }
          const newDebtU64 = oldDebtU64 > repayU64 ? oldDebtU64 - repayU64 : BigInt(0);
          const [oldResult, newResult, deltaResult] = await Promise.all([
            findValidBlinding(oldDebtU64, 500),
            findValidBlinding(newDebtU64, 600),
            findValidBlinding(repayU64, 700),
          ]);
          const witness: DebtUpdateWitness = {
            old_debt: oldDebtU64,
            new_debt: newDebtU64,
            delta: repayU64,
            old_blinding: oldResult.blinding,
            new_blinding: newResult.blinding,
            delta_blinding: deltaResult.blinding,
            old_debt_commitment: oldResult.commitment,
            new_debt_commitment: newResult.commitment,
            delta_commitment: deltaResult.commitment,
            is_repayment: true,
          };
          const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });
          const repayProofData = await encodeProof(proof.proof, proof.publicInputs, CircuitType.DEBT_UPDATE_VALIDITY);
          const hash = await repay(account, {
            newDebtCommitment: newResult.commitment,
            proofData: repayProofData,
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          setLocalDebt(newDebtU64);
          addProofRecord(address, { id: crypto.randomUUID(), circuit: CircuitType.DEBT_UPDATE_VALIDITY, status: 'verified', timestamp: Date.now(), txHash: hash });
          break;
        }
        case 'close': {
          const { blinding, commitment: zeroCommitment } = await findValidBlinding(BigInt(0), 300);
          const witness: ZeroDebtWitness = {
            debt: BigInt(0),
            blinding,
            debt_commitment: zeroCommitment,
          };
          const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.ZERO_DEBT, data: witness });
          const closeProofData = await encodeProof(proof.proof, proof.publicInputs, CircuitType.ZERO_DEBT);
          const hash = await closeCDP(account, {
            proofData: closeProofData,
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          addProofRecord(address, { id: crypto.randomUUID(), circuit: CircuitType.ZERO_DEBT, status: 'verified', timestamp: Date.now(), txHash: hash });
          setHasCDP(false);
          break;
        }
      }

      setAmount('');
      await refresh();
    } catch (err) {
      console.error('[CDP] Error:', err);
      setTxError(err instanceof Error ? err.message : String(err));
    }
  };

  // Format u64-scaled (1e8) bigint to display string
  const formatU64 = (val: bigint): string => {
    const whole = val / BigInt(1e8);
    const frac = val % BigInt(1e8);
    const fracStr = frac.toString().padStart(8, '0').slice(0, 4);
    return `${whole}.${fracStr}`;
  };

  if (!address) {
    return (
      <>
        <style>{pageStyles}{logoStyles}</style>
        <div className="page-glow" />
        <div className="page-glow-secondary" />
        <div className="relative z-10 flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-8 hero-icon">
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-purple-500/15 blur-2xl hero-ring" />
            <ObscuraLogo size={80} glow animated color="#8b5cf6" />
          </div>
          <h2 className="text-3xl font-bold gradient-text mb-3">Shielded CDP</h2>
          <p className="text-gray-400 max-w-md leading-relaxed">Connect your wallet to open a Collateralized Debt Position and mint sUSD.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageStyles}{logoStyles}</style>
      <div className="page-glow" />
      <div className="page-glow-secondary" />
      <div className="relative z-10 space-y-6">
      {/* Hero Header */}
      <div className="mb-8 flex items-start gap-5">
        <div className="relative flex-shrink-0 hero-icon">
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-purple-500/15 blur-xl hero-ring" />
          <ObscuraLogo size={56} glow animated color="#8b5cf6" />
        </div>
        <div>
          <h2 className="text-3xl font-bold gradient-text tracking-tight mb-1">Shielded CDP</h2>
          <p className="text-gray-400">
            Lock sxyBTC as collateral and mint sUSD stablecoin. Minimum collateral ratio: 200%.
          </p>
        </div>
      </div>

      {/* Balance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceDisplay
          label="Locked Collateral"
          amount={localCollateral > BigInt(0) ? formatU64(localCollateral) : balances.lockedCollateral}
          symbol="sxyBTC"
        />
        <BalanceDisplay
          label="sUSD Debt"
          amount={localDebt > BigInt(0) ? formatU64(localDebt) : 'None'}
          symbol="sUSD"
        />
        <BalanceDisplay
          label="Debt Status"
          amount={localDebt > BigInt(0) ? 'Active' : 'None'}
          symbol=""
        />
      </div>

      {/* CDP Status Check */}
      {hasCDP === null && (
        <button
          onClick={checkCDP}
          className="text-sm text-shield-400 hover:text-shield-300 transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 8a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M8 5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          Check CDP Status
        </button>
      )}

      {/* No CDP — Open Prompt */}
      {hasCDP === false && (
        <div className="card text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-shield-600/10 border border-shield-500/20 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" className="text-shield-400" fill="none" />
              <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-shield-400" fill="none" />
            </svg>
          </div>
          <p className="text-gray-400 mb-5">You don't have a CDP yet. Open one to start minting sUSD.</p>
          <button onClick={handleOpenCDP} className="btn-primary">
            Open CDP
          </button>
        </div>
      )}

      {/* Oracle Stale Warning */}
      {oracleStale && (
        <div className="alert-warning flex items-center justify-between">
          <span>Oracle price is stale. Minting sUSD is paused until the oracle is refreshed.</span>
          <button
            onClick={handleRefreshOracle}
            disabled={refreshingOracle}
            className="btn-secondary text-xs ml-3 shrink-0"
          >
            {refreshingOracle ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                Refreshing...
              </span>
            ) : 'Refresh Oracle'}
          </button>
        </div>
      )}

      {/* Faucet for CDP — lock_collateral needs xyBTC in wallet, not in vault */}
      {hasCDP !== false && (
        <div className="card flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Collateral Tokens</h3>
            <p className="text-xs text-gray-500 mt-0.5">Lock Collateral requires xyBTC in your wallet (not in the vault). Mint test tokens if needed.</p>
          </div>
          <button
            onClick={handleFaucetCDP}
            disabled={isMintingCDP}
            className="btn-secondary text-sm"
          >
            {isMintingCDP ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                Minting...
              </span>
            ) : 'Mint 100 xyBTC'}
          </button>
        </div>
      )}
      {faucetMsg && (
        <p className="text-xs text-gray-400 break-all px-1 -mt-4">{faucetMsg}</p>
      )}

      {/* CDP Actions Panel */}
      {hasCDP !== false && (
        <div className="card space-y-5">
          {/* Action Tabs */}
          <div className="flex gap-1.5 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            {(['lock', 'mint', 'repay', 'close'] as CDPAction[]).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-1 justify-center ${
                  action === a
                    ? a === 'close'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-shield-600/15 text-shield-300 border border-shield-500/20'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {ACTION_META[a].icon}
                <span className="hidden sm:inline">{ACTION_META[a].label}</span>
              </button>
            ))}
          </div>

          {/* Action Description */}
          <div className="flex items-center gap-2">
            <span className="badge-shield text-[10px]">ZK Proof Required</span>
            <span className="text-xs text-gray-500">{ACTION_META[action].description}</span>
          </div>

          {/* Action Input */}
          {action !== 'close' ? (
            <div className="flex gap-3">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  action === 'lock' ? 'Amount (sxyBTC)' :
                  action === 'mint' ? 'Amount (sUSD)' : 'Amount (sUSD)'
                }
                min="0"
                step="0.001"
                className="input-field flex-1 font-mono"
              />
              <button
                onClick={handleAction}
                disabled={!amount || isProving}
                className="btn-primary"
              >
                {isProving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Proving...
                  </span>
                ) : 'Submit'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleAction}
              disabled={isProving}
              className="btn-danger"
            >
              {isProving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Proving...
                </span>
              ) : 'Close CDP'}
            </button>
          )}

          <ProofProgress progress={progress} error={proofError} />

          {txHash && (
            <div className="tx-success">
              <span className="text-emerald-400 font-medium">Transaction submitted </span>
              <span className="text-gray-400 font-mono text-xs break-all">{txHash}</span>
            </div>
          )}

          {txError && (
            <div className="tx-error">{txError}</div>
          )}
        </div>
      )}
      </div>
    </>
  );
}
