// Obscura v1.5 -- proof_verifiers
//
// Routes ZK proof verification to the appropriate Garaga-generated verifier
// via library_call (class hash dispatch). Each circuit type has its own
// declared class hash registered by the owner.
//
// Garaga verifiers are stateless -- we use library_call_syscall to invoke
// verify_ultra_keccak_zk_honk_proof on the declared class.
//
// IMPORTANT: library_call_syscall calldata must be the Serde-serialized form
// of the target function's arguments. For Span<felt252>, that means
// [length, elem0, elem1, ...] -- we must prepend the length.

#[starknet::contract]
pub mod ProofVerifier {
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::syscalls::library_call_syscall;
    use starknet::class_hash::ClassHash;
    use crate::interfaces::IProofVerifier;

    // Selector for verify_ultra_keccak_zk_honk_proof(Span<felt252>)
    // = sn_keccak("verify_ultra_keccak_zk_honk_proof")
    const VERIFY_SELECTOR: felt252 =
        0x48641e98173c0acd0df447a2d3ae3db134577142690a40acd9b1181cbf82e2;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        verifier_class_hashes: Map<u8, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        VerifierClassHashUpdated: VerifierClassHashUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct VerifierClassHashUpdated {
        #[key]
        circuit_type: u8,
        class_hash: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl ProofVerifierImpl of IProofVerifier<ContractState> {
        fn verify(
            self: @ContractState,
            circuit_type: u8,
            full_proof_with_hints: Span<felt252>,
        ) -> bool {
            let ch_felt = self.verifier_class_hashes.entry(circuit_type).read();
            if ch_felt == 0 {
                return false;
            }

            let ch: ClassHash = ch_felt.try_into().unwrap();

            // library_call_syscall calldata must be Serde-serialized.
            // Span<felt252> serializes as [length, elem0, elem1, ...].
            // We must build this serialized form manually.
            let mut serialized: Array<felt252> = array![];
            full_proof_with_hints.serialize(ref serialized);

            let result = library_call_syscall(
                ch,
                VERIFY_SELECTOR,
                serialized.span(),
            );

            match result {
                Result::Ok(ret) => {
                    // Garaga returns Result<Span<u256>, felt252> serialized.
                    // Result::Ok is tagged with 0 as the first felt, Result::Err with 1.
                    if ret.len() > 0 && *ret.at(0) == 0 {
                        true
                    } else {
                        false
                    }
                },
                Result::Err(_) => false,
            }
        }

        fn set_verifier_class_hash(
            ref self: ContractState,
            circuit_type: u8,
            class_hash: felt252,
        ) {
            let caller = starknet::get_caller_address();
            assert(caller == self.owner.read(), 'only owner');
            self.verifier_class_hashes.entry(circuit_type).write(class_hash);
            self.emit(VerifierClassHashUpdated { circuit_type, class_hash });
        }
    }
}
