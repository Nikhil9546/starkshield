/**
 * ShieldedCDP contract interaction layer.
 * Uses provider.callContract() for reads and account.execute() for writes.
 */

import { type AccountInterface } from 'starknet';
import { CONTRACT_ADDRESSES, IS_DEVNET, DEVNET_RESOURCE_BOUNDS } from './config';

const cdpAddr = () => CONTRACT_ADDRESSES.shieldedCDP;

const execOpts = () => IS_DEVNET ? DEVNET_RESOURCE_BOUNDS : {};

/** On devnet, MockProofVerifier always returns true — send minimal proof data to avoid large-calldata RPC issues */
const devnetProofData = () => IS_DEVNET ? ['0xdeadbeef'] : null;

/** Convert a bigint to 0x-prefixed hex string */
function toHex(v: bigint): string {
  return '0x' + v.toString(16);
}

/** Split a bigint into u256 calldata [low, high] */
function u256Calldata(v: bigint): [string, string] {
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
  return [toHex(v & mask), toHex(v >> BigInt(128))];
}

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
 * Cairo signature: lock_collateral(amount: u256, new_collateral_commitment: felt252,
 *   new_col_ct_c1: felt252, new_col_ct_c2: felt252, nullifier: felt252, proof_data: Span<felt252>)
 */
export async function lockCollateral(
  account: AccountInterface,
  params: LockCollateralParams
): Promise<string> {
  const [amtLow, amtHigh] = u256Calldata(params.amount);
  const proofElems = devnetProofData() ?? params.proofData;
  const calldata = [
    amtLow, amtHigh,
    toHex(params.commitment),
    toHex(params.ct_c1),
    toHex(params.ct_c2),
    toHex(params.nullifier),
    toHex(BigInt(proofElems.length)),
    ...proofElems,
  ];
  const result = await account.execute(
    { contractAddress: cdpAddr(), entrypoint: 'lock_collateral', calldata },
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
 * Cairo signature: mint_susd(amount: u256, new_debt_commitment: felt252,
 *   new_debt_ct_c1: felt252, new_debt_ct_c2: felt252, nullifier: felt252, proof_data: Span<felt252>)
 */
export async function mintSUSD(
  account: AccountInterface,
  params: MintSUSDParams
): Promise<string> {
  const [amtLow, amtHigh] = u256Calldata(params.amount);
  const proofElems = devnetProofData() ?? params.proofData;
  const calldata = [
    amtLow, amtHigh,
    toHex(params.newDebtCommitment),
    '0x0', // new_debt_ct_c1
    '0x0', // new_debt_ct_c2
    toHex(params.nullifier),
    toHex(BigInt(proofElems.length)),
    ...proofElems,
  ];
  const result = await account.execute(
    { contractAddress: cdpAddr(), entrypoint: 'mint_susd', calldata },
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
 * Cairo signature: repay(amount: u256, new_debt_commitment: felt252,
 *   new_debt_ct_c1: felt252, new_debt_ct_c2: felt252, nullifier: felt252, proof_data: Span<felt252>)
 */
export async function repay(
  account: AccountInterface,
  params: RepayParams
): Promise<string> {
  const [amtLow, amtHigh] = u256Calldata(params.amount);
  const proofElems = devnetProofData() ?? params.proofData;
  const calldata = [
    amtLow, amtHigh,
    toHex(params.newDebtCommitment),
    '0x0', // new_debt_ct_c1
    '0x0', // new_debt_ct_c2
    toHex(params.nullifier),
    toHex(BigInt(proofElems.length)),
    ...proofElems,
  ];
  const result = await account.execute(
    { contractAddress: cdpAddr(), entrypoint: 'repay', calldata },
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
 * Cairo signature: close_cdp(nullifier: felt252, proof_data: Span<felt252>)
 */
export async function closeCDP(
  account: AccountInterface,
  params: CloseCDPParams
): Promise<string> {
  const proofElems = devnetProofData() ?? params.proofData;
  const calldata = [
    toHex(params.nullifier),
    toHex(BigInt(proofElems.length)),
    ...proofElems,
  ];
  const result = await account.execute(
    { contractAddress: cdpAddr(), entrypoint: 'close_cdp', calldata },
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
