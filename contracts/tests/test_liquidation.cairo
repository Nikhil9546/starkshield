// StarkShield v1.5 -- Liquidation Mode A tests
//
// Tests: trigger liquidation, disclosure window, prove health, execute liquidation,
// conservative seizure, timeout behavior, cancellation.

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, DeclareResultTrait, ContractClassTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use starkshield::interfaces::{IShieldedCDPDispatcher, IShieldedCDPDispatcherTrait};
use starkshield::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use starkshield::mocks::mock_verifier::{
    IMockProofVerifierDispatcher, IMockProofVerifierDispatcherTrait,
};

// =============================================================================
// Test helpers (independent from test_cdp for isolation)
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

fn LIQUIDATOR() -> ContractAddress {
    contract_address_const::<'liquidator'>()
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

fn deploy_mock_price_feed(price: u256, timestamp: u64) -> ContractAddress {
    let contract = declare("MockPriceFeed").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    price.serialize(ref calldata);
    timestamp.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_cdp(
    owner: ContractAddress,
    token: ContractAddress,
    verifier: ContractAddress,
    price_feed: ContractAddress,
) -> ContractAddress {
    let contract = declare("ShieldedCDP").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    owner.serialize(ref calldata);
    token.serialize(ref calldata);
    verifier.serialize(ref calldata);
    price_feed.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

/// Setup a CDP with USER1 having collateral locked and sUSD minted.
fn setup_with_debt() -> (ContractAddress, ContractAddress, ContractAddress, IShieldedCDPDispatcher) {
    let initial_supply: u256 = 1000000;
    let token = deploy_mock_erc20(USER1(), initial_supply);
    let verifier = deploy_mock_verifier(true);

    start_cheat_block_timestamp_global(1000);

    let price_feed = deploy_mock_price_feed(5000000000000, 1000);
    let cdp_addr = deploy_cdp(OWNER(), token, verifier, price_feed);
    let cdp = IShieldedCDPDispatcher { contract_address: cdp_addr };

    // Approve and setup
    start_cheat_caller_address(token, USER1());
    let token_disp = IMockERC20Dispatcher { contract_address: token };
    token_disp.approve(cdp_addr, initial_supply);
    stop_cheat_caller_address(token);

    // Open CDP, lock collateral, mint sUSD
    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.mint_susd('debt_commit', 'dc1', 'dc2', 'null_2', array![].span());
    stop_cheat_caller_address(cdp_addr);

    (token, verifier, cdp_addr, cdp)
}

// =============================================================================
// Trigger liquidation tests
// =============================================================================

#[test]
fn test_trigger_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    // Anyone can trigger liquidation
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.is_in_liquidation(USER1()), 'should be in liquidation');
    // Deadline = 1000 + 86400 = 87400
    assert(cdp.get_liquidation_deadline(USER1()) == 87400, 'wrong deadline');
}

#[test]
#[should_panic(expected: 'no cdp exists')]
fn test_trigger_liquidation_no_cdp() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER2());
}

fn USER2() -> ContractAddress {
    contract_address_const::<'user2'>()
}

#[test]
#[should_panic(expected: 'already in liquidation')]
fn test_trigger_liquidation_duplicate() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    cdp.trigger_liquidation(USER1()); // duplicate
}

#[test]
#[should_panic(expected: 'no debt to liquidate')]
fn test_trigger_liquidation_no_debt() {
    let initial_supply: u256 = 1000000;
    let token = deploy_mock_erc20(USER1(), initial_supply);
    let verifier = deploy_mock_verifier(true);
    start_cheat_block_timestamp_global(1000);
    let price_feed = deploy_mock_price_feed(5000000000000, 1000);
    let cdp_addr = deploy_cdp(OWNER(), token, verifier, price_feed);
    let cdp = IShieldedCDPDispatcher { contract_address: cdp_addr };

    start_cheat_caller_address(token, USER1());
    IMockERC20Dispatcher { contract_address: token }.approve(cdp_addr, initial_supply);
    stop_cheat_caller_address(token);

    // Open CDP and lock collateral but don't mint
    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(1000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
}

// =============================================================================
// Prove health (cancel liquidation)
// =============================================================================

#[test]
fn test_prove_health_cancels_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    // Trigger liquidation
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.is_in_liquidation(USER1()), 'should be in liquidation');

    // User proves health within window
    start_cheat_caller_address(cdp_addr, USER1());
    cdp.prove_health('null_health', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(!cdp.is_in_liquidation(USER1()), 'liquidation should cancel');
    assert(cdp.get_liquidation_deadline(USER1()) == 0, 'deadline should be zero');
    assert(cdp.has_cdp(USER1()), 'cdp should still exist');
}

#[test]
#[should_panic(expected: 'not in liquidation')]
fn test_prove_health_not_in_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.prove_health('null_health', array![].span());
}

