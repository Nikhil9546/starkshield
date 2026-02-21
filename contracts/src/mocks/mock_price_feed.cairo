// Mock price feed oracle for testing.
// Returns a configurable price and timestamp.

#[starknet::interface]
pub trait IMockPriceFeed<TContractState> {
    fn set_price(ref self: TContractState, price: u256, timestamp: u64);
}

#[starknet::contract]
pub mod MockPriceFeed {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::interfaces::IPriceFeed;

    #[storage]
    struct Storage {
        price: u256,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, price: u256, timestamp: u64) {
        self.price.write(price);
        self.timestamp.write(timestamp);
    }

    #[abi(embed_v0)]
    impl PriceFeedImpl of IPriceFeed<ContractState> {
        fn get_price(self: @ContractState) -> (u256, u64) {
            (self.price.read(), self.timestamp.read())
        }
    }

    #[abi(embed_v0)]
    impl MockPriceFeedImpl of super::IMockPriceFeed<ContractState> {
        fn set_price(ref self: ContractState, price: u256, timestamp: u64) {
            self.price.write(price);
            self.timestamp.write(timestamp);
        }
    }
}
