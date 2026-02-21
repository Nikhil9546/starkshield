// StarkShield v1.5 -- interfaces
//
// Trait definitions for all protocol contracts.

use starknet::ContractAddress;

/// Interface for the ShieldedVault contract.
/// Handles deposit/withdraw of public assets and shield/unshield for encrypted balances.
#[starknet::interface]
pub trait IShieldedVault<TContractState> {
    /// Deposit public xyBTC tokens into the vault.
    fn deposit(ref self: TContractState, amount: u256);

    /// Withdraw public xyBTC tokens from the vault.
    fn withdraw(ref self: TContractState, amount: u256);

    /// Shield: burn public balance and create encrypted sxyBTC balance.
    /// Requires a valid ZK proof binding the amount to the new commitment.
    fn shield(
        ref self: TContractState,
        amount: u256,
        new_balance_commitment: felt252,
        new_ct_c1: felt252,
        new_ct_c2: felt252,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Unshield: burn encrypted sxyBTC balance and credit public balance.
    /// Requires a balance_sufficiency proof.
    fn unshield(
        ref self: TContractState,
        amount: u256,
        new_balance_commitment: felt252,
        new_ct_c1: felt252,
        new_ct_c2: felt252,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Pause the vault (owner only).
    fn pause(ref self: TContractState);

    /// Unpause the vault (owner only).
    fn unpause(ref self: TContractState);

    // -- View functions --

    fn get_public_balance(self: @TContractState, account: ContractAddress) -> u256;
    fn get_encrypted_balance(self: @TContractState, account: ContractAddress) -> (felt252, felt252);
    fn get_balance_commitment(self: @TContractState, account: ContractAddress) -> felt252;
    fn get_total_deposited(self: @TContractState) -> u256;
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
    fn is_paused(self: @TContractState) -> bool;
}

/// Interface for the ShieldedCDP contract.
/// Handles private collateralized debt positions: lock sxyBTC, mint sUSD, repay, close.
/// Liquidation uses Mode A: Disclosure-on-Liquidation (challenge/response window).
#[starknet::interface]
pub trait IShieldedCDP<TContractState> {
    /// Open a new CDP position for the caller.
    fn open_cdp(ref self: TContractState);

    /// Lock collateral (xyBTC) into the CDP.
    fn lock_collateral(
        ref self: TContractState,
        amount: u256,
        new_collateral_commitment: felt252,
        new_col_ct_c1: felt252,
        new_col_ct_c2: felt252,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Unlock collateral from the CDP. Requires collateral_ratio proof to ensure still safe.
    fn unlock_collateral(
        ref self: TContractState,
        amount: u256,
        new_collateral_commitment: felt252,
        new_col_ct_c1: felt252,
        new_col_ct_c2: felt252,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Mint sUSD against locked collateral.
    /// Requires collateral_ratio proof and non-stale oracle price.
    fn mint_susd(
        ref self: TContractState,
        amount: u256,
        new_debt_commitment: felt252,
        new_debt_ct_c1: felt252,
        new_debt_ct_c2: felt252,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Repay sUSD debt.
    /// Requires debt_update_validity proof (repayment).
    fn repay(
        ref self: TContractState,
        amount: u256,
        new_debt_commitment: felt252,
        new_debt_ct_c1: felt252,
        new_debt_ct_c2: felt252,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Close CDP position. Requires zero_debt proof.
    /// Returns all locked collateral to the user.
    fn close_cdp(
        ref self: TContractState,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Trigger liquidation challenge on a user's CDP (anyone can call).
    fn trigger_liquidation(ref self: TContractState, user: ContractAddress);

    /// User proves their CDP is healthy during a liquidation window.
    fn prove_health(
        ref self: TContractState,
        nullifier: felt252,
        proof_data: Span<felt252>,
    );

    /// Execute liquidation after the disclosure window expires.
    fn execute_liquidation(ref self: TContractState, user: ContractAddress);

    /// Pause the CDP system (owner only).
    fn pause(ref self: TContractState);

    /// Unpause the CDP system (owner only).
    fn unpause(ref self: TContractState);

    // -- View functions --

    fn has_cdp(self: @TContractState, account: ContractAddress) -> bool;
    fn get_collateral_commitment(self: @TContractState, account: ContractAddress) -> felt252;
    fn get_encrypted_collateral(
        self: @TContractState, account: ContractAddress,
    ) -> (felt252, felt252);
    fn get_debt_commitment(self: @TContractState, account: ContractAddress) -> felt252;
    fn get_encrypted_debt(self: @TContractState, account: ContractAddress) -> (felt252, felt252);
    fn get_susd_balance(self: @TContractState, account: ContractAddress) -> u256;
    fn get_locked_collateral(self: @TContractState, account: ContractAddress) -> u256;
    fn get_total_debt_minted(self: @TContractState) -> u256;
    fn is_in_liquidation(self: @TContractState, account: ContractAddress) -> bool;
    fn get_liquidation_deadline(self: @TContractState, account: ContractAddress) -> u64;
    fn is_cdp_paused(self: @TContractState) -> bool;
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
}

/// Simple price feed oracle interface.
/// Returns the latest price and its timestamp for staleness checks.
#[starknet::interface]
pub trait IPriceFeed<TContractState> {
    fn get_price(self: @TContractState) -> (u256, u64);
}

/// Interface for the SolvencyProver contract.
/// Accepts and verifies per-domain solvency proofs (Vault + CDP separately).
/// An authorized prover submits proofs periodically; anyone can query status.
#[starknet::interface]
pub trait ISolvencyProver<TContractState> {
    /// Submit a vault solvency proof (vault_solvency circuit).
    /// Proves: total_assets >= total_liabilities.
    fn submit_vault_solvency_proof(
        ref self: TContractState,
        assets_commitment: felt252,
        liabilities_commitment: felt252,
        num_accounts: u32,
        proof_data: Span<felt252>,
    );

    /// Submit a CDP safety bound proof (cdp_safety_bound circuit).
    /// Proves: total_collateral * price * 100 >= total_debt * safety_ratio_percent.
    fn submit_cdp_safety_proof(
        ref self: TContractState,
        collateral_commitment: felt252,
        debt_commitment: felt252,
        price: u64,
        safety_ratio_percent: u64,
        num_cdps: u32,
        proof_data: Span<felt252>,
    );

    /// Set the authorized prover address (owner only).
    fn set_prover(ref self: TContractState, prover: ContractAddress);

    /// Pause the solvency prover (owner only).
    fn pause(ref self: TContractState);

    /// Unpause the solvency prover (owner only).
    fn unpause(ref self: TContractState);

    // -- View functions --

    fn is_vault_solvent(self: @TContractState) -> bool;
    fn get_vault_last_verified(self: @TContractState) -> u64;
    fn get_vault_assets_commitment(self: @TContractState) -> felt252;
    fn get_vault_liabilities_commitment(self: @TContractState) -> felt252;
    fn get_vault_num_accounts(self: @TContractState) -> u32;
    fn is_cdp_safe(self: @TContractState) -> bool;
    fn get_cdp_last_verified(self: @TContractState) -> u64;
    fn get_cdp_collateral_commitment(self: @TContractState) -> felt252;
    fn get_cdp_debt_commitment(self: @TContractState) -> felt252;
    fn get_cdp_num_cdps(self: @TContractState) -> u32;
    fn get_prover(self: @TContractState) -> ContractAddress;
    fn is_solvency_paused(self: @TContractState) -> bool;
}

/// Interface for ZK proof verification.
/// Routes verification calls to the appropriate Garaga-generated verifier contract.
#[starknet::interface]
pub trait IProofVerifier<TContractState> {
    /// Verify a ZK proof for the given circuit type.
    fn verify(
        self: @TContractState,
        circuit_type: u8,
        public_inputs: Span<felt252>,
        proof: Span<felt252>,
    ) -> bool;

    /// Set the verifier contract address for a circuit type (owner only).
    fn set_verifier(
        ref self: TContractState,
        circuit_type: u8,
        verifier_address: ContractAddress,
    );
}
