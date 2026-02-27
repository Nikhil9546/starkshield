// StarkShield v1.5 -- ShieldedCDP unit tests
//
// Tests: open, lock collateral, mint sUSD, repay, close, view functions, pause/unpause.

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, DeclareResultTrait, ContractClassTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use starkshield::interfaces::{IShieldedCDPDispatcher, IShieldedCDPDispatcherTrait};
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

/// Standard CDP test setup.
/// Deploys token, verifier, price feed, and CDP contract.
/// Funds USER1 with tokens and approves CDP to spend them.
/// Sets block timestamp to 1000 and oracle timestamp to 1000 (fresh).
fn setup() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, IShieldedCDPDispatcher) {
    let initial_supply: u256 = 1000000;
    let token = deploy_mock_erc20(USER1(), initial_supply);
    let verifier = deploy_mock_verifier(true);

    // Set block timestamp so oracle staleness check works
    start_cheat_block_timestamp_global(1000);

    let price_feed = deploy_mock_price_feed(5000000000000, 1000); // price=$50000, timestamp=1000
    let cdp_addr = deploy_cdp(OWNER(), token, verifier, price_feed);
    let cdp = IShieldedCDPDispatcher { contract_address: cdp_addr };

    // Approve CDP to spend user's tokens
    start_cheat_caller_address(token, USER1());
    let token_disp = IMockERC20Dispatcher { contract_address: token };
    token_disp.approve(cdp_addr, initial_supply);
    stop_cheat_caller_address(token);

    (token, verifier, price_feed, cdp_addr, cdp)
}

// =============================================================================
// Open CDP tests
// =============================================================================

#[test]
fn test_open_cdp() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.has_cdp(USER1()), 'should have cdp');
}

#[test]
#[should_panic(expected: 'cdp already exists')]
fn test_open_cdp_duplicate() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.open_cdp(); // duplicate
}

// =============================================================================
// Lock collateral tests
// =============================================================================

#[test]
fn test_lock_collateral_first_time() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(1000, 'col_commit_1', 'cc1', 'cc2', 'null_1', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_locked_collateral(USER1()) == 1000, 'wrong locked collateral');
    assert(cdp.get_collateral_commitment(USER1()) == 'col_commit_1', 'wrong commitment');
    let (cc1, cc2) = cdp.get_encrypted_collateral(USER1());
    assert(cc1 == 'cc1', 'wrong ct c1');
    assert(cc2 == 'cc2', 'wrong ct c2');
    assert(cdp.is_nullifier_used('null_1'), 'nullifier not marked');
}

#[test]
fn test_lock_collateral_subsequent() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(500, 'col_commit_1', 'cc1a', 'cc2a', 'null_1', array![].span());
    cdp.lock_collateral(300, 'col_commit_2', 'cc1b', 'cc2b', 'null_2', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_locked_collateral(USER1()) == 800, 'wrong total collateral');
    assert(cdp.get_collateral_commitment(USER1()) == 'col_commit_2', 'wrong commitment');
}

#[test]
#[should_panic(expected: 'no cdp exists')]
fn test_lock_collateral_no_cdp() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.lock_collateral(1000, 'commit', 'c1', 'c2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'amount must be positive')]
fn test_lock_collateral_zero() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(0, 'commit', 'c1', 'c2', 'null', array![].span());
}

// =============================================================================
// Unlock collateral tests
// =============================================================================

#[test]
fn test_unlock_collateral_no_debt() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(1000, 'col_commit_1', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.unlock_collateral(400, 'col_commit_2', 'cc1b', 'cc2b', 'null_2', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_locked_collateral(USER1()) == 600, 'wrong remaining collateral');
    assert(cdp.get_collateral_commitment(USER1()) == 'col_commit_2', 'wrong commitment');
}

#[test]
#[should_panic(expected: 'insufficient collateral')]
fn test_unlock_collateral_insufficient() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(500, 'col_commit_1', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.unlock_collateral(600, 'col_commit_2', 'cc1b', 'cc2b', 'null_2', array![].span());
}

