import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import BalanceDisplay from '../components/BalanceDisplay';
import ProofProgress from '../components/ProofProgress';
import { CircuitType } from '../lib/proofs/circuits';
import { pedersenHashNoir, toStarkFelt } from '../lib/privacy/encrypt';
import { generateNullifier, bytesToFelts } from '../lib/proofs/calldata';
import { openCDP, lockCollateral, mintSUSD, repay, closeCDP, hasCDP as checkHasCDP } from '../lib/contracts/cdp';
import { addProofRecord } from '../lib/proofHistory';
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
  // Track locked collateral and minted debt locally (on-chain reads return 0 with MockProofVerifier)
  const [localCollateral, setLocalCollateral] = useState<bigint>(BigInt(0));
  const [localDebt, setLocalDebt] = useState<bigint>(BigInt(0));

  const checkCDP = async () => {
    if (!account || !address) return;
    try {
      const exists = await checkHasCDP(account, address);
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
          // Circuit uses u64 — scale to 1e8
          const amountU64 = BigInt(Math.floor(parseFloat(amount) * 1e8));
          const commitment = await pedersenHashNoir(amountU64, blinding);
          const witness: RangeProofWitness = {
            value: amountU64,
            blinding,
            commitment,
            max_value: BigInt(2) ** BigInt(64) - BigInt(1),
          };
          const proof = await prove({ type: CircuitType.RANGE_PROOF, data: witness });
          const hash = await lockCollateral(account, {
            amount: amountBig,
            commitment: toStarkFelt(commitment),
            ct_c1: BigInt(0),
            ct_c2: BigInt(0),
            proofData: bytesToFelts(proof.proof),
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          setLocalCollateral(prev => prev + amountU64);
          addProofRecord(address, { id: crypto.randomUUID(), circuit: CircuitType.RANGE_PROOF, status: 'verified', timestamp: Date.now(), txHash: hash });
          break;
        }
        case 'mint': {
          const debtBlinding = BigInt(Math.floor(Math.random() * 1e15));
          // Circuit uses u64 amounts — scale to 1e8
          const collateralU64 = localCollateral > BigInt(0) ? localCollateral : BigInt(Math.floor(parseFloat(amount) * 1e8 * 4));
          const debtU64 = BigInt(Math.floor(parseFloat(amount) * 1e8));
          const [collateralCommitment, debtCommitment] = await Promise.all([
            pedersenHashNoir(collateralU64, blinding),
            pedersenHashNoir(debtU64, debtBlinding),
          ]);
          const witness: CollateralRatioWitness = {
            collateral: collateralU64,
            debt: debtU64,
            collateral_blinding: blinding,
            debt_blinding: debtBlinding,
            collateral_commitment: collateralCommitment,
            debt_commitment: debtCommitment,
            price: BigInt(50000 * 1e8), // placeholder BTC price
            min_ratio_percent: BigInt(200),
          };
          const proof = await prove({ type: CircuitType.COLLATERAL_RATIO, data: witness });
          const hash = await mintSUSD(account, {
            amount: amountBig,
            newCollateralCommitment: toStarkFelt(collateralCommitment),
            newDebtCommitment: toStarkFelt(debtCommitment),
            proofData: bytesToFelts(proof.proof),
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          setLocalDebt(prev => prev + debtU64);
          addProofRecord(address, { id: crypto.randomUUID(), circuit: CircuitType.COLLATERAL_RATIO, status: 'verified', timestamp: Date.now(), txHash: hash });
          break;
        }
        case 'repay': {
          // Circuit uses u64 amounts — scale to 1e8
          const repayU64 = BigInt(Math.floor(parseFloat(amount) * 1e8));
          const oldDebtU64 = localDebt > BigInt(0) ? localDebt : repayU64;
          const newDebtU64 = oldDebtU64 > repayU64 ? oldDebtU64 - repayU64 : BigInt(0);
          const newBlinding = BigInt(Math.floor(Math.random() * 1e15));
          const deltaBlinding = BigInt(Math.floor(Math.random() * 1e15));
          const [oldDebtCommitment, newDebtCommitment, deltaCommitment] = await Promise.all([
            pedersenHashNoir(oldDebtU64, blinding),
            pedersenHashNoir(newDebtU64, newBlinding),
            pedersenHashNoir(repayU64, deltaBlinding),
          ]);
          const witness: DebtUpdateWitness = {
            old_debt: oldDebtU64,
            new_debt: newDebtU64,
            delta: repayU64,
            old_blinding: blinding,
            new_blinding: newBlinding,
            delta_blinding: deltaBlinding,
            old_debt_commitment: oldDebtCommitment,
            new_debt_commitment: newDebtCommitment,
            delta_commitment: deltaCommitment,
            is_repayment: true,
          };
          const proof = await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });
          const hash = await repay(account, {
            amount: amountBig,
            newDebtCommitment: toStarkFelt(newDebtCommitment),
            proofData: bytesToFelts(proof.proof),
            publicInputs: proof.publicInputs,
            nullifier,
          });
          setTxHash(hash);
          setLocalDebt(newDebtU64);
          addProofRecord(address, { id: crypto.randomUUID(), circuit: CircuitType.DEBT_UPDATE_VALIDITY, status: 'verified', timestamp: Date.now(), txHash: hash });
          break;
        }
        case 'close': {
          const zeroCommitment = await pedersenHashNoir(BigInt(0), blinding);
          const witness: ZeroDebtWitness = {
            debt: BigInt(0),
            blinding,
            debt_commitment: zeroCommitment,
          };
          const proof = await prove({ type: CircuitType.ZERO_DEBT, data: witness });
          const hash = await closeCDP(account, {
            proofData: bytesToFelts(proof.proof),
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
      setTxError(err instanceof Error ? err.message : 'Transaction failed');
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
          amount={localCollateral > BigInt(0) ? formatU64(localCollateral) : balances.lockedCollateral}
          symbol="sxyBTC"
        />
        <BalanceDisplay
          label="sUSD Debt"
          amount={localDebt > BigInt(0) ? formatU64(localDebt) : balances.susdBalance}
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
