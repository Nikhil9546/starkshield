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
import { deposit, shield, faucetMint, getBalanceCommitment } from '../lib/contracts/vault';
import { IS_DEVNET } from '../lib/contracts/config';
import { addProofRecord, pinProofToIPFS } from '../lib/proofHistory';
import { addShieldedBalance, getLocalShieldedBalance, getShieldedWitnessState, setShieldedWitnessState } from '../lib/shieldedBalance';
import type { RangeProofWitness, DebtUpdateWitness } from '../lib/proofs/witness';

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
  .page-glow {
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(59,130,246,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .page-glow-secondary {
    position: fixed;
    bottom: -300px;
    right: -200px;
    width: 600px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(6,182,212,0.04) 0%, transparent 70%);
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
`;

export default function StakePage() {
  const { account, address, isKeyUnlocked, privacyKey } = useWallet();
  const { balances, loading: balancesLoading, refresh } = useBalance();
  const { progress, isProving, error: proofError, prove } = useProof();
  const toast = useToast();

  // Deposit state
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Faucet state
  const [isMinting, setIsMinting] = useState(false);

  // Shield state
  const [shieldAmount, setShieldAmount] = useState('');
  const [isShielding, setIsShielding] = useState(false);

  const handleFaucet = async () => {
    if (!account || !address) return;
    setIsMinting(true);
    try {
      const mintAmount = BigInt(100) * BigInt(10) ** BigInt(18); // 100 xyBTC
      const hash = await faucetMint(account, address, mintAmount);
      toast.success('Minted 100 xyBTC', `tx: ${hash.slice(0, 20)}...`);
      setTimeout(() => refresh(), 5000);
    } catch (err) {
      toast.error('Faucet failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsMinting(false);
    }
  };

  const handleDeposit = async () => {
    if (!account || !address || !amount) return;

    setIsSubmitting(true);

    try {
      const amountBig = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const hash = await deposit(account, amountBig);
      toast.success('Deposit successful', `tx: ${hash.slice(0, 20)}...`);
      setAmount('');
      setTimeout(() => refresh(), 5000);
    } catch (err) {
      toast.error('Deposit failed', err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShield = async () => {
    if (!account || !address || !shieldAmount || !privacyKey) return;

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

      toast.success('Shield successful', `tx: ${hash.slice(0, 20)}...`);
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

      const proofRecord = {
        id: crypto.randomUUID(),
        circuit: circuitType,
        status: 'verified' as const,
        timestamp: Date.now(),
        txHash: hash,
        proofSizeBytes: proof.proof.length,
      };
      addProofRecord(address, proofRecord);
      pinProofToIPFS(address, proofRecord, '0x' + Array.from(proof.proof).map(b => b.toString(16).padStart(2, '0')).join(''), proof.publicInputs);

      setTimeout(() => refresh(), 5000);
    } catch (err) {
      console.error('[Shield] Error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Shield failed', msg);
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
      <>
        <style>{pageStyles}{logoStyles}</style>
        <div className="page-glow" />
        <div className="page-glow-secondary" />
        <div className="relative z-10 flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-8 hero-icon">
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-shield-500/15 blur-2xl hero-ring" />
            <ObscuraLogo size={80} glow animated />
          </div>
          <h2 className="page-title gradient-text mb-3">Stake BTC</h2>
          <p className="page-subtitle max-w-md">Connect your wallet to deposit BTC, stake via Endur, and shield into privacy-preserving sxyBTC.</p>
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
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-shield-500/15 blur-xl hero-ring" />
          <ObscuraLogo size={56} glow animated />
        </div>
        <div>
          <h2 className="page-title gradient-text tracking-tight mb-1">Stake BTC</h2>
          <p className="page-subtitle">
            Deposit BTC into the ShieldedVault. Stake via Endur and wrap into privacy-preserving sxyBTC.
          </p>
        </div>
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
    </>
  );
}
