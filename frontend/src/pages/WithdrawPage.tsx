import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import { CircuitType } from '../lib/proofs/circuits';
import { findValidBlinding, computeCiphertextDelta } from '../lib/privacy/encrypt';
import { derivePublicKey } from '../lib/privacy/keygen';
import { generateNullifier, bytesToFelts, encodeGaragaCalldata } from '../lib/proofs/calldata';
import { loadVK } from '../lib/proofs/circuits';
import { withdraw, unshield } from '../lib/contracts/vault';
import { IS_DEVNET } from '../lib/contracts/config';
import { addProofRecord } from '../lib/proofHistory';
import { getLocalShieldedBalance, subtractShieldedBalance } from '../lib/shieldedBalance';
import type { BalanceSufficiencyWitness } from '../lib/proofs/witness';

/** On devnet, MockProofVerifier accepts anything — skip real proof generation */
const SKIP_PROOFS = IS_DEVNET;
const MOCK_PROOF = { proof: new Uint8Array([0xde, 0xad]), publicInputs: ['0x0'] };

export default function WithdrawPage() {
  const { account, address, isKeyUnlocked, privacyKey } = useWallet();
  const { balances, loading: balancesLoading, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();

  // Withdraw state
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unshield state
  const [unshieldAmount, setUnshieldAmount] = useState('');
  const [unshieldTxHash, setUnshieldTxHash] = useState<string | null>(null);
  const [unshieldTxError, setUnshieldTxError] = useState<string | null>(null);
  const [isUnshielding, setIsUnshielding] = useState(false);

  const handleWithdraw = async () => {
    if (!account || !address || !amount) return;
    setTxHash(null);
    setTxError(null);
    setIsSubmitting(true);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const hash = await withdraw(account, amountBig);
      setTxHash(hash);
      setAmount('');
      setTimeout(() => refresh(), 1000);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnshield = async () => {
    if (!account || !address || !unshieldAmount || !privacyKey) return;

    setUnshieldTxHash(null);
    setUnshieldTxError(null);
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

      setUnshieldTxHash(hash);
      setUnshieldAmount('');

      // Update local shielded balance tracker
      subtractShieldedBalance(address, amountBig);

      addProofRecord(address, {
        id: crypto.randomUUID(),
        circuit: CircuitType.BALANCE_SUFFICIENCY,
        status: 'verified',
        timestamp: Date.now(),
        txHash: hash,
      });

      setTimeout(() => refresh(), 1000);
    } catch (err) {
      setUnshieldTxError(err instanceof Error ? err.message : 'Unshield transaction failed');
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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-shield-600/10 border border-shield-500/20 flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
            <path d="M8 12V4M8 4l-3 3M8 4l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-shield-400" fill="none" />
            <path d="M3 14h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-shield-400" fill="none" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Withdraw</h2>
        <p className="text-gray-500 max-w-md">Connect your wallet to withdraw funds from the vault.</p>
      </div>
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
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-1">Withdraw</h2>
        <p className="text-gray-500">
          Withdraw public xyBTC from the vault back to your wallet, or unshield encrypted sxyBTC first.
        </p>
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

            {unshieldTxHash && (
              <div className="tx-success">
                <span className="text-emerald-400 font-medium">Unshield submitted </span>
                <span className="text-gray-400 font-mono text-xs break-all">{unshieldTxHash}</span>
              </div>
            )}

            {unshieldTxError && (
              <div className="tx-error">{unshieldTxError}</div>
            )}
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

      <button
        onClick={() => refresh()}
        disabled={balancesLoading}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2"
      >
        {balancesLoading && <span className="w-3 h-3 border border-gray-500/30 border-t-gray-500 rounded-full animate-spin" />}
        {balancesLoading ? 'Refreshing...' : 'Refresh Balances'}
      </button>
    </div>
  );
}
