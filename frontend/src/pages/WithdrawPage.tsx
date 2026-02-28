import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import { useToast } from '../components/Toast';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import ObscuraLogo, { logoStyles } from '../components/ObscuraLogo';
import { CircuitType } from '../lib/proofs/circuits';
import { findValidBlinding, computeCiphertextDelta } from '../lib/privacy/encrypt';
import { derivePublicKey } from '../lib/privacy/keygen';
import { generateNullifier, bytesToFelts, encodeGaragaCalldata } from '../lib/proofs/calldata';
import { loadVK } from '../lib/proofs/circuits';
import { withdraw, unshield } from '../lib/contracts/vault';
import { IS_DEVNET } from '../lib/contracts/config';
import { addProofRecord } from '../lib/proofHistory';
import { getLocalShieldedBalance, subtractShieldedBalance, setShieldedWitnessState, clearShieldedWitnessState } from '../lib/shieldedBalance';
import type { BalanceSufficiencyWitness } from '../lib/proofs/witness';

/** On devnet, MockProofVerifier accepts anything — skip real proof generation */
const SKIP_PROOFS = IS_DEVNET;
const MOCK_PROOF = { proof: new Uint8Array([0xde, 0xad]), publicInputs: ['0x0'] };

// Page-specific styles
const pageStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-10px) rotate(-2deg); }
  }
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.1); opacity: 0.1; }
    100% { transform: scale(1); opacity: 0.3; }
  }
  @keyframes flow-up {
    0% { transform: translateY(10px); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateY(-10px); opacity: 0; }
  }
  .page-glow {
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(6,182,212,0.05) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .page-glow-secondary {
    position: fixed;
    bottom: -300px;
    right: -200px;
    width: 600px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(59,130,246,0.04) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .hero-icon {
    animation: float 6s ease-in-out infinite;
  }
  .hero-ring {
    animation: pulse-ring 3s ease-in-out infinite;
  }
  .page-title {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(24px, 3vw, 32px);
    font-weight: 900;
    letter-spacing: 1px;
  }
  .page-subtitle {
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    line-height: 1.7;
  }
  .gradient-text {
    background: linear-gradient(135deg, #fff 0%, #a5f3fc 50%, #22d3ee 100%);
    background-size: 200% 200%;
    animation: gradient-shift 8s ease infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .flow-particle {
    position: absolute;
    width: 3px;
    height: 3px;
    background: #22d3ee;
    border-radius: 50%;
    animation: flow-up 2s ease-in-out infinite;
    box-shadow: 0 0 6px #22d3ee;
  }
`;

export default function WithdrawPage() {
  const { account, address, isKeyUnlocked, privacyKey } = useWallet();
  const { balances, loading: balancesLoading, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();
  const toast = useToast();

  // Withdraw state
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unshield state
  const [unshieldAmount, setUnshieldAmount] = useState('');
  const [isUnshielding, setIsUnshielding] = useState(false);

  const handleWithdraw = async () => {
    if (!account || !address || !amount) return;
    setIsSubmitting(true);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const hash = await withdraw(account, amountBig);
      toast.success('Withdrawal successful', `tx: ${hash.slice(0, 20)}...`);
      setAmount('');
      setTimeout(() => refresh(), 1000);
    } catch (err) {
      toast.error('Withdrawal failed', err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnshield = async () => {
    if (!account || !address || !unshieldAmount || !privacyKey) return;

    setIsUnshielding(true);

    try {
      // Contract amount at 1e18 scale, circuit witness at 1e8 scale
      const amountBig = BigInt(Math.floor(parseFloat(unshieldAmount) * 1e18));
      const amountWitness = BigInt(Math.floor(parseFloat(unshieldAmount) * 1e8));
      const publicKey = derivePublicKey(privacyKey);

      // Use locally tracked shielded balance (1e18 scale), convert to 1e8 for circuit
      const localShielded = getLocalShieldedBalance(address);
      const currentBalance = localShielded / BigInt(1e10); // 1e18 → 1e8
      if (currentBalance === BigInt(0)) {
        throw new Error('No shielded balance tracked. Shield funds first on the Stake page.');
      }
      if (amountWitness > currentBalance) {
        throw new Error(`Insufficient shielded balance: have ${currentBalance}, need ${amountWitness}`);
      }
      const newBalance = currentBalance - amountWitness;

      // Find valid blindings that produce commitments within felt252 range
      const [balResult, amtResult, newBalResult] = await Promise.all([
        findValidBlinding(currentBalance, 100),
        findValidBlinding(amountWitness, 300),
        findValidBlinding(newBalance, 500),
      ]);

      // Build witness and generate proof
      const witness: BalanceSufficiencyWitness = {
        balance: currentBalance,
        amount: amountWitness,
        new_balance: newBalance,
        balance_blinding: balResult.blinding,
        amount_blinding: amtResult.blinding,
        new_balance_blinding: newBalResult.blinding,
        balance_commitment: balResult.commitment,
        amount_commitment: amtResult.commitment,
        new_balance_commitment: newBalResult.commitment,
      };

      const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.BALANCE_SUFFICIENCY, data: witness });

      // Compute ciphertext delta (isDeposit=false for unshield/subtraction)
      const delta = computeCiphertextDelta(amountBig, publicKey, false);
      const nullifier = generateNullifier();

      // Encode proof as Garaga calldata (real verification) or bytesToFelts (mock)
      let proofData: string[];
      if (SKIP_PROOFS) {
        proofData = bytesToFelts(proof.proof);
      } else {
        const vk = await loadVK(CircuitType.BALANCE_SUFFICIENCY);
        proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk);
      }

      // Call vault.unshield()
      const hash = await unshield(account, {
        amount: amountBig,
        newBalanceCommitment: newBalResult.commitment,
        ctDeltaC1: delta.delta_c1,
        ctDeltaC2: delta.delta_c2,
        proofData,
        nullifier,
      });

      toast.success('Unshield successful', `tx: ${hash.slice(0, 20)}...`);
      setUnshieldAmount('');

      // Update local shielded balance tracker
      subtractShieldedBalance(address, amountBig);

      // Update witness state so subsequent shields use the correct old commitment
      if (newBalance === BigInt(0)) {
        clearShieldedWitnessState(address);
      } else {
        setShieldedWitnessState(address, {
          balanceU64: newBalance,
          blinding: newBalResult.blinding,
          commitment: newBalResult.commitment,
        });
      }

      addProofRecord(address, {
        id: crypto.randomUUID(),
        circuit: CircuitType.BALANCE_SUFFICIENCY,
        status: 'verified',
        timestamp: Date.now(),
        txHash: hash,
      });

      setTimeout(() => refresh(), 1000);
    } catch (err) {
      toast.error('Unshield failed', err instanceof Error ? err.message : 'Transaction failed');
      if (address) {
        addProofRecord(address, {
          id: crypto.randomUUID(),
          circuit: CircuitType.BALANCE_SUFFICIENCY,
          status: 'failed',
          timestamp: Date.now(),
        });
      }
    } finally {
      setIsUnshielding(false);
    }
  };

  if (!address) {
    return (
      <>
        <style>{pageStyles}{logoStyles}</style>
        <div className="page-glow" />
        <div className="page-glow-secondary" />
        <div className="relative z-10 flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-8 hero-icon">
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-cyan-500/15 blur-2xl hero-ring" />
            <ObscuraLogo size={80} glow animated color="#06b6d4" />
          </div>
          <h2 className="page-title gradient-text mb-3">Withdraw</h2>
          <p className="page-subtitle max-w-md">Connect your wallet to withdraw funds from the vault.</p>
        </div>
      </>
    );
  }

  const formatBalance = (val: bigint | null): string => {
    if (val === null) return '\u2014';
    const whole = val / BigInt(1e18);
    const frac = val % BigInt(1e18);
    const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
    return `${whole}.${fracStr}`;
  };

  return (
    <>
      <style>{pageStyles}{logoStyles}</style>
      <div className="page-glow" />
      <div className="page-glow-secondary" />
      <div className="relative z-10 space-y-6">
      {/* Hero Header */}
      <div className="mb-8 flex items-start gap-5">
        <div className="relative flex-shrink-0 hero-icon">
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-cyan-500/15 blur-xl hero-ring" />
          <ObscuraLogo size={56} glow animated color="#06b6d4" />
        </div>
        <div>
          <h2 className="page-title gradient-text tracking-tight mb-1">Withdraw</h2>
          <p className="page-subtitle">
            Withdraw public xyBTC from the vault back to your wallet, or unshield encrypted sxyBTC first.
          </p>
        </div>
      </div>

      {/* Balance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceDisplay
          label="Public Balance"
          amount={formatBalance(balances.publicBalance)}
          symbol="xyBTC"
        />
        <BalanceDisplay
          label="Shielded Balance"
          amount={formatBalance(getLocalShieldedBalance(address))}
          symbol="sxyBTC"
          shielded
        />
        <BalanceDisplay
          label="Total Vault Deposits"
          amount={formatBalance(balances.totalDeposited)}
          symbol="BTC"
        />
      </div>

      {/* Unshield Section */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="section-title">Unshield</h3>
          <span className="badge-shield text-[10px]">ZK Proof Required</span>
        </div>
        <p className="text-xs text-gray-500">
          Convert encrypted sxyBTC back to public xyBTC balance. Requires privacy key and generates a ZK proof.
        </p>

        {!isKeyUnlocked ? (
          <div className="alert-warning">
            Privacy key must be unlocked to unshield funds. Go to <strong>Settings</strong> to unlock.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" className="text-shield-400" />
              </svg>
              Available: <span className="font-mono text-gray-300">{formatBalance(getLocalShieldedBalance(address))}</span> sxyBTC
            </div>

            <div className="flex gap-3">
              <input
                type="number"
                value={unshieldAmount}
                onChange={(e) => setUnshieldAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.001"
                className="input-field flex-1 font-mono"
              />
              <button
                onClick={handleUnshield}
                disabled={!unshieldAmount || isUnshielding || isProving || balancesLoading}
                className="btn-primary"
              >
                {isProving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Proving...
                  </span>
                ) : isUnshielding ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Unshielding...
                  </span>
                ) : 'Unshield'}
              </button>
            </div>

            <ProofProgress progress={progress} error={proofError} />
          </>
        )}
      </div>

      {/* Withdraw Section */}
      <div className="card space-y-4">
        <div>
          <h3 className="section-title">Withdraw Public Balance</h3>
          <p className="text-xs text-gray-500 mt-1">
            Withdraws public (unshielded) xyBTC from the vault back to your wallet. No ZK proof needed.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.001"
            className="input-field flex-1 font-mono"
          />
          <button
            onClick={handleWithdraw}
            disabled={!amount || isSubmitting || balancesLoading}
            className="btn-primary"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Withdrawing...
              </span>
            ) : 'Withdraw'}
          </button>
        </div>
      </div>

      <button
        onClick={() => refresh()}
        disabled={balancesLoading}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2"
      >
        {balancesLoading && <span className="w-3 h-3 border border-gray-500/30 border-t-gray-500 rounded-full animate-spin" />}
        {balancesLoading ? 'Refreshing...' : 'Refresh Balances'}
      </button>
      </div>
    </>
  );
}
