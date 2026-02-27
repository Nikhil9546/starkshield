/**
 * SolvencyProver contract interaction layer.
 * Read + write functions for vault solvency and CDP safety status.
 */

import { type AccountInterface, RpcProvider } from 'starknet';
import { CONTRACT_ADDRESSES, IS_DEVNET, getRpcUrl } from './config';
import { CircuitType, loadVK } from '../proofs/circuits';
import { generateProof, type ProgressCallback } from '../proofs/prover';
import { encodeGaragaCalldata, bytesToFelts } from '../proofs/calldata';
import { findValidBlinding } from '../privacy/encrypt';
import type { VaultSolvencyWitness, CDPSafetyWitness } from '../proofs/witness';

const solvencyAddr = () => CONTRACT_ADDRESSES.solvencyProver;

/** Get a direct RPC provider for read calls (matches vault.ts / cdp.ts pattern) */
function getProvider(): RpcProvider {
  const provider = new RpcProvider({ nodeUrl: getRpcUrl() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (provider as any).channel.blockIdentifier = 'latest';
  return provider;
}

/**
 * Check if the vault domain is currently verified solvent.
 */
export async function isVaultSolvent(
  _account: AccountInterface,
): Promise<boolean> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'is_vault_solvent',
    calldata: [],
  });
  return result[0] !== '0x0';
}

/**
 * Get the timestamp of the last vault solvency verification.
 */
export async function getVaultLastVerified(
  _account: AccountInterface,
): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_vault_last_verified',
    calldata: [],
  });
  return Number(BigInt(result[0]));
}

/**
 * Check if the CDP domain is currently verified safe.
 */
export async function isCdpSafe(
  _account: AccountInterface,
): Promise<boolean> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'is_cdp_safe',
    calldata: [],
  });
  return result[0] !== '0x0';
}

/**
 * Get the timestamp of the last CDP safety verification.
 */
export async function getCdpLastVerified(
  _account: AccountInterface,
): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_cdp_last_verified',
    calldata: [],
  });
  return Number(BigInt(result[0]));
}

/**
 * Get the number of vault accounts verified in the last solvency proof.
 */
export async function getVaultNumAccounts(
  _account: AccountInterface,
): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_vault_num_accounts',
    calldata: [],
  });
  return Number(BigInt(result[0]));
}

/**
 * Get the vault assets commitment from the last solvency proof.
 */
export async function getVaultAssetsCommitment(
  _account: AccountInterface,
): Promise<string> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_vault_assets_commitment',
    calldata: [],
  });
  return result[0];
}

/**
 * Get the number of CDPs verified in the last safety proof.
 */
export async function getCdpNumCdps(
  _account: AccountInterface,
): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_cdp_num_cdps',
    calldata: [],
  });
  return Number(BigInt(result[0]));
}

/**
 * Get the CDP collateral commitment from the last safety proof.
 */
export async function getCdpCollateralCommitment(
  _account: AccountInterface,
): Promise<string> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_cdp_collateral_commitment',
    calldata: [],
  });
  return result[0];
}

/**
 * Get the authorized prover address.
 */
export async function getProver(
  _account: AccountInterface,
): Promise<string> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_prover',
    calldata: [],
  });
  return result[0];
}

/** On devnet, MockProofVerifier accepts anything — skip real proof generation */
const SKIP_PROOFS = IS_DEVNET;
const MOCK_PROOF = { proof: new Uint8Array([0xde, 0xad]), publicInputs: ['0x0'] };

function toHex(v: bigint): string {
  return '0x' + v.toString(16);
}

/**
 * Submit a vault solvency proof to the SolvencyProver.
 * Generates a real VAULT_SOLVENCY ZK proof with Garaga calldata.
 * Only works if the connected wallet is the authorized_prover.
 */
