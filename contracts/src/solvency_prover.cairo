// Obscura v1.5 -- solvency_prover
//
// Per-domain solvency verification for Vault and CDP domains.
// An authorized prover submits ZK proofs periodically. The contract verifies
// them via ProofVerifier and records the latest verification result.
//
// Two proof types:
//   - vault_solvency: proves total vault assets >= total liabilities
//   - cdp_safety_bound: proves aggregate CDP collateral meets safety ratio
//
// Design decision: per-domain solvency only (no cross-domain coupling).
// Each domain is proven independently. This avoids circular dependencies
// between the vault and CDP systems.

#[starknet::contract]
pub mod SolvencyProver {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{get_caller_address, get_block_timestamp};
    use core::num::traits::Zero;
    use crate::types::ProofTypes;
    use crate::interfaces::{
        ISolvencyProver, IProofVerifierDispatcher, IProofVerifierDispatcherTrait,
    };

    // =========================================================================
    // Storage
    // =========================================================================

    #[storage]
    struct Storage {
        owner: ContractAddress,
        proof_verifier: ContractAddress,
        authorized_prover: ContractAddress,
        paused: bool,
        // Vault solvency domain
        vault_solvent: bool,
        vault_last_verified: u64,
        vault_assets_commitment: felt252,
        vault_liabilities_commitment: felt252,
        vault_num_accounts: u32,
        // CDP safety domain
        cdp_safe: bool,
        cdp_last_verified: u64,
        cdp_collateral_commitment: felt252,
        cdp_debt_commitment: felt252,
        cdp_num_cdps: u32,
    }

