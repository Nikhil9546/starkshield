import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import { CircuitType } from '../lib/proofs/circuits';
import { pedersenCommit, computeCiphertextDelta } from '../lib/privacy/encrypt';
import { generateNullifier } from '../lib/proofs/calldata';
import { withdraw, unshield } from '../lib/contracts/vault';
import type { BalanceSufficiencyWitness } from '../lib/proofs/witness';

type WithdrawAction = 'withdraw' | 'unshield';

export default function WithdrawPage() {
  const { account, address } = useWallet();
  const { balances, loading: balancesLoading, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();
  const [action, setAction] = useState<WithdrawAction>('withdraw');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!account || !address || !amount) return;
    setTxHash(null);
    setTxError(null);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const currentBalance = balances.vaultBalance || BigInt(0);
      const newBalance = currentBalance - amountBig;

      if (newBalance < BigInt(0)) {
        setTxError('Insufficient shielded balance');
        return;
      }

      const oldBlinding = BigInt(Math.floor(Math.random() * 1e15));
      const newBlinding = BigInt(Math.floor(Math.random() * 1e15));
      const oldCommitment = pedersenCommit(currentBalance, oldBlinding);
      const newCommitment = pedersenCommit(newBalance, newBlinding);

      const witness: BalanceSufficiencyWitness = {
        balance: currentBalance,
        amount: amountBig,
        balance_blinding: oldBlinding,
        new_balance_blinding: newBlinding,
        balance_commitment: oldCommitment,
        new_balance_commitment: newCommitment,
      };

      const proof = await prove({
        type: CircuitType.BALANCE_SUFFICIENCY,
        data: witness,
      });

      const pubKey = { x: BigInt(1), y: BigInt(1) }; // placeholder
      const delta = computeCiphertextDelta(amountBig, pubKey, false);
      const nullifier = generateNullifier();

      const params = {
        amount: amountBig,
        newCommitment,
        delta_c1: delta.delta_c1,
        delta_c2: delta.delta_c2,
        proofData: Array.from(proof.proof).map((b) => '0x' + b.toString(16)),
        publicInputs: proof.publicInputs,
        nullifier,
      };

      const hash = action === 'withdraw'
        ? await withdraw(account, params)
        : await unshield(account, params);

      setTxHash(hash);
      setAmount('');
      await refresh();
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed');
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Withdraw</h2>
      <p className="text-gray-400">
        Withdraw shielded sxyBTC or unshield back to public xyBTC tokens.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BalanceDisplay
          label="Shielded Balance"
          amount={balances.vaultBalance}
          symbol="sxyBTC"
          shielded
        />
        <BalanceDisplay
          label="Total Vault Deposits"
          amount={balances.totalDeposited}
          symbol="BTC"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAction('withdraw')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              action === 'withdraw'
                ? 'bg-shield-700/20 text-shield-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Withdraw (Shielded)
          </button>
          <button
            onClick={() => setAction('unshield')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              action === 'unshield'
                ? 'bg-shield-700/20 text-shield-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Unshield (Public)
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          {action === 'withdraw'
            ? 'Withdraw sxyBTC while keeping it shielded (encrypted balance).'
            : 'Convert sxyBTC back to public xyBTC. Your balance will be visible on-chain.'}
        </p>

        <div className="flex gap-3 mb-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (sxyBTC)"
            min="0"
            step="0.001"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-shield-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!amount || isProving || balancesLoading}
            className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
          >
            {isProving ? 'Proving...' : action === 'withdraw' ? 'Withdraw' : 'Unshield'}
          </button>
        </div>

        <ProofProgress progress={progress} error={proofError} />

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
    </div>
  );
}
