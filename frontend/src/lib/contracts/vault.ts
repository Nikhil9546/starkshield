/**
 * ShieldedVault contract interaction layer.
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

const vaultAddr = () => CONTRACT_ADDRESSES.shieldedVault;
const tokenAddr = () => CONTRACT_ADDRESSES.xyBTC;

/** Get execute options — on devnet, skip fee estimation with fixed resource bounds */
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
 * Mint test xyBTC tokens to the caller's address (testnet faucet).
 * MockERC20 has a public mint function.
 */
export async function faucetMint(
  account: AccountInterface,
  toAddress: string,
  amount: bigint,
): Promise<string> {
  const [amtLow, amtHigh] = u256Calldata(amount);
  const result = await account.execute(
    {
      contractAddress: tokenAddr(),
      entrypoint: 'mint',
      calldata: [toAddress, amtLow, amtHigh],
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

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
  const [amtLow, amtHigh] = u256Calldata(amount);
  const result = await account.execute(
    [
      {
        contractAddress: tokenAddr(),
        entrypoint: 'approve',
        calldata: [vaultAddr(), amtLow, amtHigh],
      },
      {
        contractAddress: vaultAddr(),
        entrypoint: 'deposit',
        calldata: [amtLow, amtHigh],
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
  const [amtLow, amtHigh] = u256Calldata(amount);
  const result = await account.execute(
    {
      contractAddress: vaultAddr(),
      entrypoint: 'withdraw',
      calldata: [amtLow, amtHigh],
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

/**
 * Shield: convert public balance to encrypted sxyBTC balance.
 * Requires a range_proof (first shield) or debt_update_validity proof.
 */
export async function shield(
  account: AccountInterface,
  params: ShieldParams,
): Promise<string> {
  const [amtLow, amtHigh] = u256Calldata(params.amount);
  const proofElems = mockProofData() ?? params.proofData;
  const calldata = [
    amtLow, amtHigh,                         // amount: u256
    toHex(params.newBalanceCommitment),        // new_balance_commitment: felt252
    toHex(params.ctDeltaC1),                   // new_ct_c1: felt252
    toHex(params.ctDeltaC2),                   // new_ct_c2: felt252
    toHex(params.nullifier),                   // nullifier: felt252
    toHex(BigInt(proofElems.length)),           // proof_data length (Span prefix)
    ...proofElems,                             // proof_data elements
  ];

  const result = await account.execute(
    {
      contractAddress: vaultAddr(),
      entrypoint: 'shield',
      calldata,
    },
    undefined,
    execOpts(),
  );
  return result.transaction_hash;
}

/**
 * Unshield: convert encrypted sxyBTC back to public balance.
 * Requires a balance_sufficiency proof.
 */
export async function unshield(
  account: AccountInterface,
  params: ShieldParams,
): Promise<string> {
  const [amtLow, amtHigh] = u256Calldata(params.amount);
  const proofElems = mockProofData() ?? params.proofData;
  const calldata = [
    amtLow, amtHigh,
    toHex(params.newBalanceCommitment),
    toHex(params.ctDeltaC1),
    toHex(params.ctDeltaC2),
    toHex(params.nullifier),
    toHex(BigInt(proofElems.length)),
    ...proofElems,
  ];

  const result = await account.execute(
    {
      contractAddress: vaultAddr(),
      entrypoint: 'unshield',
      calldata,
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
  _account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const provider = getProvider();
  const result = await provider.callContract({
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
  _account: AccountInterface,
  userAddress: string
): Promise<bigint> {
  const provider = getProvider();
  const result = await provider.callContract({
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
  _account: AccountInterface,
  userAddress: string
): Promise<{ c1: bigint; c2: bigint }> {
  const provider = getProvider();
  const result = await provider.callContract({
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
  _account: AccountInterface
): Promise<bigint> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: vaultAddr(),
    entrypoint: 'get_total_deposited',
    calldata: [],
  });
  const low = BigInt(result[0]);
  const high = BigInt(result[1]);
  return low + (high << BigInt(128));
}
