// StarkShield v1.5 -- types
//
// Core type definitions for the privacy-preserving vault and CDP system.

/// ElGamal-encrypted value stored on-chain.
/// Each component is a compressed elliptic curve point.
/// Supports additive homomorphism: Enc(a) + Enc(b) = Enc(a + b).
#[derive(Copy, Drop, Serde, starknet::Store, PartialEq)]
pub struct Ciphertext {
    pub c1: felt252,
    pub c2: felt252,
}

/// Proof type identifiers for domain separation.
/// Each circuit has a unique ID so proofs cannot be reused across circuits.
pub mod ProofTypes {
    pub const RANGE_PROOF: u8 = 1;
    pub const BALANCE_SUFFICIENCY: u8 = 2;
    pub const COLLATERAL_RATIO: u8 = 3;
    pub const DEBT_UPDATE_VALIDITY: u8 = 4;
    pub const ZERO_DEBT: u8 = 5;
    pub const VAULT_SOLVENCY: u8 = 6;
    pub const CDP_SAFETY_BOUND: u8 = 7;
}
