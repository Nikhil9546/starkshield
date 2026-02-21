// StarkShield v1.5 -- ShieldedVault unit tests
//
// Tests: deposit, withdraw, shield, unshield, view functions, pause/unpause.

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, DeclareResultTrait, ContractClassTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starkshield::interfaces::{IShieldedVaultDispatcher, IShieldedVaultDispatcherTrait};
use starkshield::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};

// =============================================================================
// Test helpers
// =============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'user1'>()
}

fn USER2() -> ContractAddress {
    contract_address_const::<'user2'>()
}

fn deploy_mock_erc20(recipient: ContractAddress, amount: u256) -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    amount.serialize(ref calldata);
    recipient.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_mock_verifier(should_verify: bool) -> ContractAddress {
    let contract = declare("MockProofVerifier").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    should_verify.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_vault(
    owner: ContractAddress, token: ContractAddress, verifier: ContractAddress,
) -> ContractAddress {
    let contract = declare("ShieldedVault").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    owner.serialize(ref calldata);
    token.serialize(ref calldata);
    verifier.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

/// Standard test setup: deploy token, verifier, vault, fund user, approve vault.
fn setup() -> (ContractAddress, ContractAddress, ContractAddress, IShieldedVaultDispatcher) {
    let initial_supply: u256 = 1000000;
    let token = deploy_mock_erc20(USER1(), initial_supply);
    let verifier = deploy_mock_verifier(true);
    let vault_addr = deploy_vault(OWNER(), token, verifier);
    let vault = IShieldedVaultDispatcher { contract_address: vault_addr };

    // Approve vault to spend user's tokens
    start_cheat_caller_address(token, USER1());
    let token_dispatcher = IMockERC20Dispatcher {
        contract_address: token,
    };
    token_dispatcher.approve(vault_addr, initial_supply);
    stop_cheat_caller_address(token);

    (token, verifier, vault_addr, vault)
}

// =============================================================================
// Deposit tests
// =============================================================================

#[test]
fn test_deposit_success() {
    let (token, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 1000, 'wrong public balance');
    assert(vault.get_total_deposited() == 1000, 'wrong total deposited');
}

#[test]
fn test_deposit_multiple() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(500);
    vault.deposit(300);
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 800, 'wrong balance after 2 deposits');
    assert(vault.get_total_deposited() == 800, 'wrong total');
}

#[test]
#[should_panic(expected: 'amount must be positive')]
fn test_deposit_zero_amount() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(0);
}

#[test]
#[should_panic(expected: 'exceeds max deposit')]
fn test_deposit_exceeds_max() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    // MAX_DEPOSIT = 1000000000000000000000 (1000 * 10^18)
    vault.deposit(1000000000000000000001);
}

// =============================================================================
// Withdraw tests
// =============================================================================

#[test]
fn test_withdraw_success() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.withdraw(400);
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 600, 'wrong balance after withdraw');
    assert(vault.get_total_deposited() == 600, 'wrong total after withdraw');
}

#[test]
fn test_withdraw_full_balance() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.withdraw(1000);
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 0, 'balance should be zero');
}

#[test]
#[should_panic(expected: 'insufficient balance')]
fn test_withdraw_insufficient_balance() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.withdraw(2000);
}

#[test]
#[should_panic(expected: 'amount must be positive')]
fn test_withdraw_zero_amount() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.withdraw(0);
}

// =============================================================================
// Shield tests
// =============================================================================

#[test]
fn test_shield_first_time() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(500, 'commitment_1', 'ct_c1', 'ct_c2', 'nullifier_1', array![].span());
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 500, 'wrong public after shield');
    assert(vault.get_balance_commitment(USER1()) == 'commitment_1', 'wrong commitment');
    let (c1, c2) = vault.get_encrypted_balance(USER1());
    assert(c1 == 'ct_c1', 'wrong ct c1');
    assert(c2 == 'ct_c2', 'wrong ct c2');
    assert(vault.is_nullifier_used('nullifier_1'), 'nullifier not marked');
}

#[test]
fn test_shield_subsequent() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    // First shield
    vault.shield(300, 'commit_1', 'c1a', 'c2a', 'null_1', array![].span());
    // Second shield (existing encrypted balance)
    vault.shield(200, 'commit_2', 'c1b', 'c2b', 'null_2', array![].span());
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 500, 'wrong public after 2 shields');
    assert(vault.get_balance_commitment(USER1()) == 'commit_2', 'wrong commitment');
}

