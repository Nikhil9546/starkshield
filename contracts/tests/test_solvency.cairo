// Obscura v1.5 -- SolvencyProver tests
//
// Tests: vault solvency proof submission, CDP safety proof submission,
// unauthorized prover rejection, invalid proof rejection, pause behavior,
// view functions, prover rotation, timestamp tracking.

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, DeclareResultTrait, ContractClassTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use obscura::interfaces::{ISolvencyProverDispatcher, ISolvencyProverDispatcherTrait};
use obscura::mocks::mock_verifier::{
    IMockProofVerifierDispatcher, IMockProofVerifierDispatcherTrait,
};

// =============================================================================
// Test helpers
// =============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn PROVER() -> ContractAddress {
    contract_address_const::<'prover'>()
}

fn PROVER2() -> ContractAddress {
    contract_address_const::<'prover2'>()
}

fn ATTACKER() -> ContractAddress {
    contract_address_const::<'attacker'>()
}

fn deploy_mock_verifier(should_verify: bool) -> ContractAddress {
    let contract = declare("MockProofVerifier").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    should_verify.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_solvency_prover(
    owner: ContractAddress,
    verifier: ContractAddress,
    prover: ContractAddress,
) -> ContractAddress {
    let contract = declare("SolvencyProver").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    owner.serialize(ref calldata);
    verifier.serialize(ref calldata);
    prover.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn setup() -> (ContractAddress, ContractAddress, ISolvencyProverDispatcher) {
    let verifier = deploy_mock_verifier(true);
    start_cheat_block_timestamp_global(1000);
    let sp_addr = deploy_solvency_prover(OWNER(), verifier, PROVER());
    let sp = ISolvencyProverDispatcher { contract_address: sp_addr };
    (verifier, sp_addr, sp)
}

// =============================================================================
// Initial state tests
// =============================================================================

#[test]
fn test_initial_state() {
    let (_, _, sp) = setup();

    assert(!sp.is_vault_solvent(), 'vault not solvent initially');
    assert(!sp.is_cdp_safe(), 'cdp not safe initially');
    assert(sp.get_vault_last_verified() == 0, 'no vault verification');
    assert(sp.get_cdp_last_verified() == 0, 'no cdp verification');
    assert(sp.get_vault_assets_commitment() == 0, 'no assets commitment');
    assert(sp.get_vault_liabilities_commitment() == 0, 'no liab commitment');
    assert(sp.get_vault_num_accounts() == 0, 'no accounts');
    assert(sp.get_cdp_collateral_commitment() == 0, 'no col commitment');
    assert(sp.get_cdp_debt_commitment() == 0, 'no debt commitment');
    assert(sp.get_cdp_num_cdps() == 0, 'no cdps');
    assert(sp.get_prover() == PROVER(), 'wrong prover');
    assert(!sp.is_solvency_paused(), 'not paused');
}

// =============================================================================
// Vault solvency proof tests
// =============================================================================

#[test]
fn test_submit_vault_solvency_proof() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets_commit', 'liab_commit', 10, array![].span());
    stop_cheat_caller_address(sp_addr);

    assert(sp.is_vault_solvent(), 'vault should be solvent');
    assert(sp.get_vault_last_verified() == 1000, 'wrong timestamp');
    assert(sp.get_vault_assets_commitment() == 'assets_commit', 'wrong assets commit');
    assert(sp.get_vault_liabilities_commitment() == 'liab_commit', 'wrong liab commit');
    assert(sp.get_vault_num_accounts() == 10, 'wrong num accounts');
}

#[test]
fn test_submit_vault_proof_updates_state() {
    let (_, sp_addr, sp) = setup();

    // First proof at t=1000
    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets_1', 'liab_1', 5, array![].span());
    stop_cheat_caller_address(sp_addr);

    assert(sp.get_vault_last_verified() == 1000, 'first timestamp');

    // Second proof at t=2000
    start_cheat_block_timestamp_global(2000);
    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets_2', 'liab_2', 15, array![].span());
    stop_cheat_caller_address(sp_addr);

    assert(sp.get_vault_last_verified() == 2000, 'updated timestamp');
    assert(sp.get_vault_assets_commitment() == 'assets_2', 'updated assets');
    assert(sp.get_vault_num_accounts() == 15, 'updated accounts');
}

#[test]
#[should_panic(expected: 'unauthorized prover')]
fn test_vault_proof_unauthorized() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, ATTACKER());
    sp.submit_vault_solvency_proof('assets', 'liab', 10, array![].span());
}

