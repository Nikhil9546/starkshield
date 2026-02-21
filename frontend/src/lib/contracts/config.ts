/**
 * Contract addresses and ABI configuration.
 * Addresses are loaded from environment variables (set after deployment).
 */

export const NETWORK = import.meta.env.VITE_STARKNET_NETWORK || 'sepolia';

export const IS_DEVNET = NETWORK === 'devnet';

/** Devnet predeployed account (only used when VITE_STARKNET_NETWORK=devnet) */
export const DEVNET_ACCOUNT = {
  address: '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691',
  privateKey: '0x71d7bb07b9a64f6f78ac4c816aff4da9',
};

export const CONTRACT_ADDRESSES = {
  shieldedVault: import.meta.env.VITE_VAULT_ADDRESS || '',
  shieldedCDP: import.meta.env.VITE_CDP_ADDRESS || '',
  proofVerifier: import.meta.env.VITE_VERIFIER_ADDRESS || '',
  solvencyProver: import.meta.env.VITE_SOLVENCY_ADDRESS || '',
  priceFeed: import.meta.env.VITE_PRICE_FEED_ADDRESS || '',
  xyBTC: import.meta.env.VITE_XYBTC_ADDRESS || '',
  sxyBTC: import.meta.env.VITE_SXYBTC_ADDRESS || '',
} as const;

/** Starknet RPC endpoints by network */
const RPC_URLS: Record<string, string> = {
  devnet: 'http://localhost:5050',
  sepolia: 'https://starknet-sepolia.public.blastapi.io',
  mainnet: 'https://starknet-mainnet.public.blastapi.io',
};

export function getRpcUrl(): string {
  return import.meta.env.VITE_RPC_URL || RPC_URLS[NETWORK] || RPC_URLS.sepolia;
}

/**
 * Default resource bounds for devnet transactions (skip fee estimation).
 * Devnet doesn't support the fee estimation query transaction versions.
 */
export const DEVNET_RESOURCE_BOUNDS = {
  resourceBounds: {
    l1_gas: { max_amount: '0x2710', max_price_per_unit: '0x174876e800' },
    l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    l1_data_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
  },
};

/** Simplified ABIs for contract interaction (function selectors only) */
export const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'commitment', type: 'core::felt252' },
      { name: 'ct_c1', type: 'core::felt252' },
      { name: 'ct_c2', type: 'core::felt252' },
      { name: 'proof_data', type: 'core::array::Array::<core::felt252>' },
      { name: 'public_inputs', type: 'core::array::Array::<core::felt252>' },
      { name: 'nullifier', type: 'core::felt252' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'new_commitment', type: 'core::felt252' },
      { name: 'delta_c1', type: 'core::felt252' },
      { name: 'delta_c2', type: 'core::felt252' },
      { name: 'proof_data', type: 'core::array::Array::<core::felt252>' },
      { name: 'public_inputs', type: 'core::array::Array::<core::felt252>' },
      { name: 'nullifier', type: 'core::felt252' },
    ],
    outputs: [],
  },
  {
    name: 'unshield',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'new_commitment', type: 'core::felt252' },
      { name: 'delta_c1', type: 'core::felt252' },
      { name: 'delta_c2', type: 'core::felt252' },
      { name: 'proof_data', type: 'core::array::Array::<core::felt252>' },
      { name: 'public_inputs', type: 'core::array::Array::<core::felt252>' },
      { name: 'nullifier', type: 'core::felt252' },
    ],
    outputs: [],
  },
  {
    name: 'get_balance_commitment',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::ContractAddress' }],
    outputs: [{ type: 'core::felt252' }],
    state_mutability: 'view',
  },
  {
    name: 'get_balance_ciphertext',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::ContractAddress' }],
    outputs: [{ type: '(core::felt252, core::felt252)' }],
    state_mutability: 'view',
  },
  {
    name: 'get_total_deposited',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
] as const;

export const CDP_ABI = [
  {
    name: 'open_cdp',
    type: 'function',
    inputs: [],
    outputs: [],
  },
  {
    name: 'lock_collateral',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'commitment', type: 'core::felt252' },
      { name: 'ct_c1', type: 'core::felt252' },
      { name: 'ct_c2', type: 'core::felt252' },
      { name: 'proof_data', type: 'core::array::Array::<core::felt252>' },
      { name: 'public_inputs', type: 'core::array::Array::<core::felt252>' },
      { name: 'nullifier', type: 'core::felt252' },
    ],
    outputs: [],
  },
  {
    name: 'mint_susd',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'new_collateral_commitment', type: 'core::felt252' },
      { name: 'new_debt_commitment', type: 'core::felt252' },
      { name: 'proof_data', type: 'core::array::Array::<core::felt252>' },
      { name: 'public_inputs', type: 'core::array::Array::<core::felt252>' },
      { name: 'nullifier', type: 'core::felt252' },
    ],
    outputs: [],
  },
  {
    name: 'repay',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'new_debt_commitment', type: 'core::felt252' },
      { name: 'proof_data', type: 'core::array::Array::<core::felt252>' },
      { name: 'public_inputs', type: 'core::array::Array::<core::felt252>' },
      { name: 'nullifier', type: 'core::felt252' },
    ],
    outputs: [],
  },
  {
    name: 'close_cdp',
    type: 'function',
    inputs: [
      { name: 'proof_data', type: 'core::array::Array::<core::felt252>' },
      { name: 'public_inputs', type: 'core::array::Array::<core::felt252>' },
      { name: 'nullifier', type: 'core::felt252' },
    ],
    outputs: [],
  },
  {
    name: 'get_cdp_exists',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::ContractAddress' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    name: 'get_locked_collateral',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_public_debt',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_susd_balance',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
] as const;
