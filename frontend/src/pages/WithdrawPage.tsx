import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import { CircuitType } from '../lib/proofs/circuits';
import { pedersenHashNoir, toStarkFelt, computeCiphertextDelta } from '../lib/privacy/encrypt';
import { derivePublicKey } from '../lib/privacy/keygen';
import { generateNullifier, bytesToFelts } from '../lib/proofs/calldata';
import { withdraw, unshield } from '../lib/contracts/vault';
import { addProofRecord } from '../lib/proofHistory';
import { getLocalShieldedBalance, subtractShieldedBalance } from '../lib/shieldedBalance';
import type { BalanceSufficiencyWitness } from '../lib/proofs/witness';

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
      const amountBig = BigInt(Math.floor(parseFloat(unshieldAmount) * 1e18));
      const publicKey = derivePublicKey(privacyKey);

      // Circuit uses u64 for amounts — scale to 1e8
      const amountWitness = BigInt(Math.floor(parseFloat(unshieldAmount) * 1e8));

      // Use locally tracked shielded balance (devnet decryption returns garbage)
      const localShielded = getLocalShieldedBalance(address);
      // Convert 1e18-scale local balance to 1e8-scale for circuit witness
      const currentBalance = localShielded / BigInt(1e10);
      if (currentBalance === BigInt(0)) {
        throw new Error('No shielded balance tracked. Shield funds first on the Stake page.');
      }
      if (amountWitness > currentBalance) {
        throw new Error(`Insufficient shielded balance: have ${currentBalance}, need ${amountWitness}`);
      }
      const newBalance = currentBalance - amountWitness;

      // Generate blindings
      const balanceBlinding = BigInt(Math.floor(Math.random() * 1e15));
      const amountBlinding = BigInt(Math.floor(Math.random() * 1e15));
      const newBalanceBlinding = BigInt(Math.floor(Math.random() * 1e15));

      // Compute commitments using real Barretenberg Pedersen hash (matches Noir circuit)
      const [balanceCommitment, amountCommitment, newBalanceCommitment] = await Promise.all([
        pedersenHashNoir(currentBalance, balanceBlinding),
        pedersenHashNoir(amountWitness, amountBlinding),
        pedersenHashNoir(newBalance, newBalanceBlinding),
      ]);

      // Build witness and generate proof
      const witness: BalanceSufficiencyWitness = {
        balance: currentBalance,
        amount: amountWitness,
        new_balance: newBalance,
        balance_blinding: balanceBlinding,
        amount_blinding: amountBlinding,
        new_balance_blinding: newBalanceBlinding,
        balance_commitment: balanceCommitment,
        amount_commitment: amountCommitment,
        new_balance_commitment: newBalanceCommitment,
      };

      const proof = await prove({ type: CircuitType.BALANCE_SUFFICIENCY, data: witness });

      // Compute ciphertext delta (isDeposit=false for unshield/subtraction)
      const delta = computeCiphertextDelta(amountBig, publicKey, false);
      const nullifier = generateNullifier();

      // Call vault.unshield()
      const hash = await unshield(account, {
        amount: amountBig,
        newBalanceCommitment: toStarkFelt(newBalanceCommitment),
        ctDeltaC1: delta.delta_c1,
        ctDeltaC2: delta.delta_c2,
        proofData: bytesToFelts(proof.proof),
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
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Withdraw</h2>
        <p className="text-gray-400">Connect your wallet to withdraw.</p>
      </div>
    );
  }

  const formatBalance = (val: bigint | null): string => {
    if (val === null) return '—';
    const whole = val / BigInt(1e18);
    const frac = val % BigInt(1e18);
    const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
    return `${whole}.${fracStr}`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Withdraw</h2>
      <p className="text-gray-400">
        Withdraw public xyBTC from the vault back to your wallet, or unshield encrypted sxyBTC first.
      </p>

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
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Unshield Encrypted Balance</h3>
        <p className="text-xs text-gray-500 mb-4">
          Convert encrypted sxyBTC back to public xyBTC balance. Requires privacy key and generates a ZK proof.
        </p>

        {!isKeyUnlocked ? (
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 text-sm text-yellow-300">
            Privacy key must be unlocked to unshield funds. Go to <strong>Settings</strong> to unlock.
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-400 mb-3">
              Available shielded balance: {formatBalance(getLocalShieldedBalance(address))} sxyBTC
            </div>

            <div className="flex gap-3 mb-4">
              <input
                type="number"
                value={unshieldAmount}
                onChange={(e) => setUnshieldAmount(e.target.value)}
                placeholder="Amount to unshield (sxyBTC)"
                min="0"
                step="0.001"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-shield-500"
              />
              <button
                onClick={handleUnshield}
                disabled={!unshieldAmount || isUnshielding || isProving || balancesLoading}
                className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
              >
                {isProving ? 'Proving...' : isUnshielding ? 'Unshielding...' : 'Unshield'}
              </button>
            </div>

            <ProofProgress progress={progress} error={proofError} />

            {unshieldTxHash && (
              <div className="mt-4 p-3 bg-green-900/20 border border-green-800/50 rounded text-sm">
                <span className="text-green-400">Unshield transaction submitted: </span>
                <span className="text-gray-300 font-mono text-xs break-all">{unshieldTxHash}</span>
              </div>
            )}

            {unshieldTxError && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded text-sm text-red-400">
                {unshieldTxError}
              </div>
            )}
          </>
        )}
      </div>

      {/* Withdraw Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Withdraw Public Balance</h3>
        <p className="text-xs text-gray-500 mb-4">
          Withdraws public (unshielded) xyBTC from the vault back to your wallet. No ZK proof needed.
        </p>

        <div className="flex gap-3 mb-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (xyBTC)"
            min="0"
            step="0.001"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-shield-500"
          />
          <button
            onClick={handleWithdraw}
            disabled={!amount || isSubmitting || balancesLoading}
            className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
          >
            {isSubmitting ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>

        {txHash && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-800/50 rounded text-sm">
            <span className="text-green-400">Transaction submitted: </span>
            <span className="text-gray-300 font-mono text-xs break-all">{txHash}</span>
          </div>
        )}

        {txError && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded text-sm text-red-400">
            {txError}
          </div>
        )}
      </div>

      <button
        onClick={() => refresh()}
        disabled={balancesLoading}
        className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        {balancesLoading ? 'Refreshing...' : 'Refresh Balances'}
      </button>
    </div>
  );
}
