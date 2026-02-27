/**
 * ShieldedCDP contract interaction layer.
 * Uses provider.callContract() for reads and account.execute() for writes.
 */

import { type AccountInterface, RpcProvider } from 'starknet';
import { CONTRACT_ADDRESSES, IS_DEVNET, DEVNET_RESOURCE_BOUNDS, getRpcUrl } from './config';

/** Get a direct RPC provider for read calls */
function getProvider(): RpcProvider {
  const provider = new RpcProvider({ nodeUrl: getRpcUrl() });
  // Cartridge Sepolia RPC doesn't support "pending" block — use "latest"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (provider as any).channel.blockIdentifier = 'latest';
  return provider;
}

const cdpAddr = () => CONTRACT_ADDRESSES.shieldedCDP;
const tokenAddr = () => CONTRACT_ADDRESSES.xyBTC;
const priceFeedAddr = () => CONTRACT_ADDRESSES.priceFeed;

const execOpts = () => IS_DEVNET ? DEVNET_RESOURCE_BOUNDS : {};

/** MockProofVerifier always returns true — send minimal proof data on devnet only */
const mockProofData = () => IS_DEVNET ? ['0xdeadbeef'] : null;

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
  const proofElems = mockProofData() ?? params.proofData;
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
    [
      {
        contractAddress: tokenAddr(),
        entrypoint: 'approve',
        calldata: [cdpAddr(), amtLow, amtHigh],
      },
      {
        contractAddress: cdpAddr(),
        entrypoint: 'lock_collateral',
        calldata,
      },
    ],
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

export interface MintSUSDParams {
  newCollateralCommitment: bigint;
  newDebtCommitment: bigint;
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Mint sUSD stablecoin against locked collateral.
 * Cairo signature: mint_susd(new_debt_commitment: felt252,
 *   new_debt_ct_c1: felt252, new_debt_ct_c2: felt252, nullifier: felt252, proof_data: Span<felt252>)
 */
export async function mintSUSD(
  account: AccountInterface,
  params: MintSUSDParams
): Promise<string> {
  const proofElems = mockProofData() ?? params.proofData;
  const calldata = [
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
  newDebtCommitment: bigint;
  proofData: string[];
  publicInputs: string[];
  nullifier: bigint;
}

/**
 * Repay sUSD debt.
 * Cairo signature: repay(new_debt_commitment: felt252,
 *   new_debt_ct_c1: felt252, new_debt_ct_c2: felt252, nullifier: felt252, proof_data: Span<felt252>)
 */
export async function repay(
  account: AccountInterface,
  params: RepayParams
): Promise<string> {
  const proofElems = mockProofData() ?? params.proofData;
  const calldata = [
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
  const proofElems = mockProofData() ?? params.proofData;
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
  _account: AccountInterface,
  userAddress: string
): Promise<boolean> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'has_cdp',
    calldata: [userAddress],
  });
  return result[0] !== '0x0';
}

/**
 * Get collateral commitment (felt252) for a user's CDP.
 * Returns 0 if no collateral has been locked yet.
 */
export async function getCollateralCommitment(
  _account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'get_collateral_commitment',
    calldata: [userAddress],
  });
  return BigInt(result[0]);
}

/**
 * Get locked collateral amount for a user's CDP.
 */
export async function getLockedCollateral(
  _account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'get_locked_collateral',
    calldata: [userAddress],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return low + (high << BigInt(128));
}

/**
 * Get debt commitment (felt252) for a user's CDP.
 */
export async function getDebtCommitment(
  _account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: cdpAddr(),
    entrypoint: 'get_debt_commitment',
    calldata: [userAddress],
  });
  return BigInt(result[0]);
}

/**
 * Check if the oracle price is fresh (within ORACLE_STALENESS_THRESHOLD = 3600s).
 * Returns { fresh, price, timestamp, blockTimestamp }.
 */
export async function checkOracleFreshness(
  _account: AccountInterface,
): Promise<{ fresh: boolean; price: bigint; oracleTimestamp: number; blockTimestamp: number }> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: priceFeedAddr(),
    entrypoint: 'get_price',
    calldata: [],
  });
  const priceLow = BigInt(result[0]);
  const priceHigh = BigInt(result[1]);
  const price = priceLow + (priceHigh << BigInt(128));
  const oracleTimestamp = Number(BigInt(result[2]));

  // Get latest block timestamp
  const block = await provider.getBlock('latest');
  const blockTimestamp = block.timestamp;

  const ORACLE_STALENESS_THRESHOLD = 3600;
  const fresh = (blockTimestamp - oracleTimestamp) <= ORACLE_STALENESS_THRESHOLD;

  return { fresh, price, oracleTimestamp, blockTimestamp };
}

/**
 * Refresh the MockPriceFeed oracle timestamp to the current time.
 * This is a workaround for testnet/devnet where the mock oracle has a fixed timestamp.
 * On mainnet, a real oracle would self-update.
 */
export async function refreshOracle(
  account: AccountInterface,
): Promise<string> {
  const price = BigInt(50000) * BigInt(1e8); // $50,000
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);

  const result = await account.execute(
    {
      contractAddress: priceFeedAddr(),
      entrypoint: 'set_price',
      calldata: [
        toHex(price & mask),
        toHex(price >> BigInt(128)),
        toHex(timestamp),
      ],
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}
