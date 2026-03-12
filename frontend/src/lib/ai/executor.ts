/**
 * AI Action Executor — bridges AI tool calls to real contract operations.
 *
 * When the AI decides to execute an action (deposit, shield, open CDP, etc.),
 * it returns a JSON action block. This module parses and executes those actions
 * using the same contract interaction functions as the UI pages.
 */

import type { AccountInterface } from 'starknet';
import { deposit, shield, unshield, withdraw, faucetMint, getBalanceCommitment, getPublicBalance } from '../contracts/vault';
import { openCDP, lockCollateral, mintSUSD, repay, closeCDP, hasCDP, checkOracleFreshness, refreshOracle, getCollateralCommitment } from '../contracts/cdp';
import { submitVaultSolvencyProof, submitCdpSafetyProof, isVaultSolvent, isCdpSafe } from '../contracts/solvency';
import { CircuitType, loadVK } from '../proofs/circuits';
import { findValidBlinding, computeCiphertextDelta } from '../privacy/encrypt';
import { derivePublicKey } from '../privacy/keygen';
import { generateNullifier, bytesToFelts, encodeGaragaCalldata } from '../proofs/calldata';
import { IS_DEVNET } from '../contracts/config';
import {
  addShieldedBalance, subtractShieldedBalance,
  getLocalShieldedBalance, getShieldedWitnessState, setShieldedWitnessState,
  getLocalCDPCollateral, setLocalCDPCollateral, getLocalCDPDebt, setLocalCDPDebt,
  getCDPColWitness, setCDPColWitness, clearCDPState,
} from '../shieldedBalance';
import { addProofRecord, pinProofToIPFS } from '../proofHistory';
import type { RangeProofWitness, BalanceSufficiencyWitness, DebtUpdateWitness, CollateralRatioWitness, ZeroDebtWitness } from '../proofs/witness';

const SKIP_PROOFS = IS_DEVNET;
const MOCK_PROOF = { proof: new Uint8Array([0xde, 0xad]), publicInputs: ['0x0'] };