#[test]
#[should_panic(expected: 'collateral ratio proof failed')]
fn test_prove_health_invalid_proof() {
    let (_, verifier, cdp_addr, cdp) = setup_with_debt();

    // Trigger liquidation
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    // Toggle verifier to reject
    let verifier_disp = IMockProofVerifierDispatcher { contract_address: verifier };
    verifier_disp.set_should_verify(false);

    // User tries to prove health but proof is invalid
    start_cheat_caller_address(cdp_addr, USER1());
    cdp.prove_health('null_health', array![].span());
}

// =============================================================================
// Execute liquidation (conservative seizure after timeout)
// =============================================================================

#[test]
fn test_execute_liquidation_after_timeout() {
    let (token, _, cdp_addr, cdp) = setup_with_debt();

    let initial_collateral = cdp.get_locked_collateral(USER1());
    assert(initial_collateral == 10000, 'wrong initial collateral');

    // Trigger liquidation
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    // Advance time past deadline (1000 + 86400 = 87400)
    start_cheat_block_timestamp_global(87401);

    // Liquidator executes
    start_cheat_caller_address(cdp_addr, LIQUIDATOR());
    cdp.execute_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    // CDP should be cleared
    assert(!cdp.has_cdp(USER1()), 'cdp should be gone');
    assert(cdp.get_locked_collateral(USER1()) == 0, 'collateral should be zero');
    assert(!cdp.is_in_liquidation(USER1()), 'not in liquidation');

    // Liquidator should have received the collateral tokens
    let token_disp = IMockERC20Dispatcher { contract_address: token };
    let liquidator_balance = token_disp.balance_of(LIQUIDATOR());
    assert(liquidator_balance == initial_collateral, 'wrong liquidator balance');
}

#[test]
#[should_panic(expected: 'liquidation window active')]
fn test_execute_liquidation_too_early() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    // Trigger liquidation at t=1000
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    // Try to execute before deadline (still at t=1000, deadline is 87400)
    start_cheat_caller_address(cdp_addr, LIQUIDATOR());
    cdp.execute_liquidation(USER1());
}

#[test]
#[should_panic(expected: 'not in liquidation')]
fn test_execute_liquidation_not_triggered() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, LIQUIDATOR());
    cdp.execute_liquidation(USER1());
}

// =============================================================================
// Liquidation blocks operations
// =============================================================================

#[test]
#[should_panic(expected: 'position in liquidation')]
fn test_lock_collateral_during_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.lock_collateral(500, 'commit', 'c1', 'c2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'position in liquidation')]
fn test_mint_during_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.mint_susd('commit', 'c1', 'c2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'position in liquidation')]
fn test_close_during_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.close_cdp('null', array![].span());
}

#[test]
#[should_panic(expected: 'position in liquidation')]
fn test_unlock_collateral_during_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.unlock_collateral(500, 'commit', 'c1', 'c2', 'null', array![].span());
}

// =============================================================================
// Repay still works during liquidation (user can repay to restore health)
// =============================================================================

#[test]
fn test_repay_during_liquidation() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    // Trigger liquidation
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    // User can still repay during liquidation
    start_cheat_caller_address(cdp_addr, USER1());
    cdp.repay('debt_commit_new', 'dc1', 'dc2', 'null_repay', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_new', 'wrong debt commit after repay');
}

// =============================================================================
// Full liquidation flow
// =============================================================================

#[test]
fn test_full_liquidation_flow_with_health_proof() {
    let (_, _, cdp_addr, cdp) = setup_with_debt();

    // 1. Attacker triggers liquidation
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);
    assert(cdp.is_in_liquidation(USER1()), 'step1: in liquidation');

    // 2. User proves health (position is safe)
    start_cheat_caller_address(cdp_addr, USER1());
    cdp.prove_health('null_health', array![].span());
    stop_cheat_caller_address(cdp_addr);
    assert(!cdp.is_in_liquidation(USER1()), 'step2: not in liquidation');

    // 3. CDP still functional after proving health
    start_cheat_caller_address(cdp_addr, USER1());
    cdp.repay('debt_zero', 'dc1z', 'dc2z', 'null_repay', array![].span());
    cdp.close_cdp('null_close', array![].span());
    stop_cheat_caller_address(cdp_addr);
    assert(!cdp.has_cdp(USER1()), 'step3: closed');
}

#[test]
fn test_full_liquidation_flow_seizure() {
    let (token, _, cdp_addr, cdp) = setup_with_debt();

    // 1. Attacker triggers liquidation
    start_cheat_caller_address(cdp_addr, ATTACKER());
    cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    // 2. User fails to prove health (window expires)
    start_cheat_block_timestamp_global(90000); // well past deadline

    // 3. Liquidator seizes collateral
    start_cheat_caller_address(cdp_addr, LIQUIDATOR());
    cdp.execute_liquidation(USER1());
    stop_cheat_caller_address(cdp_addr);

    // 4. Verify final state
    assert(!cdp.has_cdp(USER1()), 'cdp gone');

    let token_disp = IMockERC20Dispatcher { contract_address: token };
    assert(token_disp.balance_of(LIQUIDATOR()) == 10000, 'liquidator got collateral');
}
