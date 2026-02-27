// Obscura v1.5 -- collateral_ratio circuit
//
// Proves that a CDP's collateral ratio meets the minimum requirement (MIN_CR).
// Used during CDP operations (mint sUSD, repay) to ensure health.
//
// Invariant: collateral_amount * price * 100 >= debt_amount * min_ratio_percent
//   where min_ratio_percent = 200 means 200% collateralization.
//
// Public inputs:
//   - collateral_commitment: pedersen_hash([collateral, collateral_blinding])
//   - debt_commitment: pedersen_hash([debt, debt_blinding])
//   - price: collateral price in debt denomination (scaled by 10^price_decimals)
//   - price_decimals: scaling factor for price (e.g., 8 means price has 8 decimal places)
//   - min_ratio_percent: minimum collateral ratio as percentage (e.g., 200)
//
// Private inputs (witnesses):
//   - collateral: plaintext collateral amount
//   - debt: plaintext debt amount
//   - collateral_blinding, debt_blinding: commitment randomness

use std::hash::pedersen_hash;

fn main(
    // Private witnesses
    collateral: u64,
    debt: u64,
    collateral_blinding: Field,
    debt_blinding: Field,
    // Public inputs
    collateral_commitment: pub Field,
    debt_commitment: pub Field,
    price: pub u64,
    min_ratio_percent: pub u64,
) {
    // 1. Verify commitments
    let cc = pedersen_hash([collateral as Field, collateral_blinding]);
    assert(cc == collateral_commitment, "collateral commitment mismatch");

    let dc = pedersen_hash([debt as Field, debt_blinding]);
    assert(dc == debt_commitment, "debt commitment mismatch");

    // 2. Prove collateral ratio >= min_ratio
    //    collateral * price * 100 >= debt * min_ratio_percent
    //
    //    Using Field arithmetic to avoid u64 overflow.
    //    Safe because max product ~= 10^18 * 10^18 * 100 = 10^38 << BN254 modulus ~= 10^76
    let lhs = (collateral as Field) * (price as Field) * 100;
    let rhs = (debt as Field) * (min_ratio_percent as Field);

    // Prove lhs >= rhs: assert NOT (lhs < rhs)
    assert(
        std::field::bn254::lt(lhs, rhs) == false,
        "collateral ratio below minimum",
    );
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_healthy_cdp() {
    // 1000 collateral * 50000 price * 100 = 5_000_000_000
    // 2000 debt * 200 ratio = 400_000
    // 5_000_000_000 >= 400_000 OK
    let collateral: u64 = 1000;
    let debt: u64 = 2000;
    let price: u64 = 50000;
    let min_ratio: u64 = 200;
    let cb: Field = 111;
    let db: Field = 222;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, min_ratio);
}

#[test]
fn test_exact_minimum_ratio() {
    // collateral=200, debt=100, price=1, ratio=200
    // 200 * 1 * 100 = 20000 >= 100 * 200 = 20000 OK (exactly at boundary)
    let collateral: u64 = 200;
    let debt: u64 = 100;
    let price: u64 = 1;
    let min_ratio: u64 = 200;
    let cb: Field = 10;
    let db: Field = 20;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, min_ratio);
}

#[test(should_fail)]
fn test_undercollateralized() {
    // collateral=100, debt=100, price=1, ratio=200
    // 100 * 1 * 100 = 10000 < 100 * 200 = 20000 FAIL
    let collateral: u64 = 100;
    let debt: u64 = 100;
    let price: u64 = 1;
    let min_ratio: u64 = 200;
    let cb: Field = 10;
    let db: Field = 20;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, min_ratio);
}

#[test]
fn test_zero_debt() {
    // Zero debt is always healthy (no division by zero issue with our formulation)
    let collateral: u64 = 1000;
    let debt: u64 = 0;
    let price: u64 = 50000;
    let min_ratio: u64 = 200;
    let cb: Field = 10;
    let db: Field = 20;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, min_ratio);
}

#[test]
fn test_large_values() {
    // 18-decimal token amounts
    let collateral: u64 = 1000000000000000000; // 1e18
    let debt: u64 = 100000000000000000; // 1e17
    let price: u64 = 100000000; // 1e8
    let min_ratio: u64 = 200;
    let cb: Field = 42;
    let db: Field = 43;

    let cc = pedersen_hash([collateral as Field, cb]);
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, cc, dc, price, min_ratio);
}

#[test(should_fail_with = "collateral commitment mismatch")]
fn test_tampered_collateral() {
    let collateral: u64 = 1000;
    let debt: u64 = 100;
    let cb: Field = 10;
    let db: Field = 20;

    let fake_cc = pedersen_hash([9999, cb]); // wrong collateral
    let dc = pedersen_hash([debt as Field, db]);

    main(collateral, debt, cb, db, fake_cc, dc, 50000, 200);
}