/** Helper: convert Uint8Array to hex string */
function toHexString(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Record proof in localStorage and pin to IPFS (non-blocking). */
function recordAndPinProof(
  address: string,
  circuit: CircuitType,
  txHash: string,
  proof: { proof: Uint8Array; publicInputs: string[] },
): void {
  const record = {
    id: crypto.randomUUID(),
    circuit,
    status: 'verified' as const,
    timestamp: Date.now(),
    txHash,
    proofSizeBytes: proof.proof.length,
  };
  addProofRecord(address, record);
  pinProofToIPFS(address, record, toHexString(proof.proof), proof.publicInputs);
}

export type ActionType =
  | 'faucet'
  | 'deposit'
  | 'shield'
  | 'unshield'
  | 'withdraw'
  | 'open_cdp'
  | 'lock_collateral'
  | 'mint_susd'
  | 'repay'
  | 'close_cdp'
  | 'submit_solvency'
  | 'check_balances'
  | 'check_solvency';

export interface AIAction {
  action: ActionType;
  amount?: number;
}

export interface ActionResult {
  success: boolean;
  message: string;
  txHash?: string;
  data?: Record<string, string>;
}

/** Callback for live status updates during execution */
export type StatusCallback = (status: string) => void;

/**
 * Parse AI response for action blocks.
 * AI returns actions in format: ```action\n{"action":"deposit","amount":50}\n```
 * Falls back to detecting inline JSON or intent patterns if formal block is missing.
 */
export function parseActions(aiResponse: string): AIAction[] {
  const actions: AIAction[] = [];

  // 1. Try formal ```action blocks first
  const formalRegex = /```action\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = formalRegex.exec(aiResponse)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.action) actions.push(parsed);
    } catch {
      // skip invalid JSON
    }
  }
  if (actions.length > 0) return actions;

  // 2. Try inline JSON like {"action":"deposit","amount":10} anywhere in text
  const inlineRegex = /\{"action"\s*:\s*"(\w+)"(?:\s*,\s*"amount"\s*:\s*(\d+(?:\.\d+)?))?\s*\}/g;
  while ((match = inlineRegex.exec(aiResponse)) !== null) {
    const action: AIAction = { action: match[1] as ActionType };
    if (match[2]) action.amount = parseFloat(match[2]);
    actions.push(action);
  }
  if (actions.length > 0) return actions;

  // 3. Fallback: detect action intent from natural language patterns
  const lower = aiResponse.toLowerCase();
  const amountMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sxybtc|xybtc|susd)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;

  const patterns: [RegExp, ActionType][] = [
    [/i'll\s+(?:mint|get)\s+(?:\d+\s+)?test\s+(?:xybtc|tokens?).*faucet|i'll\s+(?:use\s+)?(?:the\s+)?faucet/i, 'faucet'],
    [/i'll\s+deposit\s+(\d+(?:\.\d+)?)\s*xybtc/i, 'deposit'],
    [/i'll\s+shield\s+(\d+(?:\.\d+)?)/i, 'shield'],
    [/i'll\s+unshield\s+(\d+(?:\.\d+)?)/i, 'unshield'],
    [/i'll\s+withdraw\s+(\d+(?:\.\d+)?)/i, 'withdraw'],
    [/i'll\s+open\s+(?:a\s+)?(?:new\s+)?cdp/i, 'open_cdp'],
    [/i'll\s+lock\s+(\d+(?:\.\d+)?)\s*(?:sxybtc|xybtc).*collateral/i, 'lock_collateral'],
    [/i'll\s+mint\s+(\d+(?:\.\d+)?)\s*susd/i, 'mint_susd'],
    [/i'll\s+repay\s+(\d+(?:\.\d+)?)\s*susd/i, 'repay'],
    [/i'll\s+close\s+(?:your\s+|the\s+)?cdp/i, 'close_cdp'],
    [/check.*(?:balance|position)/i, 'check_balances'],
    [/check.*solvenc/i, 'check_solvency'],
  ];

  for (const [pattern, actionType] of patterns) {
    const m = lower.match(pattern);
    if (m) {
      const parsedAmt = m[1] ? parseFloat(m[1]) : amount;
      const action: AIAction = { action: actionType };
      if (parsedAmt && !['faucet', 'open_cdp', 'close_cdp', 'check_balances', 'check_solvency'].includes(actionType)) {
        action.amount = parsedAmt;
      }
      actions.push(action);
      break;
    }
  }

  return actions;
}

/**
 * Execute a single AI action against real contracts.
 */
export async function executeAction(
  action: AIAction,
  account: AccountInterface,
  address: string,
  privacyKey: bigint | null,
  prove: (input: { type: CircuitType; data: unknown }) => Promise<{ proof: Uint8Array; publicInputs: string[] }>,
  onStatus?: StatusCallback,
): Promise<ActionResult> {
  const status = onStatus || (() => {});

  try {
    switch (action.action) {
      case 'faucet': {
        status('Minting 100 test xyBTC...');
        const mintAmt = BigInt(100) * BigInt(10) ** BigInt(18);
        const hash = await faucetMint(account, address, mintAmt);
        return { success: true, message: 'Minted 100 xyBTC to your wallet.', txHash: hash };
      }

      case 'deposit': {
        const amt = action.amount ?? 0;
        if (amt <= 0) return { success: false, message: 'Amount must be positive.' };
        status(`Depositing ${amt} xyBTC...`);
        const amountBig = BigInt(Math.floor(amt * 1e18));
        const hash = await deposit(account, amountBig);
        return { success: true, message: `Deposited ${amt} xyBTC into vault.`, txHash: hash };
      }

      case 'withdraw': {
        const amt = action.amount ?? 0;
        if (amt <= 0) return { success: false, message: 'Amount must be positive.' };
        status(`Withdrawing ${amt} xyBTC...`);
        const amountBig = BigInt(Math.floor(amt * 1e18));
        const hash = await withdraw(account, amountBig);
        return { success: true, message: `Withdrew ${amt} xyBTC from vault.`, txHash: hash };
      }

      case 'shield': {
        const amt = action.amount ?? 0;
        if (amt <= 0) return { success: false, message: 'Amount must be positive.' };
        if (!privacyKey) return { success: false, message: 'Privacy key not unlocked. Go to Settings to unlock your key first.' };

        status('Checking on-chain state...');
        const amountBig = BigInt(Math.floor(amt * 1e18));
        const amountWitness = BigInt(Math.floor(amt * 1e8));
        const publicKey = derivePublicKey(privacyKey);
        const onChainCommitment = await getBalanceCommitment(account, address);
        const isFirstShield = onChainCommitment === BigInt(0);

        let circuitType: CircuitType;
        let newCommitment: bigint;
        let newBlinding: bigint;
        let proof: { proof: Uint8Array; publicInputs: string[] };

        if (isFirstShield) {
          status('Generating ZK range proof...');
          circuitType = CircuitType.RANGE_PROOF;
          const MAX_U64 = BigInt(2) ** BigInt(64) - BigInt(1);
          const { blinding, commitment } = await findValidBlinding(amountWitness);
          newBlinding = blinding;
          newCommitment = commitment;
          const witness: RangeProofWitness = { value: amountWitness, blinding, commitment, max_value: MAX_U64 };
          proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.RANGE_PROOF, data: witness });
        } else {
          status('Generating ZK balance update proof...');
          circuitType = CircuitType.DEBT_UPDATE_VALIDITY;
          const oldState = getShieldedWitnessState(address);
          const oldBalance = oldState?.balanceU64 ?? BigInt(0);
          const oldBlinding = oldState?.blinding ?? BigInt(1);
          const newBalance = oldBalance + amountWitness;
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
            old_debt: oldBalance, new_debt: newBalance, delta: amountWitness,
            old_blinding: oldCommitmentResult.blinding, new_blinding: newBalResult.blinding, delta_blinding: deltaResult.blinding,
            old_debt_commitment: oldCommitmentResult.commitment, new_debt_commitment: newBalResult.commitment, delta_commitment: deltaResult.commitment,
            is_repayment: false,
          };
          proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });
        }

        status('Encoding Garaga calldata...');
        const delta = computeCiphertextDelta(amountBig, publicKey, true);
        const nullifier = generateNullifier();
        let proofData: string[];
        if (SKIP_PROOFS) {
          proofData = bytesToFelts(proof.proof);
        } else {
          const vk = await loadVK(circuitType);
          proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk);
        }

        status('Submitting shield transaction...');
        const hash = await shield(account, {
          amount: amountBig, newBalanceCommitment: newCommitment,
          ctDeltaC1: delta.delta_c1, ctDeltaC2: delta.delta_c2,
          proofData, nullifier,
        });

        addShieldedBalance(address, amountBig);
        const oldS = getShieldedWitnessState(address);
        const oldU = oldS?.balanceU64 ?? BigInt(0);
        setShieldedWitnessState(address, { balanceU64: oldU + amountWitness, blinding: newBlinding, commitment: newCommitment });
        recordAndPinProof(address, circuitType, hash, proof);

        return { success: true, message: `Shielded ${amt} xyBTC with ZK proof. Balance is now encrypted on-chain.`, txHash: hash };
      }

      case 'unshield': {
        const amt = action.amount ?? 0;
        if (amt <= 0) return { success: false, message: 'Amount must be positive.' };
        if (!privacyKey) return { success: false, message: 'Privacy key not unlocked. Go to Settings to unlock your key first.' };

        const amountBig = BigInt(Math.floor(amt * 1e18));
        const amountWitness = BigInt(Math.floor(amt * 1e8));
        const localBal = getLocalShieldedBalance(address);
        if (localBal < amountBig) return { success: false, message: `Insufficient shielded balance. You have ${Number(localBal) / 1e18} xyBTC shielded.` };

        status('Generating ZK balance sufficiency proof...');
        const publicKey = derivePublicKey(privacyKey);
        const oldState = getShieldedWitnessState(address);
        const oldBalance = oldState?.balanceU64 ?? BigInt(0);
        const newBalance = oldBalance - amountWitness;
        const [oldR, newR, deltaR] = await Promise.all([
          oldState ? Promise.resolve({ blinding: oldState.blinding, commitment: oldState.commitment }) : findValidBlinding(oldBalance, 1),
          findValidBlinding(newBalance, 900),
          findValidBlinding(amountWitness, 950),
        ]);
        const witness: BalanceSufficiencyWitness = {
          balance: oldBalance,
          amount: amountWitness,
          new_balance: newBalance,
          balance_blinding: oldR.blinding,
          amount_blinding: deltaR.blinding,
          new_balance_blinding: newR.blinding,
          balance_commitment: oldR.commitment,
          amount_commitment: deltaR.commitment,
          new_balance_commitment: newR.commitment,
        };
        const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.BALANCE_SUFFICIENCY, data: witness });

        status('Encoding Garaga calldata...');
        const delta = computeCiphertextDelta(amountBig, publicKey, false);
        const nullifier = generateNullifier();
        let proofData: string[];
        if (SKIP_PROOFS) { proofData = bytesToFelts(proof.proof); }
        else { const vk = await loadVK(CircuitType.BALANCE_SUFFICIENCY); proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk); }

        status('Submitting unshield transaction...');
        const hash = await unshield(account, {
          amount: amountBig, newBalanceCommitment: newR.commitment,
          ctDeltaC1: delta.delta_c1, ctDeltaC2: delta.delta_c2,
          proofData, nullifier,
        });

        subtractShieldedBalance(address, amountBig);
        setShieldedWitnessState(address, { balanceU64: newBalance, blinding: newR.blinding, commitment: newR.commitment });
        recordAndPinProof(address, CircuitType.BALANCE_SUFFICIENCY, hash, proof);

        return { success: true, message: `Unshielded ${amt} xyBTC. Balance converted back to public.`, txHash: hash };
      }

      case 'open_cdp': {
        status('Opening CDP...');
        const exists = await hasCDP(account, address);
        if (exists) return { success: false, message: 'You already have an open CDP.' };
        const hash = await openCDP(account);
        return { success: true, message: 'CDP opened successfully. You can now lock collateral.', txHash: hash };
      }

      case 'lock_collateral': {
        const amt = action.amount ?? 0;
        if (amt <= 0) return { success: false, message: 'Amount must be positive.' };

        status('Checking CDP state...');
        const exists = await hasCDP(account, address);
        if (!exists) return { success: false, message: 'No CDP found. Open a CDP first.' };

        const amountBig = BigInt(Math.floor(amt * 1e18));
        const amountWitness = BigInt(Math.floor(amt * 1e8));
        const MAX_U64 = BigInt(2) ** BigInt(64) - BigInt(1);

        const onChainCol = await getCollateralCommitment(account, address);
        const isFirstLock = onChainCol === BigInt(0);

        let circuitType: CircuitType;
        let newCommitment: bigint;
        let newBlinding: bigint;
        let proof: { proof: Uint8Array; publicInputs: string[] };

        if (isFirstLock) {
          status('Generating ZK range proof for collateral...');
          circuitType = CircuitType.RANGE_PROOF;
          const { blinding, commitment } = await findValidBlinding(amountWitness, 200);
          newBlinding = blinding;
          newCommitment = commitment;
          const witness: RangeProofWitness = { value: amountWitness, blinding, commitment, max_value: MAX_U64 };
          proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.RANGE_PROOF, data: witness });
        } else {
          status('Generating ZK update proof for collateral...');
          circuitType = CircuitType.DEBT_UPDATE_VALIDITY;
          const oldState = getCDPColWitness(address);
          const oldCol = oldState?.balanceU64 ?? BigInt(0);
          const oldBl = oldState?.blinding ?? BigInt(1);
          const newCol = oldCol + amountWitness;
          const oldCR = oldState ? { blinding: oldBl, commitment: oldState.commitment } : await findValidBlinding(oldCol, 1);
          const [deltaR, newR] = await Promise.all([findValidBlinding(amountWitness, 100), findValidBlinding(newCol, 300)]);
          newBlinding = newR.blinding;
          newCommitment = newR.commitment;
          const witness: DebtUpdateWitness = {
            old_debt: oldCol, new_debt: newCol, delta: amountWitness,
            old_blinding: oldCR.blinding, new_blinding: newR.blinding, delta_blinding: deltaR.blinding,
            old_debt_commitment: oldCR.commitment, new_debt_commitment: newR.commitment, delta_commitment: deltaR.commitment,
            is_repayment: false,
          };
          proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });
        }

        status('Encoding and submitting...');
        let proofData: string[];
        if (SKIP_PROOFS) { proofData = bytesToFelts(proof.proof); }
        else { const vk = await loadVK(circuitType); proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk); }

        const nullifier = generateNullifier();
        const hash = await lockCollateral(account, { amount: amountBig, commitment: newCommitment, ct_c1: BigInt('0xc01c1'), ct_c2: BigInt('0xc01c2'), proofData, publicInputs: proof.publicInputs, nullifier });

        setLocalCDPCollateral(address, getLocalCDPCollateral(address) + amountWitness);
        setCDPColWitness(address, { balanceU64: (getCDPColWitness(address)?.balanceU64 ?? BigInt(0)) + amountWitness, blinding: newBlinding, commitment: newCommitment });
        recordAndPinProof(address, circuitType, hash, proof);

        return { success: true, message: `Locked ${amt} xyBTC as collateral with ZK proof.`, txHash: hash };
      }

      case 'mint_susd': {
        const amt = action.amount ?? 0;
        if (amt <= 0) return { success: false, message: 'Amount must be positive.' };

        status('Checking oracle freshness...');
        const oracleOk = await checkOracleFreshness(account).catch(() => false);
        if (!oracleOk) {
          status('Refreshing oracle...');
          await refreshOracle(account).catch(() => {});
        }

        const amountWitness = BigInt(Math.floor(amt * 1e8));
        const colWitness = getCDPColWitness(address);
        if (!colWitness) return { success: false, message: 'No collateral witness state. Lock collateral first.' };

        status('Generating ZK collateral ratio proof...');
        const { blinding: dBlinding, commitment: dCommitment } = await findValidBlinding(amountWitness, 400);
        const witness: CollateralRatioWitness = {
          collateral: colWitness.balanceU64, debt: amountWitness,
          collateral_blinding: colWitness.blinding, debt_blinding: dBlinding,
          collateral_commitment: colWitness.commitment, debt_commitment: dCommitment,
          price: BigInt('5000000000000'), min_ratio_percent: BigInt(200),
        };
        const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.COLLATERAL_RATIO, data: witness });

        status('Submitting mint transaction...');
        const nullifier = generateNullifier();
        let proofData: string[];
        if (SKIP_PROOFS) { proofData = bytesToFelts(proof.proof); }
        else { const vk = await loadVK(CircuitType.COLLATERAL_RATIO); proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk); }

        const hash = await mintSUSD(account, { newCollateralCommitment: colWitness.commitment, newDebtCommitment: dCommitment, proofData, publicInputs: proof.publicInputs, nullifier });
        setLocalCDPDebt(address, getLocalCDPDebt(address) + amountWitness);
        recordAndPinProof(address, CircuitType.COLLATERAL_RATIO, hash, proof);

        return { success: true, message: `Minted ${amt} sUSD against your collateral. CR proof verified on-chain.`, txHash: hash };
      }

      case 'repay': {
        const amt = action.amount ?? 0;
        if (amt <= 0) return { success: false, message: 'Amount must be positive.' };

        const amountWitness = BigInt(Math.floor(amt * 1e8));
        const oldDebt = getLocalCDPDebt(address);
        if (oldDebt <= BigInt(0)) return { success: false, message: 'No debt to repay.' };
        const newDebt = oldDebt > amountWitness ? oldDebt - amountWitness : BigInt(0);
        const actualDelta = oldDebt > amountWitness ? amountWitness : oldDebt;

        status('Generating ZK debt update proof...');
        const [oldR, newR, deltaR] = await Promise.all([
          findValidBlinding(oldDebt, 500), findValidBlinding(newDebt, 600), findValidBlinding(actualDelta, 700),
        ]);
        const witness: DebtUpdateWitness = {
          old_debt: oldDebt, new_debt: newDebt, delta: actualDelta,
          old_blinding: oldR.blinding, new_blinding: newR.blinding, delta_blinding: deltaR.blinding,
          old_debt_commitment: oldR.commitment, new_debt_commitment: newR.commitment, delta_commitment: deltaR.commitment,
          is_repayment: true,
        };
        const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.DEBT_UPDATE_VALIDITY, data: witness });

        status('Submitting repay transaction...');
        const nullifier = generateNullifier();
        let proofData: string[];
        if (SKIP_PROOFS) { proofData = bytesToFelts(proof.proof); }
        else { const vk = await loadVK(CircuitType.DEBT_UPDATE_VALIDITY); proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk); }

        const hash = await repay(account, { newDebtCommitment: newR.commitment, proofData, publicInputs: proof.publicInputs, nullifier });
        setLocalCDPDebt(address, newDebt);
        recordAndPinProof(address, CircuitType.DEBT_UPDATE_VALIDITY, hash, proof);

        return { success: true, message: `Repaid ${amt} sUSD. Remaining debt: ${Number(newDebt) / 1e8} sUSD.`, txHash: hash };
      }

      case 'close_cdp': {
        status('Generating ZK zero debt proof...');
        const debt = getLocalCDPDebt(address);
        if (debt > BigInt(0)) return { success: false, message: `Cannot close CDP: you have ${Number(debt) / 1e8} sUSD debt. Repay first.` };

        const { blinding, commitment } = await findValidBlinding(BigInt(0), 800);
        const witness: ZeroDebtWitness = { debt: BigInt(0), blinding, debt_commitment: commitment };
        const proof = SKIP_PROOFS ? MOCK_PROOF : await prove({ type: CircuitType.ZERO_DEBT, data: witness });

        status('Submitting close CDP transaction...');
        const nullifier = generateNullifier();
        let proofData: string[];
        if (SKIP_PROOFS) { proofData = bytesToFelts(proof.proof); }
        else { const vk = await loadVK(CircuitType.ZERO_DEBT); proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk); }

        const hash = await closeCDP(account, { proofData, publicInputs: proof.publicInputs, nullifier });
        clearCDPState(address);
        recordAndPinProof(address, CircuitType.ZERO_DEBT, hash, proof);

        return { success: true, message: 'CDP closed. All collateral returned to your wallet.', txHash: hash };
      }

      case 'submit_solvency': {
        status('Generating vault solvency proof...');
        const hash1 = await submitVaultSolvencyProof(account, (p) => status(p.message || 'Proving...'));
        status('Generating CDP safety proof...');
        const hash2 = await submitCdpSafetyProof(account, (p) => status(p.message || 'Proving...'));
        return { success: true, message: 'Both solvency proofs submitted and verified on-chain.', txHash: hash1, data: { vaultTx: hash1, cdpTx: hash2 } };
      }

      case 'check_solvency': {
        status('Checking solvency status...');
        const [vaultOk, cdpOk] = await Promise.all([
          isVaultSolvent(account).catch(() => false),
          isCdpSafe(account).catch(() => false),
        ]);
        return {
          success: true,
          message: `Vault solvency: ${vaultOk ? 'Verified' : 'Not verified'}\nCDP safety: ${cdpOk ? 'Verified' : 'Not verified'}`,
          data: { vaultSolvent: String(vaultOk), cdpSafe: String(cdpOk) },
        };
      }

      case 'check_balances': {
        status('Fetching on-chain balances...');
        const pubBal = await getPublicBalance(account, address).catch(() => BigInt(0));
        const shieldedBal = getLocalShieldedBalance(address);
        const cdpCol = getLocalCDPCollateral(address);
        const cdpDbt = getLocalCDPDebt(address);
        const fmt = (v: bigint, d: number) => `${Number(v) / 10 ** d}`;
        const total = pubBal + shieldedBal;
        const privScore = total > BigInt(0) ? Number((shieldedBal * BigInt(100)) / total) : 0;
        return {
          success: true,
          message: [
            `**Public vault balance:** ${fmt(pubBal, 18)} xyBTC`,
            `**Shielded balance:** ${fmt(shieldedBal, 18)} xyBTC`,
            `**Privacy score:** ${privScore}%`,
            cdpCol > BigInt(0) ? `**CDP collateral:** ${fmt(cdpCol, 8)} xyBTC` : null,
            cdpDbt > BigInt(0) ? `**CDP debt:** ${fmt(cdpDbt, 8)} sUSD` : null,
          ].filter(Boolean).join('\n'),
        };
      }

      default:
        return { success: false, message: `Unknown action: ${action.action}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Execution failed: ${msg}` };
  }
}
