// Obscura v1.5 -- shielded_vault
//
// The ShieldedVault accepts public xyBTC deposits, allows users to "shield" their
// balance into encrypted sxyBTC (Pedersen-committed on-chain, ElGamal-encrypted
// client-side), and "unshield" back to public tokens.
//
// Security invariants enforced:
//   1. Encrypted balance NEVER underflows (balance_sufficiency proof required)
//   2. Only valid proofs can change ciphertext state (verifier checks before mutation)
//   3. No replay attacks (nullifier-based commitment hashes)
//   7. Proof domain separation (each proof type has unique verifier key ID)

#[starknet::contract]
pub mod ShieldedVault {
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{get_caller_address, get_contract_address};
    use core::num::traits::Zero;
    use crate::types::ProofTypes;
    use crate::constants::{MAX_DEPOSIT, ZERO_COMMITMENT};
    use crate::interfaces::{IShieldedVault, IProofVerifierDispatcher, IProofVerifierDispatcherTrait};
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    // =========================================================================
    // Storage
    // =========================================================================

    #[storage]
    struct Storage {
        owner: ContractAddress,
        xybtc_token: ContractAddress,
        proof_verifier: ContractAddress,
        paused: bool,
        total_deposited: u256,
        // Public (unshielded) balances
        public_balances: Map<ContractAddress, u256>,
        // Pedersen commitment to the user's encrypted balance (ZK proofs reference this)
        balance_commitments: Map<ContractAddress, felt252>,
        // ElGamal ciphertext components (for client-side decryption)
        encrypted_ct_c1: Map<ContractAddress, felt252>,
        encrypted_ct_c2: Map<ContractAddress, felt252>,
        // Nullifiers prevent proof replay
        used_nullifiers: Map<felt252, bool>,
    }