    // =========================================================================
    // Events
    // =========================================================================

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        VaultSolvencyVerified: VaultSolvencyVerified,
        CDPSafetyVerified: CDPSafetyVerified,
        ProverUpdated: ProverUpdated,
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    struct VaultSolvencyVerified {
        #[key]
        prover: ContractAddress,
        assets_commitment: felt252,
        liabilities_commitment: felt252,
        num_accounts: u32,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct CDPSafetyVerified {
        #[key]
        prover: ContractAddress,
        collateral_commitment: felt252,
        debt_commitment: felt252,
        price: u64,
        safety_ratio_percent: u64,
        num_cdps: u32,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct ProverUpdated {
        old_prover: ContractAddress,
        new_prover: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct Paused {}

    #[derive(Drop, starknet::Event)]
    struct Unpaused {}

    // =========================================================================
    // Constructor
    // =========================================================================

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        proof_verifier: ContractAddress,
        authorized_prover: ContractAddress,
    ) {
        assert(!owner.is_zero(), 'owner is zero address');
        assert(!proof_verifier.is_zero(), 'verifier is zero address');
        assert(!authorized_prover.is_zero(), 'prover is zero address');
        self.owner.write(owner);
        self.proof_verifier.write(proof_verifier);
        self.authorized_prover.write(authorized_prover);
        self.paused.write(false);
    }

    // =========================================================================
    // External functions
    // =========================================================================

    #[abi(embed_v0)]
    impl SolvencyProverImpl of ISolvencyProver<ContractState> {
        /// Submit a vault solvency proof.
        /// Only the authorized prover can submit. The proof is verified via ProofVerifier
        /// using the VAULT_SOLVENCY circuit type.
        fn submit_vault_solvency_proof(
            ref self: ContractState,
            assets_commitment: felt252,
            liabilities_commitment: felt252,
            num_accounts: u32,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            self.assert_authorized_prover();
            assert(assets_commitment != 0, 'invalid assets commitment');
            assert(liabilities_commitment != 0, 'invalid liab commitment');
            assert(num_accounts > 0, 'num accounts must be positive');

            // Verify the vault_solvency proof
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };

            let verified = verifier
                .verify(ProofTypes::VAULT_SOLVENCY, proof_data);
            assert(verified, 'vault solvency proof failed');

            // Record verified state
            let now = get_block_timestamp();
            self.vault_solvent.write(true);
            self.vault_last_verified.write(now);
            self.vault_assets_commitment.write(assets_commitment);
            self.vault_liabilities_commitment.write(liabilities_commitment);
            self.vault_num_accounts.write(num_accounts);

            self
                .emit(
                    VaultSolvencyVerified {
                        prover: get_caller_address(),
                        assets_commitment,
                        liabilities_commitment,
                        num_accounts,
                        timestamp: now,
                    },
                );
        }

        /// Submit a CDP safety bound proof.
        /// Only the authorized prover can submit. The proof is verified via ProofVerifier
        /// using the CDP_SAFETY_BOUND circuit type.
        fn submit_cdp_safety_proof(
            ref self: ContractState,
            collateral_commitment: felt252,
            debt_commitment: felt252,
            price: u64,
            safety_ratio_percent: u64,
            num_cdps: u32,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            self.assert_authorized_prover();
            assert(collateral_commitment != 0, 'invalid collateral commitment');
            assert(debt_commitment != 0, 'invalid debt commitment');
            assert(price > 0, 'price must be positive');
            assert(safety_ratio_percent > 0, 'ratio must be positive');
            assert(num_cdps > 0, 'num cdps must be positive');

            // Verify the cdp_safety_bound proof
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };

            let verified = verifier
                .verify(ProofTypes::CDP_SAFETY_BOUND, proof_data);
            assert(verified, 'cdp safety proof failed');

            // Record verified state
            let now = get_block_timestamp();
            self.cdp_safe.write(true);
            self.cdp_last_verified.write(now);
            self.cdp_collateral_commitment.write(collateral_commitment);
            self.cdp_debt_commitment.write(debt_commitment);
            self.cdp_num_cdps.write(num_cdps);

            self
                .emit(
                    CDPSafetyVerified {
                        prover: get_caller_address(),
                        collateral_commitment,
                        debt_commitment,
                        price,
                        safety_ratio_percent,
                        num_cdps,
                        timestamp: now,
                    },
                );
        }

        /// Set the authorized prover address. Owner only.
        fn set_prover(ref self: ContractState, prover: ContractAddress) {
            self.assert_owner();
            assert(!prover.is_zero(), 'prover is zero address');
            let old_prover = self.authorized_prover.read();
            self.authorized_prover.write(prover);
            self.emit(ProverUpdated { old_prover, new_prover: prover });
        }

        /// Pause. Owner only.
        fn pause(ref self: ContractState) {
            self.assert_owner();
            self.paused.write(true);
            self.emit(Paused {});
        }

        /// Unpause. Owner only.
        fn unpause(ref self: ContractState) {
            self.assert_owner();
            self.paused.write(false);
            self.emit(Unpaused {});
        }

        // -- View functions --

        fn is_vault_solvent(self: @ContractState) -> bool {
            self.vault_solvent.read()
        }

        fn get_vault_last_verified(self: @ContractState) -> u64 {
            self.vault_last_verified.read()
        }

        fn get_vault_assets_commitment(self: @ContractState) -> felt252 {
            self.vault_assets_commitment.read()
        }

        fn get_vault_liabilities_commitment(self: @ContractState) -> felt252 {
            self.vault_liabilities_commitment.read()
        }

        fn get_vault_num_accounts(self: @ContractState) -> u32 {
            self.vault_num_accounts.read()
        }

        fn is_cdp_safe(self: @ContractState) -> bool {
            self.cdp_safe.read()
        }

        fn get_cdp_last_verified(self: @ContractState) -> u64 {
            self.cdp_last_verified.read()
        }

        fn get_cdp_collateral_commitment(self: @ContractState) -> felt252 {
            self.cdp_collateral_commitment.read()
        }

        fn get_cdp_debt_commitment(self: @ContractState) -> felt252 {
            self.cdp_debt_commitment.read()
        }

        fn get_cdp_num_cdps(self: @ContractState) -> u32 {
            self.cdp_num_cdps.read()
        }

        fn get_prover(self: @ContractState) -> ContractAddress {
            self.authorized_prover.read()
        }

        fn is_solvency_paused(self: @ContractState) -> bool {
            self.paused.read()
        }
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'solvency prover paused');
        }

        fn assert_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'only owner');
        }

        fn assert_authorized_prover(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.authorized_prover.read(), 'unauthorized prover');
        }
    }
}
