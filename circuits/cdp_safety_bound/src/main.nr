// StarkShield v1.5 -- cdp_safety_bound circuit
//
// Proves the CDP domain aggregate safety bound: total collateral value
// across all CDPs is sufficient to cover total debt with a safety margin.
// This is the CDP-domain solvency proof (separate from vault_solvency).
//
// Invariant: total_collateral * price * 100 >= total_debt * safety_ratio_percent
//
// Public inputs:
//   - collateral_commitment: pedersen_hash([total_collateral, collateral_blinding])
//   - debt_commitment: pedersen_hash([total_debt, debt_blinding])
//   - price: collateral price in debt denomination
//   - safety_ratio_percent: safety bound as percentage (e.g., 150 for 150%)
//   - num_cdps: number of CDPs included in the safety proof
//
// Private inputs (witnesses):
//   - total_collateral: aggregate collateral across all CDPs
//   - total_debt: aggregate debt across all CDPs
//   - collateral_blinding, debt_blinding: commitment randomness

use std::hash::pedersen_hash;

fn main(
    // Private witnesses
    total_collateral: u64,
    total_debt: u64,
    collateral_blinding: Field,
    debt_blinding: Field,
    // Public inputs
    collateral_commitment: pub Field,
    debt_commitment: pub Field,
    price: pub u64,
    safety_ratio_percent: pub u64,
    num_cdps: pub u32,
) {
    // 1. Verify commitments
    let cc = pedersen_hash([total_collateral as Field, collateral_blinding]);
    assert(cc == collateral_commitment, "collateral commitment mismatch");

    let dc = pedersen_hash([total_debt as Field, debt_blinding]);
    assert(dc == debt_commitment, "debt commitment mismatch");

    // 2. Prove aggregate safety bound
    //    total_collateral * price * 100 >= total_debt * safety_ratio_percent
    //
    //    Field arithmetic avoids overflow (products << BN254 modulus)
    let lhs = (total_collateral as Field) * (price as Field) * 100;
    let rhs = (total_debt as Field) * (safety_ratio_percent as Field);

    // Prove lhs >= rhs: assert NOT (lhs < rhs)
    assert(
        std::field::bn254::lt(lhs, rhs) == false,
        "safety bound not met",
    );

    // 3. Sanity: at least one CDP in the proof
    assert(num_cdps > 0, "no CDPs in safety proof");
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_safe_cdp_pool() {
    // 10000 collateral * 50000 price * 100 = 50_000_000_000
    // 5000 debt * 200 ratio = 1_000_000
    let collateral: u64 = 10000;
    let debt: u64 = 5000;
    let price: u64 = 50000;
    let ratio: u64 = 200;
    let cb: Field = 111;
    let db: Field = 222;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, ratio, 5);
}

#[test]
fn test_exact_safety_bound() {
    // 200 collateral * 1 price * 100 = 20000
    // 100 debt * 200 ratio = 20000 (exactly at boundary)
    let collateral: u64 = 200;
    let debt: u64 = 100;
    let price: u64 = 1;
    let ratio: u64 = 200;
    let cb: Field = 10;
    let db: Field = 20;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, ratio, 1);
}

#[test]
fn test_zero_aggregate_debt() {
    let collateral: u64 = 100000;
    let debt: u64 = 0;
    let price: u64 = 50000;
    let ratio: u64 = 200;
    let cb: Field = 1;
    let db: Field = 2;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, ratio, 3);
}

#[test]
fn test_large_cdp_pool() {
    let collateral: u64 = 1000000000000000000; // 1e18
    let debt: u64 = 100000000000000000; // 1e17
    let price: u64 = 100000000; // 1e8
    let ratio: u64 = 150;
    let cb: Field = 42;
    let db: Field = 43;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, ratio, 100);
}

#[test(should_fail)]
fn test_unsafe_cdp_pool() {
    // 100 collateral * 1 price * 100 = 10000
    // 100 debt * 200 ratio = 20000
    // 10000 < 20000 -> unsafe
    let collateral: u64 = 100;
    let debt: u64 = 100;
    let price: u64 = 1;
    let ratio: u64 = 200;
    let cb: Field = 10;
    let db: Field = 20;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, ratio, 5);
}

#[test(should_fail_with = "no CDPs in safety proof")]
fn test_zero_cdps() {
    let collateral: u64 = 10000;
    let debt: u64 = 5000;
    let cb: Field = 1;
    let db: Field = 2;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, 50000, 200, 0);
}

#[test(should_fail_with = "collateral commitment mismatch")]
fn test_tampered_collateral() {
    let collateral: u64 = 10000;
    let debt: u64 = 5000;
    let cb: Field = 1;
    let db: Field = 2;

    let fake_cc = pedersen_hash([99999, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, fake_cc, dc, 50000, 200, 5);
}
