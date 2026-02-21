// StarkShield v1.5 -- vault_solvency circuit
//
// Proves that the ShieldedVault is solvent: total assets >= total liabilities.
// This is a per-domain solvency proof (vault domain only, no cross-domain coupling).
//
// Assets = total deposited collateral (xyBTC/sxyBTC held in vault)
// Liabilities = total claims by depositors (outstanding shares value)
//
// Public inputs:
//   - assets_commitment: pedersen_hash([total_assets, assets_blinding])
//   - liabilities_commitment: pedersen_hash([total_liabilities, liabilities_blinding])
//   - num_accounts: number of accounts included in solvency proof
//
// Private inputs (witnesses):
//   - total_assets: sum of all vault reserves
//   - total_liabilities: sum of all depositor claims
//   - assets_blinding, liabilities_blinding: commitment randomness

use std::hash::pedersen_hash;

fn main(
    // Private witnesses
    total_assets: u64,
    total_liabilities: u64,
    assets_blinding: Field,
    liabilities_blinding: Field,
    // Public inputs
    assets_commitment: pub Field,
    liabilities_commitment: pub Field,
    num_accounts: pub u32,
) {
    // 1. Verify commitments
    let ac = pedersen_hash([total_assets as Field, assets_blinding]);
    assert(ac == assets_commitment, "assets commitment mismatch");

    let lc = pedersen_hash([total_liabilities as Field, liabilities_blinding]);
    assert(lc == liabilities_commitment, "liabilities commitment mismatch");

    // 2. Prove the vault is solvent: assets >= liabilities
    assert(total_assets >= total_liabilities, "vault is insolvent");

    // 3. Sanity: at least one account must be included
    assert(num_accounts > 0, "no accounts in solvency proof");
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_solvent_vault() {
    let assets: u64 = 100000;
    let liabilities: u64 = 80000;
    let ab: Field = 111;
    let lb: Field = 222;

    let ac = pedersen_hash([assets as Field, ab]);
    let lc = pedersen_hash([liabilities as Field, lb]);

    main(assets, liabilities, ab, lb, ac, lc, 10);
}

#[test]
fn test_exact_solvency() {
    // Assets exactly equal liabilities (solvent but no surplus)
    let assets: u64 = 50000;
    let liabilities: u64 = 50000;
    let ab: Field = 1;
    let lb: Field = 2;

    let ac = pedersen_hash([assets as Field, ab]);
    let lc = pedersen_hash([liabilities as Field, lb]);

    main(assets, liabilities, ab, lb, ac, lc, 5);
}

#[test]
fn test_zero_liabilities() {
    let assets: u64 = 100000;
    let liabilities: u64 = 0;
    let ab: Field = 10;
    let lb: Field = 20;

    let ac = pedersen_hash([assets as Field, ab]);
    let lc = pedersen_hash([liabilities as Field, lb]);

    main(assets, liabilities, ab, lb, ac, lc, 1);
}

#[test]
fn test_large_vault() {
    let assets: u64 = 1000000000000000000; // 1e18
    let liabilities: u64 = 500000000000000000; // 5e17
    let ab: Field = 42;
    let lb: Field = 43;

    let ac = pedersen_hash([assets as Field, ab]);
    let lc = pedersen_hash([liabilities as Field, lb]);

    main(assets, liabilities, ab, lb, ac, lc, 1000);
}

#[test(should_fail_with = "vault is insolvent")]
fn test_insolvent_vault() {
    let assets: u64 = 80000;
    let liabilities: u64 = 100000;
    let ab: Field = 1;
    let lb: Field = 2;

    let ac = pedersen_hash([assets as Field, ab]);
    let lc = pedersen_hash([liabilities as Field, lb]);

    main(assets, liabilities, ab, lb, ac, lc, 10);
}

#[test(should_fail_with = "no accounts in solvency proof")]
fn test_zero_accounts() {
    let assets: u64 = 100000;
    let liabilities: u64 = 80000;
    let ab: Field = 1;
    let lb: Field = 2;

    let ac = pedersen_hash([assets as Field, ab]);
    let lc = pedersen_hash([liabilities as Field, lb]);

    main(assets, liabilities, ab, lb, ac, lc, 0);
}

#[test(should_fail_with = "assets commitment mismatch")]
fn test_tampered_assets() {
    let assets: u64 = 100000;
    let liabilities: u64 = 80000;
    let ab: Field = 1;
    let lb: Field = 2;

    let fake_ac = pedersen_hash([999999, ab]); // wrong assets
    let lc = pedersen_hash([liabilities as Field, lb]);

    main(assets, liabilities, ab, lb, fake_ac, lc, 10);
}