#[test]
#[should_panic(expected: 'vault solvency proof failed')]
fn test_vault_proof_invalid() {
    let (verifier, sp_addr, sp) = setup();

    // Toggle verifier to reject
    let verifier_disp = IMockProofVerifierDispatcher { contract_address: verifier };
    verifier_disp.set_should_verify(false);

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets', 'liab', 10, array![].span());
}

#[test]
#[should_panic(expected: 'invalid assets commitment')]
fn test_vault_proof_zero_assets_commitment() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof(0, 'liab', 10, array![].span());
}

#[test]
#[should_panic(expected: 'invalid liab commitment')]
fn test_vault_proof_zero_liab_commitment() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets', 0, 10, array![].span());
}

#[test]
#[should_panic(expected: 'num accounts must be positive')]
fn test_vault_proof_zero_accounts() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets', 'liab', 0, array![].span());
}

// =============================================================================
// CDP safety proof tests
// =============================================================================

#[test]
fn test_submit_cdp_safety_proof() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col_commit', 'debt_commit', 50000, 200, 8, array![].span());
    stop_cheat_caller_address(sp_addr);

    assert(sp.is_cdp_safe(), 'cdp should be safe');
    assert(sp.get_cdp_last_verified() == 1000, 'wrong timestamp');
    assert(sp.get_cdp_collateral_commitment() == 'col_commit', 'wrong col commit');
    assert(sp.get_cdp_debt_commitment() == 'debt_commit', 'wrong debt commit');
    assert(sp.get_cdp_num_cdps() == 8, 'wrong num cdps');
}

#[test]
#[should_panic(expected: 'unauthorized prover')]
fn test_cdp_proof_unauthorized() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, ATTACKER());
    sp.submit_cdp_safety_proof('col', 'debt', 50000, 200, 5, array![].span());
}

#[test]
#[should_panic(expected: 'cdp safety proof failed')]
fn test_cdp_proof_invalid() {
    let (verifier, sp_addr, sp) = setup();

    let verifier_disp = IMockProofVerifierDispatcher { contract_address: verifier };
    verifier_disp.set_should_verify(false);

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col', 'debt', 50000, 200, 5, array![].span());
}

#[test]
#[should_panic(expected: 'invalid collateral commitment')]
fn test_cdp_proof_zero_collateral() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof(0, 'debt', 50000, 200, 5, array![].span());
}

#[test]
#[should_panic(expected: 'invalid debt commitment')]
fn test_cdp_proof_zero_debt() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col', 0, 50000, 200, 5, array![].span());
}

#[test]
#[should_panic(expected: 'price must be positive')]
fn test_cdp_proof_zero_price() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col', 'debt', 0, 200, 5, array![].span());
}

#[test]
#[should_panic(expected: 'ratio must be positive')]
fn test_cdp_proof_zero_ratio() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col', 'debt', 50000, 0, 5, array![].span());
}

#[test]
#[should_panic(expected: 'num cdps must be positive')]
fn test_cdp_proof_zero_cdps() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col', 'debt', 50000, 200, 0, array![].span());
}

// =============================================================================
// Domain independence tests (per-domain solvency)
// =============================================================================

#[test]
fn test_domains_are_independent() {
    let (_, sp_addr, sp) = setup();

    // Submit vault proof only
    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets', 'liab', 10, array![].span());
    stop_cheat_caller_address(sp_addr);

    assert(sp.is_vault_solvent(), 'vault should be solvent');
    assert(!sp.is_cdp_safe(), 'cdp should still be unverified');

    // Submit CDP proof only
    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col', 'debt', 50000, 200, 5, array![].span());
    stop_cheat_caller_address(sp_addr);

    assert(sp.is_vault_solvent(), 'vault still solvent');
    assert(sp.is_cdp_safe(), 'cdp now safe');
}

