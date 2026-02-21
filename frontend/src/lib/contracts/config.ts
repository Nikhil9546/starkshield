/**
 * Contract addresses and ABI configuration.
 * Addresses are loaded from environment variables (set after deployment).
 */

export const NETWORK = import.meta.env.VITE_STARKNET_NETWORK || 'sepolia';

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
  sepolia: 'https://starknet-sepolia.public.blastapi.io',
  mainnet: 'https://starknet-mainnet.public.blastapi.io',
};

export function getRpcUrl(): string {
  return import.meta.env.VITE_RPC_URL || RPC_URLS[NETWORK] || RPC_URLS.sepolia;
}

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
