import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import { CircuitType } from '../lib/proofs/circuits';
import { pedersenCommit } from '../lib/privacy/encrypt';
import { generateNullifier } from '../lib/proofs/calldata';
import { openCDP, lockCollateral, mintSUSD, repay, closeCDP, getCDPExists } from '../lib/contracts/cdp';
import type { CollateralRatioWitness, ZeroDebtWitness, RangeProofWitness, DebtUpdateWitness } from '../lib/proofs/witness';

type CDPAction = 'lock' | 'mint' | 'repay' | 'close';

export default function CDPPage() {
  const { account, address } = useWallet();
  const { balances, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();
  const [action, setAction] = useState<CDPAction>('lock');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [hasCDP, setHasCDP] = useState<boolean | null>(null);

  const checkCDP = async () => {
    if (!account || !address) return;
    try {
      const exists = await getCDPExists(account, address);
      setHasCDP(exists);
    } catch {
      setHasCDP(null);
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
      setTxError(err instanceof Error ? err.message : 'Failed to open CDP');
    }
  };

  const handleAction = async () => {
    if (!account || !address || !amount) return;
    setTxHash(null);
    setTxError(null);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const blinding = BigInt(Math.floor(Math.random() * 1e15));
      const nullifier = generateNullifier();

      switch (action) {
        case 'lock': {
          const commitment = pedersenCommit(amountBig, blinding);
          const witness: RangeProofWitness = {
            value: amountBig,
            min_val: BigInt(1),
            max_val: BigInt(2) ** BigInt(64),
            blinding,
            commitment,
          };
          const proof = await prove({ type: CircuitType.RANGE_PROOF, data: witness });
          const hash = await lockCollateral(account, {
            amount: amountBig,
            commitment,
            ct_c1: BigInt(0),
            ct_c2: BigInt(0),
            proofData: Array.from(proof.proof).map((b) => '0x' + b.toString(16)),
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          break;
        }
        case 'mint': {
          const collateralCommitment = pedersenCommit(balances.lockedCollateral || BigInt(0), blinding);
          const debtBlinding = BigInt(Math.floor(Math.random() * 1e15));
          const debtCommitment = pedersenCommit(amountBig, debtBlinding);
          const witness: CollateralRatioWitness = {
            collateral_value: balances.lockedCollateral || BigInt(0),
            debt_value: (balances.debt || BigInt(0)) + amountBig,
            min_ratio: BigInt(200),
            price: BigInt(50000 * 1e8), // placeholder price
            collateral_blinding: blinding,
            debt_blinding: debtBlinding,
            collateral_commitment: collateralCommitment,
            debt_commitment: debtCommitment,
          };
          const proof = await prove({ type: CircuitType.COLLATERAL_RATIO, data: witness });
          const hash = await mintSUSD(account, {
            amount: amountBig,
            newCollateralCommitment: collateralCommitment,
            newDebtCommitment: debtCommitment,
            proofData: Array.from(proof.proof).map((b) => '0x' + b.toString(16)),
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          break;
        }
        case 'repay': {
          const newDebt = (balances.debt || BigInt(0)) - amountBig;
          const newBlinding = BigInt(Math.floor(Math.random() * 1e15));
          const oldCommitment = pedersenCommit(balances.debt || BigInt(0), blinding);
          const newCommitment = pedersenCommit(newDebt, newBlinding);
          const witness: DebtUpdateWitness = {
            old_debt: balances.debt || BigInt(0),
            new_debt: newDebt,
            delta: amountBig,
            is_increase: false,
            old_blinding: blinding,
            new_blinding: newBlinding,
            old_commitment: oldCommitment,
            new_commitment: newCommitment,
          };
          const proof = await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });
          const hash = await repay(account, {
            amount: amountBig,
            newDebtCommitment: newCommitment,
            proofData: Array.from(proof.proof).map((b) => '0x' + b.toString(16)),
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          break;
        }
        case 'close': {
          const zeroCommitment = pedersenCommit(BigInt(0), blinding);
          const witness: ZeroDebtWitness = {
            debt: BigInt(0),
            blinding,
            commitment: zeroCommitment,
          };
          const proof = await prove({ type: CircuitType.ZERO_DEBT, data: witness });
          const hash = await closeCDP(account, {
            proofData: Array.from(proof.proof).map((b) => '0x' + b.toString(16)),
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          setHasCDP(false);
          break;
        }
      }

      setAmount('');
      await refresh();
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  if (!address) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Shielded CDP</h2>
        <p className="text-gray-400">Connect your wallet to manage your CDP.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Shielded CDP</h2>
      <p className="text-gray-400">
        Lock sxyBTC as collateral and mint sUSD stablecoin. Minimum collateral ratio: 200%.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceDisplay
          label="Locked Collateral"
          amount={balances.lockedCollateral}
          symbol="sxyBTC"
        />
        <BalanceDisplay
          label="Debt"
          amount={balances.debt}
          symbol="sUSD"
        />
        <BalanceDisplay
          label="sUSD Balance"
          amount={balances.susdBalance}
          symbol="sUSD"
        />
      </div>

      {hasCDP === null && (
        <button
          onClick={checkCDP}
          className="text-sm text-shield-400 hover:text-shield-300 transition-colors"
        >
          Check CDP Status
        </button>
      )}

      {hasCDP === false && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-4">You don't have a CDP yet.</p>
          <button
            onClick={handleOpenCDP}
            className="bg-shield-600 hover:bg-shield-500 text-white font-medium px-6 py-2 rounded transition-colors"
          >
            Open CDP
          </button>
        </div>
      )}

      {hasCDP !== false && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex gap-2 mb-4">
            {(['lock', 'mint', 'repay', 'close'] as CDPAction[]).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  action === a
                    ? 'bg-shield-700/20 text-shield-300'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {a === 'lock' ? 'Lock Collateral' :
                 a === 'mint' ? 'Mint sUSD' :
                 a === 'repay' ? 'Repay' : 'Close CDP'}
              </button>
            ))}
          </div>

          {action !== 'close' && (
            <div className="flex gap-3 mb-4">
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
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-shield-500"
              />
              <button
                onClick={handleAction}
                disabled={!amount || isProving}
                className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
              >
                {isProving ? 'Proving...' : 'Submit'}
              </button>
            </div>
          )}

          {action === 'close' && (
            <button
              onClick={handleAction}
              disabled={isProving}
              className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2 rounded transition-colors"
            >
              {isProving ? 'Proving...' : 'Close CDP'}
            </button>
          )}

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
      )}
    </div>
  );
}
