// StarkShield v1.5 -- Integration tests
//
// Full E2E flow: deposit → shield → open CDP → lock collateral → mint sUSD →
//                repay sUSD → close CDP → unshield → withdraw
//
// Tests the entire protocol lifecycle using all contracts together.

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, DeclareResultTrait, ContractClassTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use starkshield::interfaces::{
    IShieldedVaultDispatcher, IShieldedVaultDispatcherTrait, IShieldedCDPDispatcher,
    IShieldedCDPDispatcherTrait, ISolvencyProverDispatcher, ISolvencyProverDispatcherTrait,
};
use starkshield::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};

// =============================================================================
// Addresses
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

fn PROVER() -> ContractAddress {
    contract_address_const::<'prover'>()
}

fn LIQUIDATOR() -> ContractAddress {
    contract_address_const::<'liquidator'>()
}

// =============================================================================
// Deploy helpers
// =============================================================================

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

fn deploy_solvency_prover(
    owner: ContractAddress, verifier: ContractAddress, prover: ContractAddress,
) -> ContractAddress {
    let contract = declare("SolvencyProver").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    owner.serialize(ref calldata);
    verifier.serialize(ref calldata);
    prover.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

// =============================================================================
// Shared state struct
// =============================================================================

struct FullSetup {
    token_addr: ContractAddress,
    token: IMockERC20Dispatcher,
    verifier_addr: ContractAddress,
    vault_addr: ContractAddress,
    vault: IShieldedVaultDispatcher,
    cdp_addr: ContractAddress,
    cdp: IShieldedCDPDispatcher,
    solvency_addr: ContractAddress,
    solvency: ISolvencyProverDispatcher,
}

/// Deploy the full protocol stack:
/// MockERC20, MockProofVerifier, MockPriceFeed, ShieldedVault, ShieldedCDP, SolvencyProver.
/// Fund USER1 with tokens and approve both vault and CDP.
fn full_setup() -> FullSetup {
    // Set block timestamp for oracle freshness
    start_cheat_block_timestamp_global(1000);

    let initial_supply: u256 = 10000000;
    let token_addr = deploy_mock_erc20(USER1(), initial_supply);
    let token = IMockERC20Dispatcher { contract_address: token_addr };
    let verifier_addr = deploy_mock_verifier(true);
    let price_feed = deploy_mock_price_feed(5000000000000, 1000); // price=5T, ts=1000

    let vault_addr = deploy_vault(OWNER(), token_addr, verifier_addr);
    let vault = IShieldedVaultDispatcher { contract_address: vault_addr };

    let cdp_addr = deploy_cdp(OWNER(), token_addr, verifier_addr, price_feed);
    let cdp = IShieldedCDPDispatcher { contract_address: cdp_addr };

    let solvency_addr = deploy_solvency_prover(OWNER(), verifier_addr, PROVER());
    let solvency = ISolvencyProverDispatcher { contract_address: solvency_addr };

    // Approve vault and CDP to spend USER1's tokens
    start_cheat_caller_address(token_addr, USER1());
    token.approve(vault_addr, initial_supply);
    token.approve(cdp_addr, initial_supply);
    stop_cheat_caller_address(token_addr);

    FullSetup {
        token_addr,
        token,
        verifier_addr,
        vault_addr,
        vault,
        cdp_addr,
        cdp,
        solvency_addr,
        solvency,
    }
}

// =============================================================================
// Integration Test #1: Full deposit → shield → unshield → withdraw flow
// =============================================================================

#[test]
fn test_e2e_vault_full_cycle() {
    let s = full_setup();

    start_cheat_caller_address(s.vault_addr, USER1());

    // Step 1: Deposit 10000 public tokens
    s.vault.deposit(10000);
    assert(s.vault.get_public_balance(USER1()) == 10000, 'deposit: wrong public balance');
    assert(s.vault.get_total_deposited() == 10000, 'deposit: wrong total');

    // Step 2: Shield 7000 into encrypted balance
    s.vault.shield(7000, 'commit_7k', 'c1a', 'c2a', 'null_1', array![].span());
    assert(s.vault.get_public_balance(USER1()) == 3000, 'shield: wrong public');
    assert(s.vault.get_balance_commitment(USER1()) == 'commit_7k', 'shield: wrong commit');

    // Step 3: Shield remaining 3000
    s.vault.shield(3000, 'commit_10k', 'c1b', 'c2b', 'null_2', array![].span());
    assert(s.vault.get_public_balance(USER1()) == 0, 'shield2: wrong public');
    assert(s.vault.get_balance_commitment(USER1()) == 'commit_10k', 'shield2: wrong commit');

    // Step 4: Unshield 5000 back to public
    s.vault.unshield(5000, 'commit_5k', 'c1c', 'c2c', 'null_3', array![].span());
    assert(s.vault.get_public_balance(USER1()) == 5000, 'unshield: wrong public');
    assert(s.vault.get_balance_commitment(USER1()) == 'commit_5k', 'unshield: commit');

    // Step 5: Unshield remaining 5000
    s.vault.unshield(5000, 'commit_0', 'c1d', 'c2d', 'null_4', array![].span());
    assert(s.vault.get_public_balance(USER1()) == 10000, 'unshield2: wrong public');

    // Step 6: Withdraw all back to wallet
    s.vault.withdraw(10000);
    assert(s.vault.get_public_balance(USER1()) == 0, 'withdraw: balance not zero');
    assert(s.vault.get_total_deposited() == 0, 'withdraw: total not zero');

    stop_cheat_caller_address(s.vault_addr);
}

// =============================================================================
// Integration Test #2: Full CDP lifecycle
//   deposit → shield → (transfer to CDP) → lock → mint sUSD → repay → close → withdraw
// =============================================================================

#[test]
fn test_e2e_cdp_full_lifecycle() {
    let s = full_setup();

    // == VAULT PHASE: Deposit and prepare tokens ==
    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.deposit(50000);
    assert(s.vault.get_public_balance(USER1()) == 50000, 'vault deposit failed');
    stop_cheat_caller_address(s.vault_addr);

    // == CDP PHASE: Full lifecycle ==
    start_cheat_caller_address(s.cdp_addr, USER1());

    // Step 1: Open CDP
    s.cdp.open_cdp();
    assert(s.cdp.has_cdp(USER1()), 'cdp should exist');

    // Step 2: Lock 10000 collateral (first lock uses range proof)
    s.cdp.lock_collateral(10000, 'col_commit_1', 'col_c1', 'col_c2', 'cdp_null_1', array![].span());
    assert(s.cdp.get_locked_collateral(USER1()) == 10000, 'lock: wrong collateral');
    assert(s.cdp.get_collateral_commitment(USER1()) == 'col_commit_1', 'lock: wrong commit');

    // Step 3: Lock more collateral (subsequent lock uses debt_update_validity)
    s.cdp.lock_collateral(5000, 'col_commit_2', 'col_c1b', 'col_c2b', 'cdp_null_2', array![].span());
    assert(s.cdp.get_locked_collateral(USER1()) == 15000, 'lock2: wrong collateral');

    // Step 4: Mint 2000 sUSD against collateral
    s.cdp.mint_susd(2000, 'debt_commit_1', 'debt_c1', 'debt_c2', 'cdp_null_3', array![].span());
    assert(s.cdp.get_susd_balance(USER1()) == 2000, 'mint: wrong susd balance');
    assert(s.cdp.get_total_debt_minted() == 2000, 'mint: wrong total debt');

    // Step 5: Mint more sUSD
    s.cdp.mint_susd(1000, 'debt_commit_2', 'debt_c1b', 'debt_c2b', 'cdp_null_4', array![].span());
    assert(s.cdp.get_susd_balance(USER1()) == 3000, 'mint2: wrong susd');
    assert(s.cdp.get_total_debt_minted() == 3000, 'mint2: wrong total');

    // Step 6: Repay 1500 sUSD
    s.cdp.repay(1500, 'debt_commit_3', 'debt_c1c', 'debt_c2c', 'cdp_null_5', array![].span());
    assert(s.cdp.get_susd_balance(USER1()) == 1500, 'repay: wrong susd');
    assert(s.cdp.get_total_debt_minted() == 1500, 'repay: wrong total');

    // Step 7: Repay remaining 1500 sUSD
    s.cdp.repay(1500, 'debt_commit_zero', 'debt_c1d', 'debt_c2d', 'cdp_null_6', array![].span());
    assert(s.cdp.get_susd_balance(USER1()) == 0, 'repay2: susd not zero');
    assert(s.cdp.get_total_debt_minted() == 0, 'repay2: total not zero');

    // Step 8: Close CDP (debt is zero, returns collateral)
    s.cdp.close_cdp('cdp_null_7', array![].span());
    assert(!s.cdp.has_cdp(USER1()), 'cdp should be closed');
    assert(s.cdp.get_locked_collateral(USER1()) == 0, 'close: collateral not returned');

    stop_cheat_caller_address(s.cdp_addr);
}

// =============================================================================
// Integration Test #3: Solvency proofs for both domains
// =============================================================================

#[test]
fn test_e2e_solvency_both_domains() {
    let s = full_setup();

    // Initial state: nothing verified
    assert(!s.solvency.is_vault_solvent(), 'vault: start unverified');
    assert(!s.solvency.is_cdp_safe(), 'cdp: should start not verified');

    start_cheat_caller_address(s.solvency_addr, PROVER());

    // Submit vault solvency proof
    s.solvency.submit_vault_solvency_proof(
        'assets_commit', 'liabilities_commit', 100, array![].span(),
    );
    assert(s.solvency.is_vault_solvent(), 'vault should be solvent');
    assert(s.solvency.get_vault_last_verified() == 1000, 'vault: wrong timestamp');
    assert(s.solvency.get_vault_num_accounts() == 100, 'vault: wrong accounts');

    // Submit CDP safety proof
    s.solvency.submit_cdp_safety_proof(
        'col_commit', 'debt_commit', 50000, 200, 50, array![].span(),
    );
    assert(s.solvency.is_cdp_safe(), 'cdp should be safe');
    assert(s.solvency.get_cdp_last_verified() == 1000, 'cdp: wrong timestamp');
    assert(s.solvency.get_cdp_num_cdps() == 50, 'cdp: wrong count');

    stop_cheat_caller_address(s.solvency_addr);

    // Both domains verified independently
    assert(s.solvency.is_vault_solvent(), 'vault solvent after both');
    assert(s.solvency.is_cdp_safe(), 'cdp safe after both');
}

// =============================================================================
// Integration Test #4: Multi-user scenario
// =============================================================================

#[test]
fn test_e2e_multi_user() {
    let s = full_setup();

    // Fund USER2 as well
    start_cheat_caller_address(s.token_addr, USER1());
    s.token.transfer(USER2(), 500000);
    stop_cheat_caller_address(s.token_addr);

    // USER2 approves vault and CDP
    start_cheat_caller_address(s.token_addr, USER2());
    s.token.approve(s.vault_addr, 500000);
    s.token.approve(s.cdp_addr, 500000);
    stop_cheat_caller_address(s.token_addr);

    // == USER1: deposit and shield ==
    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.deposit(20000);
    s.vault.shield(10000, 'u1_commit', 'u1c1', 'u1c2', 'u1n1', array![].span());
    stop_cheat_caller_address(s.vault_addr);

    // == USER2: deposit and shield ==
    start_cheat_caller_address(s.vault_addr, USER2());
    s.vault.deposit(15000);
    s.vault.shield(8000, 'u2_commit', 'u2c1', 'u2c2', 'u2n1', array![].span());
    stop_cheat_caller_address(s.vault_addr);

    // Verify independent balances
    assert(s.vault.get_public_balance(USER1()) == 10000, 'u1: wrong public');
    assert(s.vault.get_public_balance(USER2()) == 7000, 'u2: wrong public');
    assert(s.vault.get_total_deposited() == 35000, 'total: wrong');
    assert(s.vault.get_balance_commitment(USER1()) == 'u1_commit', 'u1: wrong commit');
    assert(s.vault.get_balance_commitment(USER2()) == 'u2_commit', 'u2: wrong commit');

    // == USER1: open CDP and mint ==
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.open_cdp();
    s.cdp.lock_collateral(5000, 'u1_col', 'u1cc1', 'u1cc2', 'u1cn1', array![].span());
    s.cdp.mint_susd(1000, 'u1_debt', 'u1dc1', 'u1dc2', 'u1cn2', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    // == USER2: open CDP and mint ==
    start_cheat_caller_address(s.cdp_addr, USER2());
    s.cdp.open_cdp();
    s.cdp.lock_collateral(3000, 'u2_col', 'u2cc1', 'u2cc2', 'u2cn1', array![].span());
    s.cdp.mint_susd(500, 'u2_debt', 'u2dc1', 'u2dc2', 'u2cn2', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    // Verify independent CDP states
    assert(s.cdp.get_locked_collateral(USER1()) == 5000, 'u1: wrong col');
    assert(s.cdp.get_locked_collateral(USER2()) == 3000, 'u2: wrong col');
    assert(s.cdp.get_susd_balance(USER1()) == 1000, 'u1: wrong susd');
    assert(s.cdp.get_susd_balance(USER2()) == 500, 'u2: wrong susd');
    assert(s.cdp.get_total_debt_minted() == 1500, 'total debt wrong');
}

// =============================================================================
// Integration Test #5: Liquidation flow end-to-end
//   lock collateral → mint sUSD → trigger liquidation → prove health (cancel)
//   and: lock → mint → trigger → timeout → execute liquidation (seize)
// =============================================================================

#[test]
fn test_e2e_liquidation_prove_health() {
    let s = full_setup();

    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.open_cdp();
    s.cdp.lock_collateral(10000, 'col_1', 'cc1', 'cc2', 'ln1', array![].span());
    s.cdp.mint_susd(2000, 'debt_1', 'dc1', 'dc2', 'ln2', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    // LIQUIDATOR triggers liquidation challenge
    start_cheat_caller_address(s.cdp_addr, LIQUIDATOR());
    s.cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(s.cdp_addr);

    assert(s.cdp.is_in_liquidation(USER1()), 'should be in liquidation');
    assert(s.cdp.get_liquidation_deadline(USER1()) == 1000 + 86400, 'wrong deadline');

    // USER1 proves health within the window
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.prove_health('ln3', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    // Liquidation cancelled
    assert(!s.cdp.is_in_liquidation(USER1()), 'liquidation should be cancelled');

    // CDP still operational
    assert(s.cdp.get_locked_collateral(USER1()) == 10000, 'collateral should be intact');
    assert(s.cdp.get_susd_balance(USER1()) == 2000, 'susd should be intact');
}

#[test]
fn test_e2e_liquidation_execute_seizure() {
    let s = full_setup();

    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.open_cdp();
    s.cdp.lock_collateral(10000, 'col_1', 'cc1', 'cc2', 'ln1', array![].span());
    s.cdp.mint_susd(2000, 'debt_1', 'dc1', 'dc2', 'ln2', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    // Trigger liquidation
    start_cheat_caller_address(s.cdp_addr, LIQUIDATOR());
    s.cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(s.cdp_addr);

    // Advance time past liquidation window (24 hours + 1 second)
    start_cheat_block_timestamp_global(1000 + 86401);

    // Execute liquidation — seize collateral
    start_cheat_caller_address(s.cdp_addr, LIQUIDATOR());
    s.cdp.execute_liquidation(USER1());
    stop_cheat_caller_address(s.cdp_addr);

    // Collateral seized, debt written off
    assert(s.cdp.get_locked_collateral(USER1()) == 0, 'collateral should be seized');
    assert(!s.cdp.is_in_liquidation(USER1()), 'liquidation should be resolved');
}

// =============================================================================
// Integration Test #6: Cross-contract isolation
// Vault and CDP states are independent; solvency per-domain.
// =============================================================================

#[test]
fn test_e2e_cross_contract_isolation() {
    let s = full_setup();

    // Deposit into vault
    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.deposit(50000);
    stop_cheat_caller_address(s.vault_addr);

    // Open CDP and lock
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.open_cdp();
    s.cdp.lock_collateral(20000, 'col', 'c1', 'c2', 'n1', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    // Pause vault — CDP should still work
    start_cheat_caller_address(s.vault_addr, OWNER());
    s.vault.pause();
    stop_cheat_caller_address(s.vault_addr);

    assert(s.vault.is_paused(), 'vault should be paused');

    // CDP operations still work while vault is paused
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.mint_susd(1000, 'debt', 'dc1', 'dc2', 'n2', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    assert(s.cdp.get_susd_balance(USER1()) == 1000, 'cdp should work independently');

    // Pause CDP — vault should still work after unpause
    start_cheat_caller_address(s.cdp_addr, OWNER());
    s.cdp.pause();
    stop_cheat_caller_address(s.cdp_addr);

    start_cheat_caller_address(s.vault_addr, OWNER());
    s.vault.unpause();
    stop_cheat_caller_address(s.vault_addr);

    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.withdraw(1000);
    stop_cheat_caller_address(s.vault_addr);

    assert(s.vault.get_public_balance(USER1()) == 49000, 'vault should work after unpause');

    // Solvency domains are independent
    start_cheat_caller_address(s.solvency_addr, PROVER());
    s.solvency.submit_vault_solvency_proof('a', 'l', 10, array![].span());
    stop_cheat_caller_address(s.solvency_addr);

    assert(s.solvency.is_vault_solvent(), 'vault domain should be verified');
    assert(!s.solvency.is_cdp_safe(), 'cdp domain independent');
}

// =============================================================================
// Integration Test #7: Nullifier replay protection across operations
// =============================================================================

#[test]
#[should_panic(expected: 'nullifier already used')]
fn test_e2e_nullifier_replay_vault() {
    let s = full_setup();

    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.deposit(10000);
    s.vault.shield(5000, 'commit_1', 'c1', 'c2', 'shared_null', array![].span());
    // Replay the same nullifier — should fail
    s.vault.shield(2000, 'commit_2', 'c1b', 'c2b', 'shared_null', array![].span());
}

#[test]
#[should_panic(expected: 'nullifier already used')]
fn test_e2e_nullifier_replay_cdp() {
    let s = full_setup();

    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.open_cdp();
    s.cdp.lock_collateral(10000, 'col_1', 'c1', 'c2', 'shared_null', array![].span());
    // Replay the same nullifier — should fail
    s.cdp.lock_collateral(5000, 'col_2', 'c1b', 'c2b', 'shared_null', array![].span());
}

// =============================================================================
// Integration Test #8: Repay during liquidation window
// User can still repay even when under liquidation challenge.
// =============================================================================

#[test]
fn test_e2e_repay_during_liquidation() {
    let s = full_setup();

    // Setup CDP with debt
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.open_cdp();
    s.cdp.lock_collateral(10000, 'col', 'c1', 'c2', 'n1', array![].span());
    s.cdp.mint_susd(2000, 'debt_1', 'dc1', 'dc2', 'n2', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    // Trigger liquidation
    start_cheat_caller_address(s.cdp_addr, LIQUIDATOR());
    s.cdp.trigger_liquidation(USER1());
    stop_cheat_caller_address(s.cdp_addr);

    assert(s.cdp.is_in_liquidation(USER1()), 'should be in liquidation');

    // USER1 repays during liquidation window (allowed)
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.repay(1000, 'debt_2', 'dc1b', 'dc2b', 'n3', array![].span());
    stop_cheat_caller_address(s.cdp_addr);

    assert(s.cdp.get_susd_balance(USER1()) == 1000, 'repay during liq: wrong susd');
    assert(s.cdp.get_total_debt_minted() == 1000, 'repay during liq: wrong total');
}

// =============================================================================
// Integration Test #9: Proof verifier rejection
// When verifier rejects proofs, all state-changing operations should fail.
// =============================================================================

#[test]
#[should_panic(expected: 'range proof failed')]
fn test_e2e_rejected_proof_blocks_shield() {
    let token_addr = deploy_mock_erc20(USER1(), 1000000);
    let token = IMockERC20Dispatcher { contract_address: token_addr };
    let bad_verifier = deploy_mock_verifier(false); // Rejects all proofs

    let vault_addr = deploy_vault(OWNER(), token_addr, bad_verifier);
    let vault = IShieldedVaultDispatcher { contract_address: vault_addr };

    start_cheat_caller_address(token_addr, USER1());
    token.approve(vault_addr, 1000000);
    stop_cheat_caller_address(token_addr);

    start_cheat_caller_address(vault_addr, USER1());
    vault.deposit(10000);
    // Shield should fail because verifier rejects the proof
    vault.shield(5000, 'commit', 'c1', 'c2', 'null_1', array![].span());
}

#[test]
#[should_panic(expected: 'range proof failed')]
fn test_e2e_rejected_proof_blocks_mint() {
    start_cheat_block_timestamp_global(1000);

    let token_addr = deploy_mock_erc20(USER1(), 1000000);
    let token = IMockERC20Dispatcher { contract_address: token_addr };
    let bad_verifier = deploy_mock_verifier(false);
    let price_feed = deploy_mock_price_feed(5000000000000, 1000);

    let cdp_addr = deploy_cdp(OWNER(), token_addr, bad_verifier, price_feed);
    let cdp = IShieldedCDPDispatcher { contract_address: cdp_addr };

    start_cheat_caller_address(token_addr, USER1());
    token.approve(cdp_addr, 1000000);
    stop_cheat_caller_address(token_addr);

    start_cheat_caller_address(cdp_addr, USER1());
    cdp.open_cdp();
    // Lock should fail because verifier rejects
    cdp.lock_collateral(10000, 'col', 'c1', 'c2', 'n1', array![].span());
}

// =============================================================================
// Integration Test #10: Full E2E — deposit through CDP cycle back to withdraw
// The complete happy path matching Phase 7 spec:
//   deposit → shield → open CDP → lock → mint sUSD → repay → close CDP →
//   unshield → withdraw
// =============================================================================

#[test]
fn test_e2e_complete_happy_path() {
    let s = full_setup();

    // === Step 1: Deposit BTC into vault ===
    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.deposit(100000);
    stop_cheat_caller_address(s.vault_addr);
    assert(s.vault.get_public_balance(USER1()) == 100000, 'e2e step1: deposit');

    // === Step 2: Shield into sxyBTC ===
    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.shield(80000, 'v_commit_80k', 'vc1', 'vc2', 'vn1', array![].span());
    stop_cheat_caller_address(s.vault_addr);
    assert(s.vault.get_public_balance(USER1()) == 20000, 'e2e step2: shield public');
    assert(
        s.vault.get_balance_commitment(USER1()) == 'v_commit_80k', 'e2e step2: shield commit',
    );

    // === Step 3: Open CDP ===
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.open_cdp();
    stop_cheat_caller_address(s.cdp_addr);
    assert(s.cdp.has_cdp(USER1()), 'e2e step3: cdp exists');

    // === Step 4: Lock sxyBTC as collateral ===
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.lock_collateral(
        30000, 'cdp_col_30k', 'cc1', 'cc2', 'cn1', array![].span(),
    );
    stop_cheat_caller_address(s.cdp_addr);
    assert(s.cdp.get_locked_collateral(USER1()) == 30000, 'e2e step4: lock amount');

    // === Step 5: Mint sUSD ===
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.mint_susd(5000, 'cdp_debt_5k', 'dc1', 'dc2', 'cn2', array![].span());
    stop_cheat_caller_address(s.cdp_addr);
    assert(s.cdp.get_susd_balance(USER1()) == 5000, 'e2e step5: mint susd');

    // === Step 6: Repay all sUSD ===
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.repay(5000, 'cdp_debt_zero', 'dc1b', 'dc2b', 'cn3', array![].span());
    stop_cheat_caller_address(s.cdp_addr);
    assert(s.cdp.get_susd_balance(USER1()) == 0, 'e2e step6: repay susd');
    assert(s.cdp.get_total_debt_minted() == 0, 'e2e step6: total debt');

    // === Step 7: Close CDP (returns collateral) ===
    start_cheat_caller_address(s.cdp_addr, USER1());
    s.cdp.close_cdp('cn4', array![].span());
    stop_cheat_caller_address(s.cdp_addr);
    assert(!s.cdp.has_cdp(USER1()), 'e2e step7: cdp closed');
    assert(s.cdp.get_locked_collateral(USER1()) == 0, 'e2e step7: collateral returned');

    // === Step 8: Unshield sxyBTC back to public ===
    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.unshield(80000, 'v_commit_0', 'vc1b', 'vc2b', 'vn2', array![].span());
    stop_cheat_caller_address(s.vault_addr);
    assert(s.vault.get_public_balance(USER1()) == 100000, 'e2e step8: unshield');

    // === Step 9: Withdraw everything ===
    start_cheat_caller_address(s.vault_addr, USER1());
    s.vault.withdraw(100000);
    stop_cheat_caller_address(s.vault_addr);
    assert(s.vault.get_public_balance(USER1()) == 0, 'e2e step9: withdraw');
    assert(s.vault.get_total_deposited() == 0, 'e2e step9: total zero');

    // === Verify solvency proofs work on the final state ===
    start_cheat_caller_address(s.solvency_addr, PROVER());
    s.solvency.submit_vault_solvency_proof('final_a', 'final_l', 1, array![].span());
    s.solvency.submit_cdp_safety_proof('final_c', 'final_d', 50000, 200, 1, array![].span());
    stop_cheat_caller_address(s.solvency_addr);

    assert(s.solvency.is_vault_solvent(), 'e2e: vault solvent');
    assert(s.solvency.is_cdp_safe(), 'e2e: cdp safe');
}
