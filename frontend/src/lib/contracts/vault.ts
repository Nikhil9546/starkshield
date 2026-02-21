/**
 * ShieldedVault contract interaction layer.
 * Uses provider.callContract() for reads and account.execute() for writes.
 */

import { type AccountInterface, CallData, cairo } from 'starknet';
import { CONTRACT_ADDRESSES, IS_DEVNET, DEVNET_RESOURCE_BOUNDS } from './config';

const vaultAddr = () => CONTRACT_ADDRESSES.shieldedVault;
const tokenAddr = () => CONTRACT_ADDRESSES.xyBTC;

/** Get execute options — on devnet, skip fee estimation with fixed resource bounds */
const execOpts = () => IS_DEVNET ? DEVNET_RESOURCE_BOUNDS : {};

export interface ShieldParams {
  amount: bigint;
  newBalanceCommitment: bigint;
  ctDeltaC1: bigint;
  ctDeltaC2: bigint;
  proofData: string[];
  nullifier: bigint;
}

/**
 * Deposit xyBTC into the ShieldedVault (public balance).
 * Handles ERC20 approve + vault.deposit in a multicall.
 */
export async function deposit(
  account: AccountInterface,
  amount: bigint,
): Promise<string> {
  const result = await account.execute(
    [
      {
        contractAddress: tokenAddr(),
        entrypoint: 'approve',
        calldata: CallData.compile({
          spender: vaultAddr(),
          amount: cairo.uint256(amount),
        }),
      },
      {
        contractAddress: vaultAddr(),
        entrypoint: 'deposit',
        calldata: CallData.compile({
          amount: cairo.uint256(amount),
        }),
      },
    ],
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

/**
 * Withdraw public xyBTC from the vault.
 */
export async function withdraw(
  account: AccountInterface,
  amount: bigint,
): Promise<string> {
  const result = await account.execute(
    {
      contractAddress: vaultAddr(),
      entrypoint: 'withdraw',
      calldata: CallData.compile({
        amount: cairo.uint256(amount),
      }),
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

/**
 * Shield: convert public balance to encrypted sxyBTC balance.
 * Requires a BALANCE_SUFFICIENCY proof.
 */
export async function shield(
  account: AccountInterface,
  params: ShieldParams,
): Promise<string> {
  const result = await account.execute(
    {
      contractAddress: vaultAddr(),
      entrypoint: 'shield',
      calldata: CallData.compile({
        amount: cairo.uint256(params.amount),
        new_balance_commitment: params.newBalanceCommitment.toString(),
        new_ct_c1: params.ctDeltaC1.toString(),
        new_ct_c2: params.ctDeltaC2.toString(),
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
 * Unshield: convert encrypted sxyBTC back to public balance.
 * Requires a BALANCE_SUFFICIENCY proof.
 */
export async function unshield(
  account: AccountInterface,
  params: ShieldParams,
): Promise<string> {
  const result = await account.execute(
    {
      contractAddress: vaultAddr(),
      entrypoint: 'unshield',
      calldata: CallData.compile({
        amount: cairo.uint256(params.amount),
        new_balance_commitment: params.newBalanceCommitment.toString(),
        new_ct_c1: params.ctDeltaC1.toString(),
        new_ct_c2: params.ctDeltaC2.toString(),
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
 * Read public balance for user.
 */
export async function getPublicBalance(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const result = await account.callContract({
    contractAddress: vaultAddr(),
    entrypoint: 'get_public_balance',
    calldata: [userAddress],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return low + (high << BigInt(128));
}

/**
 * Read the on-chain balance commitment for a user.
 */
export async function getBalanceCommitment(
  account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const result = await account.callContract({
    contractAddress: vaultAddr(),
    entrypoint: 'get_balance_commitment',
    calldata: [userAddress],
  });
  return BigInt(result[0]);
}

/**
 * Read the encrypted balance ciphertext for a user.
 */
export async function getBalanceCiphertext(
  account: AccountInterface,
  userAddress: string
): Promise<{ c1: bigint; c2: bigint }> {
  const result = await account.callContract({
    contractAddress: vaultAddr(),
    entrypoint: 'get_encrypted_balance',
    calldata: [userAddress],
  });
  return { c1: BigInt(result[0]), c2: BigInt(result[1]) };
}

/**
 * Read the total deposited amount in the vault (public aggregate).
 */
export async function getTotalDeposited(
  account: AccountInterface
): Promise<bigint> {
  const result = await account.callContract({
    contractAddress: vaultAddr(),
    entrypoint: 'get_total_deposited',
    calldata: [],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return low + (high << BigInt(128));
}
