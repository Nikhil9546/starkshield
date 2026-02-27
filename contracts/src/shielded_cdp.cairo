// StarkShield v1.5 -- shielded_cdp
//
// Private Collateralized Debt Positions (CDPs) backed by xyBTC collateral.
// Users lock xyBTC, mint sUSD stablecoin, repay, and close positions.
// All collateral and debt amounts use Pedersen commitments with ZK proof verification.
//
// Liquidation: Mode A (Disclosure-on-Liquidation)
//   - Anyone can challenge a CDP by calling trigger_liquidation
//   - The CDP owner has LIQUIDATION_WINDOW seconds to prove health (collateral_ratio proof)
//   - If the window expires without proof, anyone can execute conservative seizure
//
// Security invariants enforced:
//   3. CDP collateral ratio ALWAYS >= MIN_CR (200%) -- collateral_ratio proof
//   4. Position can only close with zero_debt proof
//   6. Oracle staleness -> mint pauses automatically
//   7. Proof domain separation (unique circuit type IDs)
//   8. No replay attacks (nullifier-based)

#[starknet::contract]
pub mod ShieldedCDP {
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{get_caller_address, get_contract_address, get_block_timestamp};
    use core::num::traits::Zero;
    use crate::types::ProofTypes;
    use crate::constants::{
        ZERO_COMMITMENT, ORACLE_STALENESS_THRESHOLD, LIQUIDATION_WINDOW,
    };
    use crate::interfaces::{
        IShieldedCDP, IProofVerifierDispatcher, IProofVerifierDispatcherTrait,
        IPriceFeedDispatcher, IPriceFeedDispatcherTrait,
    };
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    // =========================================================================
    // Storage
    // =========================================================================

    #[storage]
    struct Storage {
        owner: ContractAddress,
        collateral_token: ContractAddress,
        proof_verifier: ContractAddress,
        price_feed: ContractAddress,
        paused: bool,
        // CDP existence per user (one CDP per user for v1.5)
        cdp_exists: Map<ContractAddress, bool>,
        // Public collateral tracking (for token transfers)
        locked_collateral: Map<ContractAddress, u256>,
        // Pedersen commitment to the user's collateral
        collateral_commitments: Map<ContractAddress, felt252>,
        // ElGamal ciphertext for collateral (client-side decryption)
        collateral_ct_c1: Map<ContractAddress, felt252>,
        collateral_ct_c2: Map<ContractAddress, felt252>,
        // Pedersen commitment to the user's debt
        debt_commitments: Map<ContractAddress, felt252>,
        // ElGamal ciphertext for debt (client-side decryption)
        debt_ct_c1: Map<ContractAddress, felt252>,
        debt_ct_c2: Map<ContractAddress, felt252>,
        // Aggregate tracking
        total_collateral_locked: u256,
        // Liquidation state
        liquidation_triggered: Map<ContractAddress, bool>,
        liquidation_deadline: Map<ContractAddress, u64>,
        // Nullifiers prevent proof replay
        used_nullifiers: Map<felt252, bool>,
    }

