// Obscura v1.5 -- constants
//
// Protocol-level constants. MIN_CR is hardcoded for v1.5 (not governance-controlled).

/// Minimum collateral ratio: 200%
pub const MIN_CR_PERCENT: u64 = 200;

/// Maximum single deposit (1000 tokens with 18 decimals)
pub const MAX_DEPOSIT: u256 = 1000000000000000000000;

/// Oracle staleness threshold in seconds (1 hour)
pub const ORACLE_STALENESS_THRESHOLD: u64 = 3600;

/// Price precision: 10^8
pub const PRICE_PRECISION: u256 = 100000000;

/// Zero commitment sentinel (represents uninitialized balance commitment)
pub const ZERO_COMMITMENT: felt252 = 0;

/// Liquidation window duration in seconds (24 hours)
pub const LIQUIDATION_WINDOW: u64 = 86400;
