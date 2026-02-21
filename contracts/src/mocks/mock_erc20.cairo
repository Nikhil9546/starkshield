// Minimal ERC20 mock for testing ShieldedVault token interactions.
// Implements the subset of IERC20 that the vault uses: transfer_from, transfer, approve.

#[starknet::interface]
pub trait IMockERC20<TContractState> {
    fn balance_of(self: @TContractState, account: starknet::ContractAddress) -> u256;
    fn transfer(
        ref self: TContractState, recipient: starknet::ContractAddress, amount: u256,
    ) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: starknet::ContractAddress,
        recipient: starknet::ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: starknet::ContractAddress, amount: u256) -> bool;
    fn mint(ref self: TContractState, to: starknet::ContractAddress, amount: u256);
}

#[starknet::contract]
pub mod MockERC20 {
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::get_caller_address;

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<ContractAddress, Map<ContractAddress, u256>>,
        total_supply: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, initial_supply: u256, recipient: ContractAddress) {
        self.balances.entry(recipient).write(initial_supply);
        self.total_supply.write(initial_supply);
    }

    #[abi(embed_v0)]
    impl MockERC20Impl of super::IMockERC20<ContractState> {
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            let sender_balance = self.balances.entry(caller).read();
            assert(sender_balance >= amount, 'insufficient balance');
            self.balances.entry(caller).write(sender_balance - amount);
            let recipient_balance = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recipient_balance + amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.entry(sender).entry(caller).read();
            assert(current_allowance >= amount, 'insufficient allowance');
            let sender_balance = self.balances.entry(sender).read();
            assert(sender_balance >= amount, 'insufficient balance');
            self.allowances.entry(sender).entry(caller).write(current_allowance - amount);
            self.balances.entry(sender).write(sender_balance - amount);
            let recipient_balance = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recipient_balance + amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.entry(caller).entry(spender).write(amount);
            true
        }

        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            let balance = self.balances.entry(to).read();
            self.balances.entry(to).write(balance + amount);
            self.total_supply.write(self.total_supply.read() + amount);
        }
    }
}
