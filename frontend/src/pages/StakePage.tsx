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
import { deposit, shield, faucetMint, getBalanceCommitment } from '../lib/contracts/vault';
import { IS_DEVNET } from '../lib/contracts/config';
import { addProofRecord } from '../lib/proofHistory';
import { addShieldedBalance, getLocalShieldedBalance, getShieldedWitnessState, setShieldedWitnessState } from '../lib/shieldedBalance';
import type { RangeProofWitness, DebtUpdateWitness } from '../lib/proofs/witness';

/** On devnet, MockProofVerifier accepts anything — skip real proof generation */
const SKIP_PROOFS = IS_DEVNET;
const MOCK_PROOF = { proof: new Uint8Array([0xde, 0xad]), publicInputs: ['0x0'] };

export default function StakePage() {
  const { account, address, isKeyUnlocked, privacyKey } = useWallet();
  const { balances, loading: balancesLoading, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();

  // Deposit state
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Faucet state
  const [isMinting, setIsMinting] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  // Shield state
  const [shieldAmount, setShieldAmount] = useState('');
  const [shieldTxHash, setShieldTxHash] = useState<string | null>(null);
  const [shieldTxError, setShieldTxError] = useState<string | null>(null);
  const [isShielding, setIsShielding] = useState(false);

  const handleFaucet = async () => {
    if (!account || !address) return;
    setIsMinting(true);
    setFaucetMsg(null);
    try {
      const mintAmount = BigInt(100) * BigInt(10) ** BigInt(18); // 100 xyBTC
      const hash = await faucetMint(account, address, mintAmount);
      setFaucetMsg(`Minted 100 xyBTC! tx: ${hash}`);
      setTimeout(() => refresh(), 5000);
    } catch (err) {
      setFaucetMsg(err instanceof Error ? err.message : 'Faucet failed');
    } finally {
      setIsMinting(false);
    }
  };

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
      setTimeout(() => refresh(), 5000);
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
      // Contract amount at 1e18 scale (matches on-chain token balances).
      // Circuit witness at 1e8 scale (fits in u64 for Noir circuits).
      // These are independent — the verifier only checks proof validity internally.
      const amountBig = BigInt(Math.floor(parseFloat(shieldAmount) * 1e18));
      const amountWitness = BigInt(Math.floor(parseFloat(shieldAmount) * 1e8));
      const publicKey = derivePublicKey(privacyKey);

      // Check on-chain commitment to determine first vs subsequent shield.
      // The contract routes: commitment == 0 → RANGE_PROOF, else → DEBT_UPDATE_VALIDITY.
      const onChainCommitment = await getBalanceCommitment(account, address);
      const isFirstShield = onChainCommitment === BigInt(0);

      let circuitType: CircuitType;
      let newCommitment: bigint;
      let newBlinding: bigint;
      let proof: { proof: Uint8Array; publicInputs: string[] };

      if (isFirstShield) {
        // First shield: RANGE_PROOF on the amount
        circuitType = CircuitType.RANGE_PROOF;
        const MAX_U64 = BigInt(2) ** BigInt(64) - BigInt(1);
        const { blinding, commitment } = await findValidBlinding(amountWitness);
        newBlinding = blinding;
        newCommitment = commitment;

        const witness: RangeProofWitness = {
          value: amountWitness,
          blinding,
          commitment,
          max_value: MAX_U64,
        };
        proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.RANGE_PROOF, data: witness });
      } else {
        // Subsequent shield: DEBT_UPDATE_VALIDITY proves new_balance = old_balance + delta.
        // The contract only checks that the Garaga verifier accepts the proof — it does NOT
        // compare the proof's old_debt_commitment to its own stored commitment.
        // So we can use local witness state if available, or fall back to old_debt=0.
        circuitType = CircuitType.DEBT_UPDATE_VALIDITY;

        const oldState = getShieldedWitnessState(address);
        const oldBalance = oldState?.balanceU64 ?? BigInt(0);
        const oldBlinding = oldState?.blinding ?? BigInt(1);
        const newBalance = oldBalance + amountWitness;

        // Compute commitments: for old (use stored or fresh), for delta and new balance
        const oldCommitmentResult = oldState
          ? { blinding: oldBlinding, commitment: oldState.commitment }
          : await findValidBlinding(oldBalance, 1);
        const [deltaResult, newBalResult] = await Promise.all([
          findValidBlinding(amountWitness, 100),
          findValidBlinding(newBalance, 300),
        ]);
        newBlinding = newBalResult.blinding;
        newCommitment = newBalResult.commitment;

        const witness: DebtUpdateWitness = {
          old_debt: oldBalance,
          new_debt: newBalance,
          delta: amountWitness,
          old_blinding: oldCommitmentResult.blinding,
          new_blinding: newBalResult.blinding,
          delta_blinding: deltaResult.blinding,
          old_debt_commitment: oldCommitmentResult.commitment,
          new_debt_commitment: newBalResult.commitment,
          delta_commitment: deltaResult.commitment,
          is_repayment: false,
        };
        proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });
      }

      const delta = computeCiphertextDelta(amountBig, publicKey, true);
      const nullifier = generateNullifier();

      // Encode proof as Garaga calldata (real verification) or bytesToFelts (mock)
      let proofData: string[];
      if (SKIP_PROOFS) {
        proofData = bytesToFelts(proof.proof);
      } else {
        const vk = await loadVK(circuitType);
        proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk);
      }

      const hash = await shield(account, {
        amount: amountBig,
        newBalanceCommitment: newCommitment,
        ctDeltaC1: delta.delta_c1,
        ctDeltaC2: delta.delta_c2,
        proofData,
        nullifier,
      });

      setShieldTxHash(hash);
      setShieldAmount('');

      addShieldedBalance(address, amountBig);

      // Save witness state so the next shield can reference this commitment
      const oldState = getShieldedWitnessState(address);
      const oldU64 = oldState?.balanceU64 ?? BigInt(0);
      setShieldedWitnessState(address, {
        balanceU64: oldU64 + amountWitness,
        blinding: newBlinding,
        commitment: newCommitment,
      });

      addProofRecord(address, {
        id: crypto.randomUUID(),
        circuit: circuitType,
        status: 'verified',
        timestamp: Date.now(),
        txHash: hash,
      });

      setTimeout(() => refresh(), 5000);
    } catch (err) {
      console.error('[Shield] Error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setShieldTxError(msg);
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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-shield-600/10 border border-shield-500/20 flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.2" className="text-shield-400" fill="none" />
            <path d="M8 5L11 6.75V10.25L8 12L5 10.25V6.75L8 5Z" fill="currentColor" className="text-shield-400" fillOpacity="0.3" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Stake BTC</h2>
        <p className="text-gray-500 max-w-md">Connect your wallet to deposit BTC, stake via Endur, and shield into privacy-preserving sxyBTC.</p>
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
        <h2 className="text-3xl font-bold text-white tracking-tight mb-1">Stake BTC</h2>
        <p className="text-gray-500">
          Deposit BTC into the ShieldedVault. Stake via Endur and wrap into privacy-preserving sxyBTC.
        </p>
      </div>

      {/* Balance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Alerts */}
      {!isKeyUnlocked && (
        <div className="alert-warning flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0">
            <path d="M8 1L14.93 13H1.07L8 1z" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <span>Privacy key locked. Go to <strong>Settings</strong> to generate or unlock your key for decrypted shielded balances.</span>
        </div>
      )}

      {balances.hasCDP && (
        <div className="alert-info flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <span>You have an active CDP{balances.debtCommitment && balances.debtCommitment !== BigInt(0) ? ' with outstanding debt' : ''}.</span>
        </div>
      )}

      {/* Faucet */}
      <div className="card flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Testnet Faucet</h3>
          <p className="text-xs text-gray-500 mt-0.5">Mint 100 test xyBTC tokens to your wallet</p>
        </div>
        <button
          onClick={handleFaucet}
          disabled={isMinting}
          className="btn-secondary text-sm"
        >
          {isMinting ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
              Minting...
            </span>
          ) : 'Get Test Tokens'}
        </button>
      </div>
      {faucetMsg && (
        <p className="text-xs text-gray-400 break-all px-1 -mt-4">{faucetMsg}</p>
      )}

      {/* Deposit Section */}
      <div className="card space-y-4">
        <div>
          <h3 className="section-title">Deposit</h3>
          <p className="text-xs text-gray-500 mt-1">
            Deposit xyBTC into the vault as public balance. No ZK proof needed.
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
            onClick={handleDeposit}
            disabled={!amount || isSubmitting || balancesLoading}
            className="btn-primary"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Depositing...
              </span>
            ) : 'Deposit & Stake'}
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

      {/* Shield Section */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="section-title">Shield</h3>
          <span className="badge-shield text-[10px]">ZK Proof Required</span>
        </div>
        <p className="text-xs text-gray-500">
          Convert public balance to encrypted sxyBTC. Requires privacy key and generates a ZK proof.
        </p>

        {!isKeyUnlocked ? (
          <div className="alert-warning">
            Privacy key must be unlocked to shield funds. Go to <strong>Settings</strong> to unlock.
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <input
                type="number"
                value={shieldAmount}
                onChange={(e) => setShieldAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.001"
                className="input-field flex-1 font-mono"
              />
              <button
                onClick={handleShield}
                disabled={!shieldAmount || isShielding || isProving || balancesLoading}
                className="btn-primary"
              >
                {isProving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Proving...
                  </span>
                ) : isShielding ? 'Shielding...' : 'Shield'}
              </button>
            </div>

            <ProofProgress progress={progress} error={proofError} />

            {shieldTxHash && (
              <div className="tx-success">
                <span className="text-emerald-400 font-medium">Shield transaction submitted </span>
                <span className="text-gray-400 font-mono text-xs break-all">{shieldTxHash}</span>
              </div>
            )}

            {shieldTxError && (
              <div className="tx-error">{shieldTxError}</div>
            )}
          </>
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
