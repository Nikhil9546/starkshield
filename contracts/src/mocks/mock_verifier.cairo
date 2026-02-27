// Mock proof verifier for testing.
// Can be configured to accept or reject all proofs.

#[starknet::interface]
pub trait IMockProofVerifier<TContractState> {
    fn set_should_verify(ref self: TContractState, should_verify: bool);
}

#[starknet::contract]
pub mod MockProofVerifier {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::interfaces::IProofVerifier;

    #[storage]
    struct Storage {
        should_verify: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState, should_verify: bool) {
        self.should_verify.write(should_verify);
    }

    #[abi(embed_v0)]
    impl MockVerifierImpl of IProofVerifier<ContractState> {
        fn verify(
            self: @ContractState,
            circuit_type: u8,
            full_proof_with_hints: Span<felt252>,
        ) -> bool {
            self.should_verify.read()
        }

        fn set_verifier_class_hash(
            ref self: ContractState,
            circuit_type: u8,
            class_hash: felt252,
        ) {
            // No-op in mock
        }
    }

    #[abi(embed_v0)]
    impl MockProofVerifierConfigImpl of super::IMockProofVerifier<ContractState> {
        fn set_should_verify(ref self: ContractState, should_verify: bool) {
            self.should_verify.write(should_verify);
        }
    }
}
