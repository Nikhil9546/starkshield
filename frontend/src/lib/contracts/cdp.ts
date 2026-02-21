/**
 * ShieldedCDP contract interaction layer.
 * Wraps starknet.js calls for CDP operations: open, lock, mint, repay, close.
 */

import { Contract, type AccountInterface } from 'starknet';
import { CONTRACT_ADDRESSES, CDP_ABI } from './config';

export function getCDPContract(account: AccountInterface): Contract {
  return new Contract(CDP_ABI, CONTRACT_ADDRESSES.shieldedCDP, account);
}

/**
 * Open a new CDP position.
 */
export async function openCDP(account: AccountInterface): Promise<string> {
  const contract = getCDPContract(account);
  const tx = await contract.invoke('open_cdp', []);
  return tx.transaction_hash;
}

export interface LockCollateralParams {
  amount: bigint;
  commitment: bigint;
  ct_c1: bigint;
  ct_c2: bigint;
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Lock sxyBTC collateral into the CDP.
 */
export async function lockCollateral(
  account: AccountInterface,
  params: LockCollateralParams
): Promise<string> {
  const contract = getCDPContract(account);
  const tx = await contract.invoke('lock_collateral', [
    params.amount,
    params.commitment,
    params.ct_c1,
    params.ct_c2,
    params.proofData,
    params.publicInputs,
    params.nullifier,
  ]);
  return tx.transaction_hash;
}

export interface MintSUSDParams {
  amount: bigint;
  newCollateralCommitment: bigint;
  newDebtCommitment: bigint;
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Mint sUSD stablecoin against locked collateral.
 * Requires a collateral ratio proof (CR >= 200%).
 */
export async function mintSUSD(
  account: AccountInterface,
  params: MintSUSDParams
): Promise<string> {
  const contract = getCDPContract(account);
  const tx = await contract.invoke('mint_susd', [
    params.amount,
    params.newCollateralCommitment,
    params.newDebtCommitment,
    params.proofData,
    params.publicInputs,
    params.nullifier,
  ]);
  return tx.transaction_hash;
}

export interface RepayParams {
  amount: bigint;
  newDebtCommitment: bigint;
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Repay sUSD debt.
 */
export async function repay(
  account: AccountInterface,
  params: RepayParams
): Promise<string> {
  const contract = getCDPContract(account);
  const tx = await contract.invoke('repay', [
    params.amount,
    params.newDebtCommitment,
    params.proofData,
    params.publicInputs,
    params.nullifier,
  ]);
  return tx.transaction_hash;
}

export interface CloseCDPParams {
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Close a CDP position (requires zero debt proof if debt existed).
 */
export async function closeCDP(
  account: AccountInterface,
  params: CloseCDPParams
): Promise<string> {
  const contract = getCDPContract(account);
  const tx = await contract.invoke('close_cdp', [
    params.proofData,
    params.publicInputs,
    params.nullifier,
  ]);
  return tx.transaction_hash;
}

/**
 * Check if user has an open CDP.
 */
export async function getCDPExists(
  account: AccountInterface,
  userAddress: string
): Promise<boolean> {
  const contract = getCDPContract(account);
  const result = await contract.call('get_cdp_exists', [userAddress]);
  return Boolean(result);
}

/**
 * Get locked collateral amount for a user's CDP.
 */
export async function getLockedCollateral(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const contract = getCDPContract(account);
  const result = await contract.call('get_locked_collateral', [userAddress]);
  return BigInt(result.toString());
}

/**
 * Get public debt amount for a user's CDP.
 */
export async function getPublicDebt(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const contract = getCDPContract(account);
  const result = await contract.call('get_public_debt', [userAddress]);
  return BigInt(result.toString());
}

/**
 * Get sUSD balance for a user.
 */
export async function getSUSDBalance(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const contract = getCDPContract(account);
  const result = await contract.call('get_susd_balance', [userAddress]);
  return BigInt(result.toString());
}
