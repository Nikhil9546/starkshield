import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import { CircuitType } from '../lib/proofs/circuits';
import { pedersenHashNoir, computeCiphertextDelta } from '../lib/privacy/encrypt';
import { derivePublicKey } from '../lib/privacy/keygen';
import { generateNullifier } from '../lib/proofs/calldata';
import { deposit, shield } from '../lib/contracts/vault';
import { addProofRecord } from '../lib/proofHistory';
import type { RangeProofWitness } from '../lib/proofs/witness';

export default function StakePage() {
  const { account, address, isKeyUnlocked, privacyKey } = useWallet();
  const { balances, loading: balancesLoading, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();

  // Deposit state
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shield state
  const [shieldAmount, setShieldAmount] = useState('');
  const [shieldTxHash, setShieldTxHash] = useState<string | null>(null);
  const [shieldTxError, setShieldTxError] = useState<string | null>(null);
  const [isShielding, setIsShielding] = useState(false);

  const handleDeposit = async () => {
    if (!account || !address || !amount) return;

    setTxHash(null);
    setTxError(null);
    setIsSubmitting(true);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const hash = await deposit(account, amountBig);
      setTxHash(hash);
      setAmount('');
      setTimeout(() => refresh(), 1000);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShield = async () => {
    if (!account || !address || !shieldAmount || !privacyKey) return;

    setShieldTxHash(null);
    setShieldTxError(null);
    setIsShielding(true);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(shieldAmount) * 1e18));
      const publicKey = derivePublicKey(privacyKey);

      // Shield uses range_proof circuit (not balance_sufficiency).
      // balance_sufficiency is for withdrawals (proves balance >= amount).
      // For shielding, the on-chain contract checks public_balance >= amount;
      // we just prove the amount is valid and properly committed.
      const MAX_U64 = BigInt(2) ** BigInt(64) - BigInt(1);
      const amountWitness = BigInt(Math.floor(parseFloat(shieldAmount) * 1e8));

      const blinding = BigInt(Math.floor(Math.random() * 1e15));
      const commitment = await pedersenHashNoir(amountWitness, blinding);

      const witness: RangeProofWitness = {
        value: amountWitness,
        blinding,
        commitment,
        max_value: MAX_U64,
      };

      const proof = await prove({ type: CircuitType.RANGE_PROOF, data: witness });

      // Compute ciphertext delta (isDeposit=true for shield)
      const delta = computeCiphertextDelta(amountBig, publicKey, true);
      const nullifier = generateNullifier();

      // Call vault.shield()
      const hash = await shield(account, {
        amount: amountBig,
        newBalanceCommitment: commitment,
        ctDeltaC1: delta.delta_c1,
        ctDeltaC2: delta.delta_c2,
        proofData: Array.from(proof.proof).map((b) => '0x' + b.toString(16)),
        nullifier,
      });

      setShieldTxHash(hash);
      setShieldAmount('');

      addProofRecord(address, {
        id: crypto.randomUUID(),
        circuit: CircuitType.RANGE_PROOF,
        status: 'verified',
        timestamp: Date.now(),
        txHash: hash,
      });

      setTimeout(() => refresh(), 1000);
    } catch (err) {
      setShieldTxError(err instanceof Error ? err.message : 'Shield transaction failed');
      if (address) {
        addProofRecord(address, {
          id: crypto.randomUUID(),
          circuit: CircuitType.RANGE_PROOF,
          status: 'failed',
          timestamp: Date.now(),
        });
      }
    } finally {
      setIsShielding(false);
    }
  };

  if (!address) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Stake BTC</h2>
        <p className="text-gray-400">Connect your wallet to start staking.</p>
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
      <h2 className="text-2xl font-bold">Stake BTC</h2>
      <p className="text-gray-400">
        Deposit BTC into the ShieldedVault. Your deposit is staked via Endur and wrapped
        into privacy-preserving sxyBTC.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <BalanceDisplay
          label="Public Balance"
          amount={formatBalance(balances.publicBalance)}
          symbol="xyBTC"
        />
        <BalanceDisplay
          label="Shielded Balance"
          amount={balances.vaultBalance !== null ? formatBalance(balances.vaultBalance) : (isKeyUnlocked ? 'Decrypting...' : 'Locked')}
          symbol="sxyBTC"
          shielded
        />
        <BalanceDisplay
          label="Locked Collateral"
          amount={formatBalance(balances.lockedCollateral)}
          symbol="sxyBTC"
        />
        <BalanceDisplay
          label="Total Vault Deposits"
          amount={formatBalance(balances.totalDeposited)}
          symbol="BTC"
        />
      </div>

      {!isKeyUnlocked && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 text-sm text-yellow-300">
          Privacy key locked. Go to <strong>Settings</strong> to generate or unlock your key to see decrypted shielded balances.
        </div>
      )}

      {balances.hasCDP && (
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-300">
          You have an active CDP with {formatBalance(balances.susdBalance)} sUSD minted.
        </div>
      )}

      {/* Deposit Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Deposit</h3>
        <p className="text-xs text-gray-500 mb-3">
          Deposits xyBTC into the vault as public balance. No ZK proof needed for public deposits.
        </p>
        <div className="flex gap-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (BTC)"
            min="0"
            step="0.001"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-shield-500"
          />
          <button
            onClick={handleDeposit}
            disabled={!amount || isSubmitting || balancesLoading}
            className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
          >
            {isSubmitting ? 'Depositing...' : 'Deposit & Stake'}
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

      {/* Shield Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Shield</h3>
        <p className="text-xs text-gray-500 mb-3">
          Convert public balance to encrypted sxyBTC. Requires privacy key and generates a ZK proof.
        </p>

        {!isKeyUnlocked ? (
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 text-sm text-yellow-300">
            Privacy key must be unlocked to shield funds. Go to <strong>Settings</strong> to unlock.
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <input
                type="number"
                value={shieldAmount}
                onChange={(e) => setShieldAmount(e.target.value)}
                placeholder="Amount to shield (xyBTC)"
                min="0"
                step="0.001"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-shield-500"
              />
              <button
                onClick={handleShield}
                disabled={!shieldAmount || isShielding || isProving || balancesLoading}
                className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
              >
                {isProving ? 'Proving...' : isShielding ? 'Shielding...' : 'Shield'}
              </button>
            </div>

            <ProofProgress progress={progress} error={proofError} />

            {shieldTxHash && (
              <div className="mt-4 p-3 bg-green-900/20 border border-green-800/50 rounded text-sm">
                <span className="text-green-400">Shield transaction submitted: </span>
                <span className="text-gray-300 font-mono text-xs break-all">{shieldTxHash}</span>
              </div>
            )}

            {shieldTxError && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded text-sm text-red-400">
                {shieldTxError}
              </div>
            )}
          </>
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
