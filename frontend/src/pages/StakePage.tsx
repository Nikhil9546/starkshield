import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import { CircuitType } from '../lib/proofs/circuits';
import { encryptAmount, pedersenCommit } from '../lib/privacy/encrypt';
import { generateNullifier } from '../lib/proofs/calldata';
import { deposit } from '../lib/contracts/vault';
import type { RangeProofWitness } from '../lib/proofs/witness';

export default function StakePage() {
  const { account, address } = useWallet();
  const { balances, loading: balancesLoading, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!account || !address || !amount) return;

    setTxHash(null);
    setTxError(null);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const blinding = BigInt(Math.floor(Math.random() * 1e15));
      const commitment = pedersenCommit(amountBig, blinding);

      // Get user's public key from local storage (simplified — in production, load from encrypted storage)
      const pubKey = { x: BigInt(1), y: BigInt(1) }; // placeholder
      const { ciphertext } = encryptAmount(amountBig, pubKey);

      // Generate range proof
      const witness: RangeProofWitness = {
        value: amountBig,
        min_val: BigInt(1),
        max_val: BigInt(2) ** BigInt(64),
        blinding,
        commitment,
      };

      const proofResult = await prove({
        type: CircuitType.RANGE_PROOF,
        data: witness,
      });

      const nullifier = generateNullifier();

      const hash = await deposit(account, {
        amount: amountBig,
        commitment,
        ct_c1: ciphertext.c1.x,
        ct_c2: ciphertext.c2.x,
        proofData: Array.from(proofResult.proof).map((b) => '0x' + b.toString(16)),
        publicInputs: proofResult.publicInputs,
        nullifier,
      });

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
        <h2 className="text-2xl font-bold mb-4">Stake BTC</h2>
        <p className="text-gray-400">Connect your wallet to start staking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Stake BTC</h2>
      <p className="text-gray-400">
        Deposit BTC into the ShieldedVault. Your deposit is staked via Endur and wrapped
        into privacy-preserving sxyBTC.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceDisplay
          label="Shielded Balance"
          amount={balances.vaultBalance}
          symbol="sxyBTC"
          shielded
        />
        <BalanceDisplay
          label="Locked Collateral"
          amount={balances.lockedCollateral}
          symbol="sxyBTC"
        />
        <BalanceDisplay
          label="Total Vault Deposits"
          amount={balances.totalDeposited}
          symbol="BTC"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Deposit</h3>
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
            disabled={!amount || isProving || balancesLoading}
            className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
          >
            {isProving ? 'Proving...' : 'Deposit & Stake'}
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