    // =========================================================================
    // Events
    // =========================================================================

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CDPOpened: CDPOpened,
        CollateralLocked: CollateralLocked,
        CollateralUnlocked: CollateralUnlocked,
        SUSDMinted: SUSDMinted,
        DebtRepaid: DebtRepaid,
        CDPClosed: CDPClosed,
        LiquidationTriggered: LiquidationTriggered,
        LiquidationCancelled: LiquidationCancelled,
        LiquidationExecuted: LiquidationExecuted,
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    struct CDPOpened {
        #[key]
        user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CollateralLocked {
        #[key]
        user: ContractAddress,
        new_commitment: felt252,
        nullifier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct CollateralUnlocked {
        #[key]
        user: ContractAddress,
        new_commitment: felt252,
        nullifier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct SUSDMinted {
        #[key]
        user: ContractAddress,
        new_debt_commitment: felt252,
        nullifier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct DebtRepaid {
        #[key]
        user: ContractAddress,
        new_debt_commitment: felt252,
        nullifier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct CDPClosed {
        #[key]
        user: ContractAddress,
        nullifier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidationTriggered {
        #[key]
        user: ContractAddress,
        deadline: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidationCancelled {
        #[key]
        user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidationExecuted {
        #[key]
        user: ContractAddress,
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
        collateral_token: ContractAddress,
        proof_verifier: ContractAddress,
        price_feed: ContractAddress,
    ) {
        assert(!owner.is_zero(), 'owner is zero address');
        assert(!collateral_token.is_zero(), 'token is zero address');
        assert(!proof_verifier.is_zero(), 'verifier is zero address');
        assert(!price_feed.is_zero(), 'price feed is zero');
        self.owner.write(owner);
        self.collateral_token.write(collateral_token);
        self.proof_verifier.write(proof_verifier);
        self.price_feed.write(price_feed);
        self.paused.write(false);
    }

    // =========================================================================
    // External functions
    // =========================================================================

    #[abi(embed_v0)]
    impl ShieldedCDPImpl of IShieldedCDP<ContractState> {
        /// Open a new CDP. One CDP per user for v1.5.
        fn open_cdp(ref self: ContractState) {
            self.assert_not_paused();
            let caller = get_caller_address();
            assert(!self.cdp_exists.entry(caller).read(), 'cdp already exists');

            self.cdp_exists.entry(caller).write(true);
            self.emit(CDPOpened { user: caller });
        }

        /// Lock collateral (xyBTC) into the CDP.
        /// User must have approved this contract to spend `amount` of collateral token.
        /// First lock: range_proof. Subsequent: debt_update_validity proof.
        fn lock_collateral(
            ref self: ContractState,
            amount: u256,
            new_collateral_commitment: felt252,
            new_col_ct_c1: felt252,
            new_col_ct_c2: felt252,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            self.assert_not_in_liquidation();
            assert(amount > 0, 'amount must be positive');
            assert(new_collateral_commitment != 0, 'invalid commitment');
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            assert(self.cdp_exists.entry(caller).read(), 'no cdp exists');

            // Verify proof
            let old_commitment = self.collateral_commitments.entry(caller).read();
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };

            if old_commitment == ZERO_COMMITMENT {
                let verified = verifier
                    .verify(
                        ProofTypes::RANGE_PROOF,
                        array![new_collateral_commitment].span(),
                        proof_data,
                    );
                assert(verified, 'range proof failed');
            } else {
                let verified = verifier
                    .verify(
                        ProofTypes::DEBT_UPDATE_VALIDITY,
                        array![old_commitment, new_collateral_commitment].span(),
                        proof_data,
                    );
                assert(verified, 'update proof failed');
            }

            // Transfer collateral token from user to CDP
            let token = IERC20Dispatcher {
                contract_address: self.collateral_token.read(),
            };
            let success = token.transfer_from(caller, get_contract_address(), amount);
            assert(success, 'transfer failed');

            // State mutation (after proof verification)
            let current = self.locked_collateral.entry(caller).read();
            self.locked_collateral.entry(caller).write(current + amount);
            self.collateral_commitments.entry(caller).write(new_collateral_commitment);
            self.collateral_ct_c1.entry(caller).write(new_col_ct_c1);
            self.collateral_ct_c2.entry(caller).write(new_col_ct_c2);
            self.used_nullifiers.entry(nullifier).write(true);
            self
                .total_collateral_locked
                .write(self.total_collateral_locked.read() + amount);

            self
                .emit(
                    CollateralLocked {
                        user: caller,
                        new_commitment: new_collateral_commitment,
                        nullifier,
                    },
                );
        }

        /// Unlock collateral from the CDP.
        /// Requires collateral_ratio proof to ensure the position remains safe after withdrawal.
        /// If there is no debt, no ratio proof is needed (balance_sufficiency on collateral).
        fn unlock_collateral(
            ref self: ContractState,
            amount: u256,
            new_collateral_commitment: felt252,
            new_col_ct_c1: felt252,
            new_col_ct_c2: felt252,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            self.assert_not_in_liquidation();
            assert(amount > 0, 'amount must be positive');
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            assert(self.cdp_exists.entry(caller).read(), 'no cdp exists');

            let current_collateral = self.locked_collateral.entry(caller).read();
            assert(current_collateral >= amount, 'insufficient collateral');

            let old_commitment = self.collateral_commitments.entry(caller).read();
            assert(old_commitment != ZERO_COMMITMENT, 'no collateral locked');

            // Verify proof: if user has debt, need collateral_ratio proof; else balance_sufficiency
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };
            let debt_commitment = self.debt_commitments.entry(caller).read();

            if debt_commitment != ZERO_COMMITMENT {
                // Has debt: must prove the remaining collateral still covers the debt
                let verified = verifier
                    .verify(
                        ProofTypes::COLLATERAL_RATIO,
                        array![new_collateral_commitment, debt_commitment].span(),
                        proof_data,
                    );
                assert(verified, 'collateral ratio proof failed');
            } else {
                // No debt: just prove collateral update is valid
                let verified = verifier
                    .verify(
                        ProofTypes::BALANCE_SUFFICIENCY,
                        array![old_commitment, new_collateral_commitment].span(),
                        proof_data,
                    );
                assert(verified, 'balance proof failed');
            }

            // State mutation
            self.locked_collateral.entry(caller).write(current_collateral - amount);
            self.collateral_commitments.entry(caller).write(new_collateral_commitment);
            self.collateral_ct_c1.entry(caller).write(new_col_ct_c1);
            self.collateral_ct_c2.entry(caller).write(new_col_ct_c2);
            self.used_nullifiers.entry(nullifier).write(true);
            self
                .total_collateral_locked
                .write(self.total_collateral_locked.read() - amount);

            // Transfer collateral back to user
            let token = IERC20Dispatcher {
                contract_address: self.collateral_token.read(),
            };
            let success = token.transfer(caller, amount);
            assert(success, 'transfer failed');

            self
                .emit(
                    CollateralUnlocked {
                        user: caller,
                        new_commitment: new_collateral_commitment,
                        nullifier,
                    },
                );
        }

        /// Mint sUSD against locked collateral.
        /// Requires collateral_ratio proof showing ratio >= MIN_CR after new debt.
        /// Oracle price must not be stale.
        fn mint_susd(
            ref self: ContractState,
            new_debt_commitment: felt252,
            new_debt_ct_c1: felt252,
            new_debt_ct_c2: felt252,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            self.assert_not_in_liquidation();
            assert(new_debt_commitment != 0, 'invalid commitment');
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            assert(self.cdp_exists.entry(caller).read(), 'no cdp exists');

            let collateral_commitment = self.collateral_commitments.entry(caller).read();
            assert(collateral_commitment != ZERO_COMMITMENT, 'no collateral locked');

            // Check oracle staleness
            self.assert_oracle_fresh();

            // Verify collateral_ratio proof: collateral * price >= new_debt * MIN_CR
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };
            let verified = verifier
                .verify(
                    ProofTypes::COLLATERAL_RATIO,
                    array![collateral_commitment, new_debt_commitment].span(),
                    proof_data,
                );
            assert(verified, 'collateral ratio proof failed');

            // State mutation (after proof verification)
            self.debt_commitments.entry(caller).write(new_debt_commitment);
            self.debt_ct_c1.entry(caller).write(new_debt_ct_c1);
            self.debt_ct_c2.entry(caller).write(new_debt_ct_c2);
            self.used_nullifiers.entry(nullifier).write(true);

            self
                .emit(
                    SUSDMinted {
                        user: caller,
                        new_debt_commitment,
                        nullifier,
                    },
                );
        }

        /// Repay sUSD debt.
        /// Requires debt_update_validity proof (repayment path).
        fn repay(
            ref self: ContractState,
            new_debt_commitment: felt252,
            new_debt_ct_c1: felt252,
            new_debt_ct_c2: felt252,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            assert(self.cdp_exists.entry(caller).read(), 'no cdp exists');

            let old_debt_commitment = self.debt_commitments.entry(caller).read();
            assert(old_debt_commitment != ZERO_COMMITMENT, 'no debt to repay');

            // Verify debt_update_validity proof (repayment: new_debt = old_debt - delta)
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };
            let verified = verifier
                .verify(
                    ProofTypes::DEBT_UPDATE_VALIDITY,
                    array![old_debt_commitment, new_debt_commitment].span(),
                    proof_data,
                );
            assert(verified, 'debt update proof failed');

            // State mutation (after proof verification)
            self.debt_commitments.entry(caller).write(new_debt_commitment);
            self.debt_ct_c1.entry(caller).write(new_debt_ct_c1);
            self.debt_ct_c2.entry(caller).write(new_debt_ct_c2);
            self.used_nullifiers.entry(nullifier).write(true);

            self
                .emit(
                    DebtRepaid {
                        user: caller,
                        new_debt_commitment,
                        nullifier,
                    },
                );
        }

        /// Close CDP position. Requires zero_debt proof showing debt == 0.
        /// Returns all locked collateral to the user.
        fn close_cdp(
            ref self: ContractState,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            self.assert_not_in_liquidation();
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            assert(self.cdp_exists.entry(caller).read(), 'no cdp exists');

            let debt_commitment = self.debt_commitments.entry(caller).read();

            // If there was ever debt, require zero_debt proof
            if debt_commitment != ZERO_COMMITMENT {
                let verifier = IProofVerifierDispatcher {
                    contract_address: self.proof_verifier.read(),
                };
                let verified = verifier
                    .verify(
                        ProofTypes::ZERO_DEBT,
                        array![debt_commitment].span(),
                        proof_data,
                    );
                assert(verified, 'zero debt proof failed');
            }

            // Return all locked collateral
            let collateral_amount = self.locked_collateral.entry(caller).read();
            if collateral_amount > 0 {
                let token = IERC20Dispatcher {
                    contract_address: self.collateral_token.read(),
                };
                let success = token.transfer(caller, collateral_amount);
                assert(success, 'transfer failed');
            }

            // Clear CDP state
            self.cdp_exists.entry(caller).write(false);
            self.locked_collateral.entry(caller).write(0);
            self.collateral_commitments.entry(caller).write(ZERO_COMMITMENT);
            self.collateral_ct_c1.entry(caller).write(0);
            self.collateral_ct_c2.entry(caller).write(0);
            self.debt_commitments.entry(caller).write(ZERO_COMMITMENT);
            self.debt_ct_c1.entry(caller).write(0);
            self.debt_ct_c2.entry(caller).write(0);
            self.used_nullifiers.entry(nullifier).write(true);

            if collateral_amount > 0 {
                self
                    .total_collateral_locked
                    .write(self.total_collateral_locked.read() - collateral_amount);
            }

            self.emit(CDPClosed { user: caller, nullifier });
        }

        /// Trigger liquidation challenge on a user's CDP.
        /// Anyone can call this if they believe the CDP is undercollateralized.
        /// Starts a disclosure window where the CDP owner must prove health.
        fn trigger_liquidation(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            assert(self.cdp_exists.entry(user).read(), 'no cdp exists');
            assert(!self.liquidation_triggered.entry(user).read(), 'already in liquidation');

            // CDP must have debt to be liquidatable
            let debt_commitment = self.debt_commitments.entry(user).read();
            assert(debt_commitment != ZERO_COMMITMENT, 'no debt to liquidate');

            let deadline = get_block_timestamp() + LIQUIDATION_WINDOW;
            self.liquidation_triggered.entry(user).write(true);
            self.liquidation_deadline.entry(user).write(deadline);

            self.emit(LiquidationTriggered { user, deadline });
        }

        /// User proves their CDP is healthy during a liquidation window.
        /// Requires collateral_ratio proof showing ratio >= MIN_CR.
        fn prove_health(
            ref self: ContractState,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            assert(self.liquidation_triggered.entry(caller).read(), 'not in liquidation');

            let collateral_commitment = self.collateral_commitments.entry(caller).read();
            let debt_commitment = self.debt_commitments.entry(caller).read();

            // Verify collateral_ratio proof
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };
            let verified = verifier
                .verify(
                    ProofTypes::COLLATERAL_RATIO,
                    array![collateral_commitment, debt_commitment].span(),
                    proof_data,
                );
            assert(verified, 'collateral ratio proof failed');

            // Cancel liquidation
            self.liquidation_triggered.entry(caller).write(false);
            self.liquidation_deadline.entry(caller).write(0);
            self.used_nullifiers.entry(nullifier).write(true);

            self.emit(LiquidationCancelled { user: caller });
        }

        /// Execute liquidation after the disclosure window expires.
        /// Conservative seizure: all collateral is seized. Anyone can call.
        fn execute_liquidation(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            assert(self.liquidation_triggered.entry(user).read(), 'not in liquidation');

            let deadline = self.liquidation_deadline.entry(user).read();
            let now = get_block_timestamp();
            assert(now >= deadline, 'liquidation window active');

            // Conservative seizure: seize all collateral
            let collateral_amount = self.locked_collateral.entry(user).read();

            // Transfer seized collateral to the caller (liquidator)
            if collateral_amount > 0 {
                let caller = get_caller_address();
                let token = IERC20Dispatcher {
                    contract_address: self.collateral_token.read(),
                };
                let success = token.transfer(caller, collateral_amount);
                assert(success, 'transfer failed');
                self
                    .total_collateral_locked
                    .write(self.total_collateral_locked.read() - collateral_amount);
            }

            // Clear CDP state (debt is effectively written off)
            self.cdp_exists.entry(user).write(false);
            self.locked_collateral.entry(user).write(0);
            self.collateral_commitments.entry(user).write(ZERO_COMMITMENT);
            self.collateral_ct_c1.entry(user).write(0);
            self.collateral_ct_c2.entry(user).write(0);
            self.debt_commitments.entry(user).write(ZERO_COMMITMENT);
            self.debt_ct_c1.entry(user).write(0);
            self.debt_ct_c2.entry(user).write(0);
            self.liquidation_triggered.entry(user).write(false);
            self.liquidation_deadline.entry(user).write(0);

            self.emit(LiquidationExecuted { user });
        }

        /// Pause the CDP system. Only callable by owner.
        fn pause(ref self: ContractState) {
            self.assert_owner();
            self.paused.write(true);
            self.emit(Paused {});
        }

        /// Unpause the CDP system. Only callable by owner.
        fn unpause(ref self: ContractState) {
            self.assert_owner();
            self.paused.write(false);
            self.emit(Unpaused {});
        }

        // -- View functions --

        fn has_cdp(self: @ContractState, account: ContractAddress) -> bool {
            self.cdp_exists.entry(account).read()
        }

        fn get_collateral_commitment(
            self: @ContractState, account: ContractAddress,
        ) -> felt252 {
            self.collateral_commitments.entry(account).read()
        }

        fn get_encrypted_collateral(
            self: @ContractState, account: ContractAddress,
        ) -> (felt252, felt252) {
            (
                self.collateral_ct_c1.entry(account).read(),
                self.collateral_ct_c2.entry(account).read(),
            )
        }

        fn get_debt_commitment(self: @ContractState, account: ContractAddress) -> felt252 {
            self.debt_commitments.entry(account).read()
        }

        fn get_encrypted_debt(
            self: @ContractState, account: ContractAddress,
        ) -> (felt252, felt252) {
            (
                self.debt_ct_c1.entry(account).read(),
                self.debt_ct_c2.entry(account).read(),
            )
        }

        fn get_locked_collateral(self: @ContractState, account: ContractAddress) -> u256 {
            self.locked_collateral.entry(account).read()
        }

        fn is_in_liquidation(self: @ContractState, account: ContractAddress) -> bool {
            self.liquidation_triggered.entry(account).read()
        }

        fn get_liquidation_deadline(self: @ContractState, account: ContractAddress) -> u64 {
            self.liquidation_deadline.entry(account).read()
        }

        fn is_cdp_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.used_nullifiers.entry(nullifier).read()
        }
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'cdp is paused');
        }

        fn assert_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'only owner');
        }

        fn assert_not_in_liquidation(self: @ContractState) {
            let caller = get_caller_address();
            assert(!self.liquidation_triggered.entry(caller).read(), 'position in liquidation');
        }

        fn assert_oracle_fresh(self: @ContractState) {
            let price_feed = IPriceFeedDispatcher {
                contract_address: self.price_feed.read(),
            };
            let (_, timestamp) = price_feed.get_price();
            let now = get_block_timestamp();
            assert(now - timestamp <= ORACLE_STALENESS_THRESHOLD, 'oracle price stale');
        }
    }
}