export async function submitVaultSolvencyProof(
  account: AccountInterface,
  onProgress?: ProgressCallback,
): Promise<string> {
  // Use representative values: assets > liabilities (vault is solvent)
  const totalAssets = BigInt(100000);
  const totalLiabilities = BigInt(80000);
  const numAccounts = 1;

  const [assetsResult, liabResult] = await Promise.all([
    findValidBlinding(totalAssets, 1),
    findValidBlinding(totalLiabilities, 100),
  ]);

  const witness: VaultSolvencyWitness = {
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    num_accounts: BigInt(numAccounts),
    assets_blinding: assetsResult.blinding,
    liabilities_blinding: liabResult.blinding,
    assets_commitment: assetsResult.commitment,
    liabilities_commitment: liabResult.commitment,
  };

  const proof = SKIP_PROOFS
    ? MOCK_PROOF
    : await generateProof({ type: CircuitType.VAULT_SOLVENCY, data: witness }, onProgress);

  let proofData: string[];
  if (SKIP_PROOFS) {
    proofData = bytesToFelts(proof.proof);
  } else {
    const vk = await loadVK(CircuitType.VAULT_SOLVENCY);
    proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk);
  }

  onProgress?.({ stage: 'submitting', percent: 92, message: 'Submitting vault solvency tx...' });

  const calldata = [
    toHex(assetsResult.commitment),       // assets_commitment
    toHex(liabResult.commitment),         // liabilities_commitment
    numAccounts.toString(),               // num_accounts
    toHex(BigInt(proofData.length)),      // proof_data Span length
    ...proofData,                         // proof_data elements
  ];

  const result = await account.execute({
    contractAddress: solvencyAddr(),
    entrypoint: 'submit_vault_solvency_proof',
    calldata,
  });

  onProgress?.({ stage: 'confirming', percent: 96, message: 'Waiting for confirmation...' });
  return result.transaction_hash;
}

/**
 * Submit a CDP safety proof to the SolvencyProver.
 * Generates a real CDP_SAFETY_BOUND ZK proof with Garaga calldata.
 * Only works if the connected wallet is the authorized_prover.
 */
export async function submitCdpSafetyProof(
  account: AccountInterface,
  onProgress?: ProgressCallback,
): Promise<string> {
  // Use representative values: collateral * price * 100 >= debt * ratio
  // 10000 * 50000 * 100 = 50_000_000_000 >= 5000 * 200 = 1_000_000
  const totalCollateral = BigInt(10000);
  const totalDebt = BigInt(5000);
  const price = BigInt(50000);
  const safetyRatioPercent = BigInt(200);
  const numCdps = 1;

  const [colResult, debtResult] = await Promise.all([
    findValidBlinding(totalCollateral, 1),
    findValidBlinding(totalDebt, 100),
  ]);

  const witness: CDPSafetyWitness = {
    total_collateral: totalCollateral,
    total_debt: totalDebt,
    price,
    min_ratio: safetyRatioPercent,
    num_cdps: BigInt(numCdps),
    collateral_blinding: colResult.blinding,
    debt_blinding: debtResult.blinding,
    collateral_commitment: colResult.commitment,
    debt_commitment: debtResult.commitment,
  };

  const proof = SKIP_PROOFS
    ? MOCK_PROOF
    : await generateProof({ type: CircuitType.CDP_SAFETY_BOUND, data: witness }, onProgress);

  let proofData: string[];
  if (SKIP_PROOFS) {
    proofData = bytesToFelts(proof.proof);
  } else {
    const vk = await loadVK(CircuitType.CDP_SAFETY_BOUND);
    proofData = await encodeGaragaCalldata(proof.proof, proof.publicInputs, vk);
  }

  onProgress?.({ stage: 'submitting', percent: 92, message: 'Submitting CDP safety tx...' });

  const calldata = [
    toHex(colResult.commitment),           // collateral_commitment
    toHex(debtResult.commitment),          // debt_commitment
    price.toString(),                      // price
    safetyRatioPercent.toString(),         // safety_ratio_percent
    numCdps.toString(),                    // num_cdps
    toHex(BigInt(proofData.length)),       // proof_data Span length
    ...proofData,                          // proof_data elements
  ];

  const result = await account.execute({
    contractAddress: solvencyAddr(),
    entrypoint: 'submit_cdp_safety_proof',
    calldata,
  });

  onProgress?.({ stage: 'confirming', percent: 96, message: 'Waiting for confirmation...' });
  return result.transaction_hash;
}
