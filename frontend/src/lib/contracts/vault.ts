/**
 * ShieldedVault contract interaction layer.
 * Wraps starknet.js calls for deposit, withdraw, and unshield operations.
 */

import { Contract, type AccountInterface } from 'starknet';
import { CONTRACT_ADDRESSES, VAULT_ABI } from './config';

export function getVaultContract(account: AccountInterface): Contract {
  return new Contract(VAULT_ABI, CONTRACT_ADDRESSES.shieldedVault, account);
}

export interface DepositParams {
  amount: bigint;
  commitment: bigint;
  ct_c1: bigint;
  ct_c2: bigint;
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

export interface WithdrawParams {
  amount: bigint;
  newCommitment: bigint;
  delta_c1: bigint;
  delta_c2: bigint;
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Deposit BTC into the ShieldedVault.
 * Requires a range proof that the deposited amount is valid.
 */
export async function deposit(
  account: AccountInterface,
  params: DepositParams
): Promise<string> {
  const contract = getVaultContract(account);
  const tx = await contract.invoke('deposit', [
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

/**
 * Withdraw staked tokens from the vault (still shielded as sxyBTC).
 * Requires a balance sufficiency proof.
 */
export async function withdraw(
  account: AccountInterface,
  params: WithdrawParams
): Promise<string> {
  const contract = getVaultContract(account);
  const tx = await contract.invoke('withdraw', [
    params.amount,
    params.newCommitment,
    params.delta_c1,
    params.delta_c2,
    params.proofData,
    params.publicInputs,
    params.nullifier,
  ]);
  return tx.transaction_hash;
}

/**
 * Unshield — convert sxyBTC back to public xyBTC.
 * Requires a balance sufficiency proof.
 */
export async function unshield(
  account: AccountInterface,
  params: WithdrawParams
): Promise<string> {
  const contract = getVaultContract(account);
  const tx = await contract.invoke('unshield', [
    params.amount,
    params.newCommitment,
    params.delta_c1,
    params.delta_c2,
    params.proofData,
    params.publicInputs,
    params.nullifier,
  ]);
  return tx.transaction_hash;
}

/**
 * Read the on-chain balance commitment for a user.
 */
export async function getBalanceCommitment(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const contract = getVaultContract(account);
  const result = await contract.call('get_balance_commitment', [userAddress]);
  return BigInt(result.toString());
}

/**
 * Read the encrypted balance ciphertext for a user.
 */
export async function getBalanceCiphertext(
  account: AccountInterface,
  userAddress: string
): Promise<{ c1: bigint; c2: bigint }> {
  const contract = getVaultContract(account);
  const result = await contract.call('get_balance_ciphertext', [userAddress]);
  const arr = result as bigint[];
  return { c1: BigInt(arr[0].toString()), c2: BigInt(arr[1].toString()) };
}

/**
 * Read the total deposited amount in the vault (public aggregate).
 */
export async function getTotalDeposited(
  account: AccountInterface
): Promise<bigint> {
  const contract = getVaultContract(account);
  const result = await contract.call('get_total_deposited', []);
  return BigInt(result.toString());
}
