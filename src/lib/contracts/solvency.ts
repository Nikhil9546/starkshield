/**
 * SolvencyProver contract interaction layer.
 * Read-only functions for vault solvency and CDP safety status.
 */

import { type AccountInterface } from 'starknet';
import { CONTRACT_ADDRESSES } from './config';

const solvencyAddr = () => CONTRACT_ADDRESSES.solvencyProver;

/**
 * Check if the vault domain is currently verified solvent.
 */
export async function isVaultSolvent(
  account: AccountInterface,
): Promise<boolean> {
  const result = await account.callContract({
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
  account: AccountInterface,
): Promise<number> {
  const result = await account.callContract({
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
  account: AccountInterface,
): Promise<boolean> {
  const result = await account.callContract({
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
  account: AccountInterface,
): Promise<number> {
  const result = await account.callContract({
    contractAddress: solvencyAddr(),
    entrypoint: 'get_cdp_last_verified',
    calldata: [],
  });
  return Number(BigInt(result[0]));
}
