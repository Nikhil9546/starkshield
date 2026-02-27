// Obscura v1.5 -- range_proof circuit
//
// Proves that a private value lies within [0, max_value]
// and is correctly bound to the given Pedersen commitment.
//
// Public inputs:
//   - commitment: pedersen_hash([value, blinding])
//   - max_value: upper bound (inclusive)
//
// Private inputs (witnesses):
//   - value: the plaintext amount
//   - blinding: randomness used in the commitment

use std::hash::pedersen_hash;

fn main(
    // Private witnesses
    value: u64,
    blinding: Field,
    // Public inputs
    commitment: pub Field,
    max_value: pub u64,
) {
    // 1. Verify the commitment binds to this value
    let computed = pedersen_hash([value as Field, blinding]);
    assert(computed == commitment, "commitment mismatch");

    // 2. Prove value is in range [0, max_value]
    // u64 type guarantees value >= 0 at the constraint level
    assert(value <= max_value, "value out of range");
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_valid_range() {
    let value: u64 = 1000;
    let blinding: Field = 12345;
    let commitment = pedersen_hash([value as Field, blinding]);
    main(value, blinding, commitment, 10000);
}

#[test]
fn test_zero_value() {
    let value: u64 = 0;
    let blinding: Field = 99999;
    let commitment = pedersen_hash([value as Field, blinding]);
    main(value, blinding, commitment, 10000);
}

#[test]
fn test_at_max_boundary() {
    let value: u64 = 10000;
    let blinding: Field = 42;
    let commitment = pedersen_hash([value as Field, blinding]);
    main(value, blinding, commitment, 10000);
}

#[test(should_fail_with = "value out of range")]
fn test_exceeds_max() {
    let value: u64 = 10001;
    let blinding: Field = 42;
    let commitment = pedersen_hash([value as Field, blinding]);
    main(value, blinding, commitment, 10000);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_commitment() {
    let value: u64 = 1000;
    let blinding: Field = 12345;
    let wrong_commitment = pedersen_hash([999, blinding]);
    main(value, blinding, wrong_commitment, 10000);
}

#[test]
fn test_large_value() {
    let value: u64 = 1000000000000000000; // 1e18 (18 decimals)
    let blinding: Field = 777;
    let commitment = pedersen_hash([value as Field, blinding]);
    main(value, blinding, commitment, 18446744073709551615); // u64::MAX
}