// =============================================================================
// Prover management tests
// =============================================================================

#[test]
fn test_set_prover() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, OWNER());
    sp.set_prover(PROVER2());
    stop_cheat_caller_address(sp_addr);

    assert(sp.get_prover() == PROVER2(), 'prover should be updated');
}

#[test]
fn test_new_prover_can_submit() {
    let (_, sp_addr, sp) = setup();

    // Rotate prover
    start_cheat_caller_address(sp_addr, OWNER());
    sp.set_prover(PROVER2());
    stop_cheat_caller_address(sp_addr);

    // New prover submits
    start_cheat_caller_address(sp_addr, PROVER2());
    sp.submit_vault_solvency_proof('assets', 'liab', 5, array![].span());
    stop_cheat_caller_address(sp_addr);

    assert(sp.is_vault_solvent(), 'new prover should work');
}

#[test]
#[should_panic(expected: 'unauthorized prover')]
fn test_old_prover_rejected_after_rotation() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, OWNER());
    sp.set_prover(PROVER2());
    stop_cheat_caller_address(sp_addr);

    // Old prover tries to submit
    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets', 'liab', 5, array![].span());
}

#[test]
#[should_panic(expected: 'only owner')]
fn test_set_prover_non_owner() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, ATTACKER());
    sp.set_prover(ATTACKER());
}

// =============================================================================
// Pause tests
// =============================================================================

#[test]
fn test_pause_unpause() {
    let (_, sp_addr, sp) = setup();

    assert(!sp.is_solvency_paused(), 'should start unpaused');

    start_cheat_caller_address(sp_addr, OWNER());
    sp.pause();
    stop_cheat_caller_address(sp_addr);
    assert(sp.is_solvency_paused(), 'should be paused');

    start_cheat_caller_address(sp_addr, OWNER());
    sp.unpause();
    stop_cheat_caller_address(sp_addr);
    assert(!sp.is_solvency_paused(), 'should be unpaused');
}

#[test]
#[should_panic(expected: 'solvency prover paused')]
fn test_vault_proof_when_paused() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, OWNER());
    sp.pause();
    stop_cheat_caller_address(sp_addr);

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_vault_solvency_proof('assets', 'liab', 10, array![].span());
}

#[test]
#[should_panic(expected: 'solvency prover paused')]
fn test_cdp_proof_when_paused() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, OWNER());
    sp.pause();
    stop_cheat_caller_address(sp_addr);

    start_cheat_caller_address(sp_addr, PROVER());
    sp.submit_cdp_safety_proof('col', 'debt', 50000, 200, 5, array![].span());
}

#[test]
#[should_panic(expected: 'only owner')]
fn test_pause_non_owner() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, ATTACKER());
    sp.pause();
}

// =============================================================================
// Full flow: both domains verified
// =============================================================================

#[test]
fn test_full_solvency_flow() {
    let (_, sp_addr, sp) = setup();

    start_cheat_caller_address(sp_addr, PROVER());

    // 1. Submit vault solvency proof
    sp.submit_vault_solvency_proof('v_assets', 'v_liab', 100, array![].span());
    assert(sp.is_vault_solvent(), 'step1: vault solvent');
    assert(sp.get_vault_last_verified() == 1000, 'step1: timestamp');

    // 2. Submit CDP safety proof
    sp.submit_cdp_safety_proof('c_col', 'c_debt', 50000, 200, 25, array![].span());
    assert(sp.is_cdp_safe(), 'step2: cdp safe');
    assert(sp.get_cdp_last_verified() == 1000, 'step2: timestamp');

    // 3. Both domains verified
    assert(sp.is_vault_solvent() && sp.is_cdp_safe(), 'both verified');

    // 4. Submit updated vault proof at later time
    start_cheat_block_timestamp_global(5000);
    sp.submit_vault_solvency_proof('v_assets_2', 'v_liab_2', 120, array![].span());
    assert(sp.get_vault_last_verified() == 5000, 'step4: updated');
    assert(sp.get_vault_num_accounts() == 120, 'step4: accounts');

    stop_cheat_caller_address(sp_addr);
}