// =============================================================================
// Mint sUSD tests
// =============================================================================

#[test]
fn test_mint_susd() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.mint_susd('debt_commit_1', 'dc1', 'dc2', 'null_2', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_1', 'wrong debt commitment');
    let (dc1, dc2) = cdp.get_encrypted_debt(USER1());
    assert(dc1 == 'dc1', 'wrong debt ct c1');
    assert(dc2 == 'dc2', 'wrong debt ct c2');
}

#[test]
fn test_mint_susd_multiple() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.mint_susd('debt_commit_1', 'dc1a', 'dc2a', 'null_2', array![].span());
    cdp.mint_susd('debt_commit_2', 'dc1b', 'dc2b', 'null_3', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_2', 'wrong debt commit');
}

#[test]
#[should_panic(expected: 'no collateral locked')]
fn test_mint_susd_no_collateral() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.mint_susd('debt_commit', 'dc1', 'dc2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'no cdp exists')]
fn test_mint_susd_no_cdp() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.mint_susd('debt_commit', 'dc1', 'dc2', 'null', array![].span());
}

// =============================================================================
// Repay tests
// =============================================================================

#[test]
fn test_repay_partial() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.mint_susd('debt_commit_1', 'dc1', 'dc2', 'null_2', array![].span());
    cdp.repay('debt_commit_2', 'dc1b', 'dc2b', 'null_3', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_2', 'wrong debt commit');
}

#[test]
fn test_repay_full() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.mint_susd('debt_commit_1', 'dc1', 'dc2', 'null_2', array![].span());
    cdp.repay('debt_commit_zero', 'dc1z', 'dc2z', 'null_3', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_zero', 'wrong debt commit');
}

#[test]
#[should_panic(expected: 'no debt to repay')]
fn test_repay_no_debt() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(1000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.repay('debt_commit', 'dc1', 'dc2', 'null_2', array![].span());
}

// NOTE: test_repay_insufficient_susd removed -- plaintext balance check replaced by
// cryptographic enforcement via debt_update_validity proof (new_debt >= 0).

// =============================================================================
// Close CDP tests
// =============================================================================

#[test]
fn test_close_cdp_no_debt() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(1000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.close_cdp('null_close', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(!cdp.has_cdp(USER1()), 'cdp should be closed');
    assert(cdp.get_locked_collateral(USER1()) == 0, 'collateral should be zero');
    assert(cdp.get_collateral_commitment(USER1()) == 0, 'commitment should be zero');
}

#[test]
fn test_close_cdp_after_full_repay() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.mint_susd('debt_commit_1', 'dc1', 'dc2', 'null_2', array![].span());
    cdp.repay('debt_commit_zero', 'dc1z', 'dc2z', 'null_3', array![].span());
    cdp.close_cdp('null_close', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(!cdp.has_cdp(USER1()), 'cdp should be closed');
}

#[test]
fn test_close_cdp_empty() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.close_cdp('null_close', array![].span());
    stop_cheat_caller_address(cdp_addr);

    assert(!cdp.has_cdp(USER1()), 'cdp should be closed');
}

#[test]
#[should_panic(expected: 'no cdp exists')]
fn test_close_cdp_not_opened() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.close_cdp('null', array![].span());
}

// =============================================================================
// Oracle staleness tests
// =============================================================================

#[test]
#[should_panic(expected: 'oracle price stale')]
fn test_mint_stale_oracle() {
    let (_, _, price_feed, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    stop_cheat_caller_address(cdp_addr);

    // Advance time past staleness threshold (oracle timestamp stays at 1000)
    // ORACLE_STALENESS_THRESHOLD = 3600
    start_cheat_block_timestamp_global(5000);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.mint_susd('debt_commit', 'dc1', 'dc2', 'null_2', array![].span());
}

// =============================================================================
// Pause tests
// =============================================================================

#[test]
fn test_cdp_pause_unpause() {
    let (_, _, _, cdp_addr, cdp) = setup();

    assert(!cdp.is_cdp_paused(), 'should start unpaused');

    start_cheat_caller_address(cdp_addr, OWNER());
    cdp.pause();
    stop_cheat_caller_address(cdp_addr);

    assert(cdp.is_cdp_paused(), 'should be paused');

    start_cheat_caller_address(cdp_addr, OWNER());
    cdp.unpause();
    stop_cheat_caller_address(cdp_addr);

    assert(!cdp.is_cdp_paused(), 'should be unpaused');
}

#[test]
#[should_panic(expected: 'cdp is paused')]
fn test_open_cdp_when_paused() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, OWNER());
    cdp.pause();
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
}

