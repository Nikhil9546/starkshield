/**
 * SolvencyProver contract interaction layer.
 * Read + write functions for vault solvency and CDP safety status.
 */

import { type AccountInterface, RpcProvider, CallData } from 'starknet';
import { CONTRACT_ADDRESSES, getRpcUrl } from './config';

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

/**
 * Submit a vault solvency proof to the SolvencyProver.
 * Only works if the connected wallet is the authorized_prover.
 */
export async function submitVaultSolvencyProof(
  account: AccountInterface,
): Promise<string> {
  const result = await account.execute({
    contractAddress: solvencyAddr(),
    entrypoint: 'submit_vault_solvency_proof',
    calldata: CallData.compile({
      assets_commitment: '0xaaa1',
      liabilities_commitment: '0xbbb1',
      num_accounts: 1,
      proof_data: ['0xdead'],
    }),
  });
  return result.transaction_hash;
}

/**
 * Submit a CDP safety proof to the SolvencyProver.
 * Only works if the connected wallet is the authorized_prover.
 */
export async function submitCdpSafetyProof(
  account: AccountInterface,
): Promise<string> {
  const result = await account.execute({
    contractAddress: solvencyAddr(),
    entrypoint: 'submit_cdp_safety_proof',
    calldata: CallData.compile({
      collateral_commitment: '0xccc1',
      debt_commitment: '0xddd1',
      price: 50000,
      safety_ratio_percent: 200,
      num_cdps: 1,
      proof_data: ['0xdead'],
    }),
  });
  return result.transaction_hash;
}
