// Obscura v1.5 -- Adversarial tests
//
// Tests: replay attacks, invalid proofs, malformed data, paused state attacks.

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, DeclareResultTrait, ContractClassTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use obscura::interfaces::{IShieldedVaultDispatcher, IShieldedVaultDispatcherTrait};
use obscura::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use obscura::mocks::mock_verifier::{IMockProofVerifierDispatcher, IMockProofVerifierDispatcherTrait};

// =============================================================================
// Test helpers (duplicated from test_vault for independence)
// =============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'user1'>()
}

fn ATTACKER() -> ContractAddress {
    contract_address_const::<'attacker'>()
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

fn setup_with_verifier(
    should_verify: bool,
) -> (ContractAddress, ContractAddress, ContractAddress, IShieldedVaultDispatcher) {
    let initial_supply: u256 = 1000000;
    let token = deploy_mock_erc20(USER1(), initial_supply);
    let verifier = deploy_mock_verifier(should_verify);
    let vault_addr = deploy_vault(OWNER(), token, verifier);
    let vault = IShieldedVaultDispatcher { contract_address: vault_addr };

    start_cheat_caller_address(token, USER1());
    let token_dispatcher = IMockERC20Dispatcher {
        contract_address: token,
    };
    token_dispatcher.approve(vault_addr, initial_supply);
    stop_cheat_caller_address(token);

    (token, verifier, vault_addr, vault)
}

// =============================================================================
// Replay attack tests
// =============================================================================

#[test]
#[should_panic(expected: 'nullifier already used')]
fn test_replay_shield_nullifier() {
    let (_, _, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(2000);

    // First shield with nullifier
    vault.shield(500, 'commit_1', 'c1', 'c2', 'same_nullifier', array![].span());

    // Replay: same nullifier again -> must revert
    vault.shield(500, 'commit_2', 'c1b', 'c2b', 'same_nullifier', array![].span());
}

#[test]
#[should_panic(expected: 'nullifier already used')]
fn test_replay_unshield_nullifier() {
    let (_, _, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(2000);
    vault.shield(2000, 'commit_1', 'c1', 'c2', 'null_shield', array![].span());

    // First unshield
    vault.unshield(500, 'commit_2', 'c1b', 'c2b', 'null_unshield', array![].span());

    // Replay: same nullifier
    vault.unshield(500, 'commit_3', 'c1c', 'c2c', 'null_unshield', array![].span());
}

#[test]
#[should_panic(expected: 'nullifier already used')]
fn test_cross_operation_nullifier_replay() {
    let (_, _, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(2000);

    // Shield uses a nullifier
    vault.shield(1000, 'commit_1', 'c1', 'c2', 'shared_null', array![].span());

    // Unshield tries to reuse the same nullifier -> must revert
    vault.unshield(500, 'commit_2', 'c1b', 'c2b', 'shared_null', array![].span());
}

// =============================================================================
// Invalid proof tests
// =============================================================================

#[test]
#[should_panic(expected: 'range proof failed')]
fn test_shield_invalid_proof() {
    // Deploy with verifier that REJECTS all proofs
    let (_, _, vault_addr, vault) = setup_with_verifier(false);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);

    // Shield should fail because proof verification returns false
    vault.shield(500, 'commit', 'c1', 'c2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'balance proof failed')]
fn test_unshield_proof_rejected() {
    let (_, verifier, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(1000, 'commit_1', 'c1', 'c2', 'null_1', array![].span());
    stop_cheat_caller_address(vault_addr);

    // Toggle verifier to reject
    let verifier_disp = IMockProofVerifierDispatcher {
        contract_address: verifier,
    };
    verifier_disp.set_should_verify(false);

    // Now unshield should fail
    start_cheat_caller_address(vault_addr, USER1());
    vault.unshield(500, 'commit_2', 'c1b', 'c2b', 'null_2', array![].span());
}

#[test]
#[should_panic(expected: 'update proof failed')]
fn test_second_shield_proof_rejected() {
    let (_, verifier, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(2000);
    vault.shield(500, 'commit_1', 'c1', 'c2', 'null_1', array![].span());
    stop_cheat_caller_address(vault_addr);

    // Toggle verifier to reject
    let verifier_disp = IMockProofVerifierDispatcher {
        contract_address: verifier,
    };
    verifier_disp.set_should_verify(false);

    // Second shield uses DEBT_UPDATE_VALIDITY path -> should fail
    start_cheat_caller_address(vault_addr, USER1());
    vault.shield(500, 'commit_2', 'c1b', 'c2b', 'null_2', array![].span());
}

// =============================================================================
// Paused state attacks
// =============================================================================

#[test]
#[should_panic(expected: 'vault is paused')]
fn test_shield_when_paused() {
    let (_, _, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, USER1());
    vault.shield(500, 'commit', 'c1', 'c2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'vault is paused')]
fn test_unshield_when_paused() {
    let (_, _, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    vault.shield(1000, 'commit_1', 'c1', 'c2', 'null_1', array![].span());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, USER1());
    vault.unshield(500, 'commit_2', 'c1b', 'c2b', 'null_2', array![].span());
}

#[test]
#[should_panic(expected: 'vault is paused')]
fn test_withdraw_when_paused() {
    let (_, _, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, USER1());
    vault.withdraw(500);
}

// =============================================================================
// Authorization tests
// =============================================================================

#[test]
#[should_panic(expected: 'only owner')]
fn test_unpause_non_owner() {
    let (_, _, vault_addr, vault) = setup_with_verifier(true);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, ATTACKER());
    vault.unpause();
}

// =============================================================================
// Isolation tests (users can't affect each other)
// =============================================================================

#[test]
fn test_user_isolation() {
    let (token, _, vault_addr, vault) = setup_with_verifier(true);

    // Fund attacker with tokens too
    let token_disp = IMockERC20Dispatcher {
        contract_address: token,
    };
    token_disp.mint(ATTACKER(), 5000);
    start_cheat_caller_address(token, ATTACKER());
    token_disp.approve(vault_addr, 5000);
    stop_cheat_caller_address(token);

    // User1 deposits
    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(1000);
    stop_cheat_caller_address(vault_addr);

    // Attacker deposits
    start_cheat_caller_address(vault_addr, ATTACKER());
    vault.deposit(3000);
    stop_cheat_caller_address(vault_addr);

    // Balances are isolated
    assert(vault.get_public_balance(USER1()) == 1000, 'user1 balance wrong');
    assert(vault.get_public_balance(ATTACKER()) == 3000, 'attacker balance wrong');
    assert(vault.get_total_deposited() == 4000, 'total wrong');
}
