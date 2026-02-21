/**
 * ShieldedCDP contract interaction layer.
 * Uses provider.callContract() for reads and account.execute() for writes.
 */

import { type AccountInterface, CallData, cairo } from 'starknet';
import { CONTRACT_ADDRESSES, IS_DEVNET, DEVNET_RESOURCE_BOUNDS } from './config';

const cdpAddr = () => CONTRACT_ADDRESSES.shieldedCDP;

const execOpts = () => IS_DEVNET ? DEVNET_RESOURCE_BOUNDS : {};

/**
 * Open a new CDP position.
 */
export async function openCDP(account: AccountInterface): Promise<string> {
  const result = await account.execute(
    {
      contractAddress: cdpAddr(),
      entrypoint: 'open_cdp',
      calldata: [],
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
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
  const result = await account.execute(
    {
      contractAddress: cdpAddr(),
      entrypoint: 'lock_collateral',
      calldata: CallData.compile({
        amount: cairo.uint256(params.amount),
        new_collateral_commitment: params.commitment.toString(),
        new_col_ct_c1: params.ct_c1.toString(),
        new_col_ct_c2: params.ct_c2.toString(),
        nullifier: params.nullifier.toString(),
        proof_data: params.proofData,
      }),
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
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
 */
export async function mintSUSD(
  account: AccountInterface,
  params: MintSUSDParams
): Promise<string> {
  const result = await account.execute(
    {
      contractAddress: cdpAddr(),
      entrypoint: 'mint_susd',
      calldata: CallData.compile({
        amount: cairo.uint256(params.amount),
        new_collateral_commitment: params.newCollateralCommitment.toString(),
        new_debt_commitment: params.newDebtCommitment.toString(),
        nullifier: params.nullifier.toString(),
        proof_data: params.proofData,
      }),
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
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
  const result = await account.execute(
    {
      contractAddress: cdpAddr(),
      entrypoint: 'repay',
      calldata: CallData.compile({
        amount: cairo.uint256(params.amount),
        new_debt_commitment: params.newDebtCommitment.toString(),
        nullifier: params.nullifier.toString(),
        proof_data: params.proofData,
      }),
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

export interface CloseCDPParams {
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Close a CDP position.
 */
export async function closeCDP(
  account: AccountInterface,
  params: CloseCDPParams
): Promise<string> {
  const result = await account.execute(
    {
      contractAddress: cdpAddr(),
      entrypoint: 'close_cdp',
      calldata: CallData.compile({
        nullifier: params.nullifier.toString(),
        proof_data: params.proofData,
      }),
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

/**
 * Check if user has an open CDP.
 */
export async function hasCDP(
  account: AccountInterface,
  userAddress: string
): Promise<boolean> {
  const result = await account.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'has_cdp',
    calldata: [userAddress],
  });
  return result[0] !== '0x0';
}

/**
 * Get locked collateral amount for a user's CDP.
 */
export async function getLockedCollateral(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const result = await account.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'get_locked_collateral',
    calldata: [userAddress],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return low + (high << BigInt(128));
}

/**
 * Get sUSD balance for a user.
 */
export async function getSUSDBalance(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const result = await account.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'get_susd_balance',
    calldata: [userAddress],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return low + (high << BigInt(128));
}

/**
 * Get total debt minted across all CDPs.
 */
export async function getTotalDebtMinted(
  account: AccountInterface
): Promise<bigint> {
  const result = await account.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'get_total_debt_minted',
    calldata: [],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return low + (high << BigInt(128));
}