#[test]
fn test_shield_all_public_balance() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(1000, 'commit_full', 'c1', 'c2', 'null_full', array![].span());
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 0, 'public should be zero');
}

#[test]
#[should_panic(expected: 'insufficient public balance')]
fn test_shield_insufficient_public() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(100);
    vault.shield(200, 'commit', 'c1', 'c2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'invalid nullifier')]
fn test_shield_zero_nullifier() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(500, 'commit', 'c1', 'c2', 0, array![].span());
}

#[test]
#[should_panic(expected: 'invalid commitment')]
fn test_shield_zero_commitment() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(500, 0, 'c1', 'c2', 'null', array![].span());
}

// =============================================================================
// Unshield tests
// =============================================================================

#[test]
fn test_unshield_success() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(1000, 'commit_1', 'c1', 'c2', 'null_1', array![].span());

    // Unshield half back
    vault.unshield(500, 'commit_2', 'c1b', 'c2b', 'null_2', array![].span());
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 500, 'wrong public after unshield');
    assert(vault.get_balance_commitment(USER1()) == 'commit_2', 'wrong commitment');
}

#[test]
fn test_unshield_full() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(1000, 'commit_1', 'c1', 'c2', 'null_1', array![].span());
    vault.unshield(1000, 'commit_zero', 'c1z', 'c2z', 'null_2', array![].span());
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_public_balance(USER1()) == 1000, 'should restore full balance');
}

#[test]
#[should_panic(expected: 'no encrypted balance')]
fn test_unshield_no_encrypted_balance() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    // Never shielded, so no encrypted balance
    vault.unshield(500, 'commit', 'c1', 'c2', 'null', array![].span());
}

// =============================================================================
// Pause tests
// =============================================================================

#[test]
fn test_pause_unpause() {
    let (_, _, vault_addr, vault) = setup();

    assert(!vault.is_paused(), 'should start unpaused');

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_addr);

    assert(vault.is_paused(), 'should be paused');

    start_cheat_caller_address(vault_addr, OWNER());
    vault.unpause();
    stop_cheat_caller_address(vault_addr);

    assert(!vault.is_paused(), 'should be unpaused');
}

#[test]
#[should_panic(expected: 'vault is paused')]
fn test_deposit_when_paused() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(100);
}

#[test]
#[should_panic(expected: 'only owner')]
fn test_pause_non_owner() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());
    vault.pause();
}

// =============================================================================
// View function tests
// =============================================================================

#[test]
fn test_initial_state() {
    let (_, _, _, vault) = setup();

    assert(vault.get_public_balance(USER1()) == 0, 'initial public balance');
    assert(vault.get_balance_commitment(USER1()) == 0, 'initial commitment');
    assert(vault.get_total_deposited() == 0, 'initial total');
    assert(!vault.is_nullifier_used('random'), 'initial nullifier');
    assert(!vault.is_paused(), 'initial paused');

    let (c1, c2) = vault.get_encrypted_balance(USER1());
    assert(c1 == 0, 'initial ct c1');
    assert(c2 == 0, 'initial ct c2');
}

// =============================================================================
// Full flow: deposit -> shield -> unshield -> withdraw
// =============================================================================

#[test]
fn test_full_flow() {
    let (_, _, vault_addr, vault) = setup();

    start_cheat_caller_address(vault_addr, USER1());

    // 1. Deposit 1000 public tokens
    vault.deposit(1000);
    assert(vault.get_public_balance(USER1()) == 1000, 'step1: public');

    // 2. Shield 800 into encrypted
    vault.shield(800, 'commit_800', 'c1', 'c2', 'n1', array![].span());
    assert(vault.get_public_balance(USER1()) == 200, 'step2: public');
    assert(vault.get_balance_commitment(USER1()) == 'commit_800', 'step2: commit');

    // 3. Unshield 300 back to public
    vault.unshield(300, 'commit_500', 'c1b', 'c2b', 'n2', array![].span());
    assert(vault.get_public_balance(USER1()) == 500, 'step3: public');
    assert(vault.get_balance_commitment(USER1()) == 'commit_500', 'step3: commit');

    // 4. Withdraw 500 public tokens
    vault.withdraw(500);
    assert(vault.get_public_balance(USER1()) == 0, 'step4: public');

    stop_cheat_caller_address(vault_addr);
}