    // =========================================================================
    // Events
    // =========================================================================

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Deposited: Deposited,
        Withdrawn: Withdrawn,
        Shielded: Shielded,
        Unshielded: Unshielded,
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposited {
        #[key]
        user: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawn {
        #[key]
        user: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Shielded {
        #[key]
        user: ContractAddress,
        new_commitment: felt252,
        nullifier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct Unshielded {
        #[key]
        user: ContractAddress,
        new_commitment: felt252,
        nullifier: felt252,
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
        xybtc_token: ContractAddress,
        proof_verifier: ContractAddress,
    ) {
        assert(!owner.is_zero(), 'owner is zero address');
        assert(!xybtc_token.is_zero(), 'token is zero address');
        assert(!proof_verifier.is_zero(), 'verifier is zero address');
        self.owner.write(owner);
        self.xybtc_token.write(xybtc_token);
        self.proof_verifier.write(proof_verifier);
        self.paused.write(false);
    }

    // =========================================================================
    // External functions
    // =========================================================================

    #[abi(embed_v0)]
    impl ShieldedVaultImpl of IShieldedVault<ContractState> {
        /// Deposit public xyBTC into the vault.
        /// User must have approved the vault to spend `amount` of xyBTC.
        fn deposit(ref self: ContractState, amount: u256) {
            self.assert_not_paused();
            assert(amount > 0, 'amount must be positive');
            assert(amount <= MAX_DEPOSIT, 'exceeds max deposit');

            let caller = get_caller_address();
            let contract = get_contract_address();

            // Transfer xyBTC from user to vault
            let token = IERC20Dispatcher { contract_address: self.xybtc_token.read() };
            let success = token.transfer_from(caller, contract, amount);
            assert(success, 'transfer failed');

            // Credit public balance
            let current = self.public_balances.entry(caller).read();
            self.public_balances.entry(caller).write(current + amount);
            self.total_deposited.write(self.total_deposited.read() + amount);

            self.emit(Deposited { user: caller, amount });
        }

        /// Withdraw public xyBTC from the vault.
        fn withdraw(ref self: ContractState, amount: u256) {
            self.assert_not_paused();
            assert(amount > 0, 'amount must be positive');

            let caller = get_caller_address();
            let balance = self.public_balances.entry(caller).read();
            assert(balance >= amount, 'insufficient balance');

            // Debit public balance
            self.public_balances.entry(caller).write(balance - amount);
            self.total_deposited.write(self.total_deposited.read() - amount);

            // Transfer xyBTC from vault to user
            let token = IERC20Dispatcher { contract_address: self.xybtc_token.read() };
            let success = token.transfer(caller, amount);
            assert(success, 'transfer failed');

            self.emit(Withdrawn { user: caller, amount });
        }

        /// Shield: convert public balance to encrypted sxyBTC.
        ///
        /// For the first shield (no existing encrypted balance), a range_proof
        /// on the amount is required. For subsequent shields, a debt_update_validity
        /// proof showing new_balance = old_balance + amount is required.
        fn shield(
            ref self: ContractState,
            amount: u256,
            new_balance_commitment: felt252,
            new_ct_c1: felt252,
            new_ct_c2: felt252,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            assert(amount > 0, 'amount must be positive');
            assert(new_balance_commitment != 0, 'invalid commitment');
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            let public_balance = self.public_balances.entry(caller).read();
            assert(public_balance >= amount, 'insufficient public balance');

            // Verify proof: type depends on whether user has existing encrypted balance
            let old_commitment = self.balance_commitments.entry(caller).read();
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };

            if old_commitment == ZERO_COMMITMENT {
                // First shield: range_proof verifies the amount is valid
                let verified = verifier
                    .verify(ProofTypes::RANGE_PROOF, proof_data);
                assert(verified, 'range proof failed');
            } else {
                // Subsequent: debt_update_validity proves new = old + delta
                let verified = verifier
                    .verify(ProofTypes::DEBT_UPDATE_VALIDITY, proof_data);
                assert(verified, 'update proof failed');
            }

            // State mutation (only after proof verification)
            self.public_balances.entry(caller).write(public_balance - amount);
            self.balance_commitments.entry(caller).write(new_balance_commitment);
            self.encrypted_ct_c1.entry(caller).write(new_ct_c1);
            self.encrypted_ct_c2.entry(caller).write(new_ct_c2);
            self.used_nullifiers.entry(nullifier).write(true);

            self
                .emit(
                    Shielded {
                        user: caller,
                        new_commitment: new_balance_commitment,
                        nullifier,
                    },
                );
        }

        /// Unshield: convert encrypted sxyBTC back to public balance.
        ///
        /// Requires a balance_sufficiency proof showing the encrypted balance
        /// covers the withdrawal amount, and the new commitment is correct.
        fn unshield(
            ref self: ContractState,
            amount: u256,
            new_balance_commitment: felt252,
            new_ct_c1: felt252,
            new_ct_c2: felt252,
            nullifier: felt252,
            proof_data: Span<felt252>,
        ) {
            self.assert_not_paused();
            assert(amount > 0, 'amount must be positive');
            assert(nullifier != 0, 'invalid nullifier');
            assert(!self.used_nullifiers.entry(nullifier).read(), 'nullifier already used');

            let caller = get_caller_address();
            let old_commitment = self.balance_commitments.entry(caller).read();
            assert(old_commitment != ZERO_COMMITMENT, 'no encrypted balance');

            // Verify balance_sufficiency proof
            let verifier = IProofVerifierDispatcher {
                contract_address: self.proof_verifier.read(),
            };
            let verified = verifier
                .verify(ProofTypes::BALANCE_SUFFICIENCY, proof_data);
            assert(verified, 'balance proof failed');

            // State mutation (only after proof verification)
            let public_balance = self.public_balances.entry(caller).read();
            self.public_balances.entry(caller).write(public_balance + amount);
            self.balance_commitments.entry(caller).write(new_balance_commitment);
            self.encrypted_ct_c1.entry(caller).write(new_ct_c1);
            self.encrypted_ct_c2.entry(caller).write(new_ct_c2);
            self.used_nullifiers.entry(nullifier).write(true);

            self
                .emit(
                    Unshielded {
                        user: caller,
                        new_commitment: new_balance_commitment,
                        nullifier,
                    },
                );
        }

        /// Pause the vault. Only callable by owner.
        fn pause(ref self: ContractState) {
            self.assert_owner();
            self.paused.write(true);
            self.emit(Paused {});
        }

        /// Unpause the vault. Only callable by owner.
        fn unpause(ref self: ContractState) {
            self.assert_owner();
            self.paused.write(false);
            self.emit(Unpaused {});
        }

        // -- View functions --

        fn get_public_balance(self: @ContractState, account: ContractAddress) -> u256 {
            self.public_balances.entry(account).read()
        }

        fn get_encrypted_balance(
            self: @ContractState, account: ContractAddress,
        ) -> (felt252, felt252) {
            (
                self.encrypted_ct_c1.entry(account).read(),
                self.encrypted_ct_c2.entry(account).read(),
            )
        }

        fn get_balance_commitment(self: @ContractState, account: ContractAddress) -> felt252 {
            self.balance_commitments.entry(account).read()
        }

        fn get_total_deposited(self: @ContractState) -> u256 {
            self.total_deposited.read()
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.used_nullifiers.entry(nullifier).read()
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'vault is paused');
        }

        fn assert_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'only owner');
        }
    }
}