#[test]
#[should_panic(expected: 'cdp is paused')]
fn test_lock_collateral_when_paused() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, OWNER());
    cdp.pause();
    stop_cheat_caller_address(cdp_addr);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.lock_collateral(1000, 'commit', 'c1', 'c2', 'null', array![].span());
}

#[test]
#[should_panic(expected: 'only owner')]
fn test_pause_non_owner() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.pause();
}

// =============================================================================
// View function tests
// =============================================================================

#[test]
fn test_initial_cdp_state() {
    let (_, _, _, _, cdp) = setup();

    assert(!cdp.has_cdp(USER1()), 'no cdp initially');
    assert(cdp.get_collateral_commitment(USER1()) == 0, 'no collateral commit');
    assert(cdp.get_debt_commitment(USER1()) == 0, 'no debt commit');
    assert(cdp.get_locked_collateral(USER1()) == 0, 'no locked collateral');
    assert(!cdp.is_in_liquidation(USER1()), 'not in liquidation');
    assert(!cdp.is_cdp_paused(), 'not paused');
}

// =============================================================================
// Full flow: open -> lock -> mint -> repay -> close
// =============================================================================

#[test]
fn test_full_cdp_flow() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());

    // 1. Open CDP
    cdp.open_cdp();
    assert(cdp.has_cdp(USER1()), 'step1: has cdp');

    // 2. Lock collateral
    cdp.lock_collateral(5000, 'col_commit_1', 'cc1', 'cc2', 'null_1', array![].span());
    assert(cdp.get_locked_collateral(USER1()) == 5000, 'step2: collateral');

    // 3. Mint sUSD
    cdp.mint_susd('debt_commit_1', 'dc1', 'dc2', 'null_2', array![].span());
    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_1', 'step3: debt commit');

    // 4. Partial repay
    cdp.repay('debt_commit_2', 'dc1b', 'dc2b', 'null_3', array![].span());
    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_2', 'step4: debt commit');

    // 5. Full repay remaining
    cdp.repay('debt_commit_zero', 'dc1z', 'dc2z', 'null_4', array![].span());
    assert(cdp.get_debt_commitment(USER1()) == 'debt_commit_zero', 'step5: debt commit');

    // 6. Close CDP
    cdp.close_cdp('null_close', array![].span());
    assert(!cdp.has_cdp(USER1()), 'step6: closed');
    assert(cdp.get_locked_collateral(USER1()) == 0, 'step6: no collateral');

    stop_cheat_caller_address(cdp_addr);
}

// =============================================================================
// Nullifier replay tests
// =============================================================================

#[test]
#[should_panic(expected: 'nullifier already used')]
fn test_lock_collateral_replay_nullifier() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(500, 'commit_1', 'c1', 'c2', 'same_null', array![].span());
    cdp.lock_collateral(500, 'commit_2', 'c1b', 'c2b', 'same_null', array![].span());
}

#[test]
#[should_panic(expected: 'nullifier already used')]
fn test_mint_replay_nullifier() {
    let (_, _, _, cdp_addr, cdp) = setup();

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    cdp.lock_collateral(10000, 'col_commit', 'cc1', 'cc2', 'null_1', array![].span());
    cdp.mint_susd('debt_commit_1', 'dc1', 'dc2', 'same_null', array![].span());
    cdp.mint_susd('debt_commit_2', 'dc1b', 'dc2b', 'same_null', array![].span());
}
