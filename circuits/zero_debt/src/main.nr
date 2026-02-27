// Obscura v1.5 -- zero_debt circuit
//
// Proves that a CDP's debt is exactly zero, which is required
// before a position can be closed.
//
// Security invariant: Position can only close with zero_debt proof.
//
// Public inputs:
//   - debt_commitment: pedersen_hash([debt, blinding])
//
// Private inputs (witnesses):
//   - debt: plaintext debt value (must be 0)
//   - blinding: commitment randomness

use std::hash::pedersen_hash;

fn main(
    // Private witnesses
    debt: u64,
    blinding: Field,
    // Public inputs
    debt_commitment: pub Field,
) {
    // 1. Verify the commitment
    let computed = pedersen_hash([debt as Field, blinding]);
    assert(computed == debt_commitment, "debt commitment mismatch");

    // 2. Prove debt is exactly zero
    assert(debt == 0, "debt is not zero");
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_zero_debt() {
    let debt: u64 = 0;
    let blinding: Field = 12345;
    let commitment = pedersen_hash([debt as Field, blinding]);

    main(debt, blinding, commitment);
}

#[test]
fn test_zero_debt_different_blinding() {
    let debt: u64 = 0;
    let blinding: Field = 99999;
    let commitment = pedersen_hash([debt as Field, blinding]);

    main(debt, blinding, commitment);
}

#[test(should_fail_with = "debt is not zero")]
fn test_nonzero_debt() {
    let debt: u64 = 1;
    let blinding: Field = 12345;
    let commitment = pedersen_hash([debt as Field, blinding]);

    main(debt, blinding, commitment);
}

#[test(should_fail_with = "debt is not zero")]
fn test_large_debt() {
    let debt: u64 = 1000000;
    let blinding: Field = 42;
    let commitment = pedersen_hash([debt as Field, blinding]);

    main(debt, blinding, commitment);
}

#[test(should_fail_with = "debt commitment mismatch")]
fn test_wrong_commitment() {
    let debt: u64 = 0;
    let blinding: Field = 12345;
    let wrong_commitment = pedersen_hash([1, blinding]); // committed to 1, not 0

    main(debt, blinding, wrong_commitment);
}
