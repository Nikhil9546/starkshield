// Obscura v1.5 -- debt_update_validity circuit
//
// Proves that a debt state transition is valid:
//   - Borrow: new_debt = old_debt + delta
//   - Repay:  new_debt = old_debt - delta (with old_debt >= delta)
//
// Public inputs:
//   - old_debt_commitment: pedersen_hash([old_debt, old_blinding])
//   - new_debt_commitment: pedersen_hash([new_debt, new_blinding])
//   - delta_commitment: pedersen_hash([delta, delta_blinding])
//   - is_repayment: 1 if repaying, 0 if borrowing
//
// Private inputs (witnesses):
//   - old_debt, new_debt, delta: plaintext values
//   - old_blinding, new_blinding, delta_blinding: commitment randomness

use std::hash::pedersen_hash;

fn main(
    // Private witnesses
    old_debt: u64,
    new_debt: u64,
    delta: u64,
    old_blinding: Field,
    new_blinding: Field,
    delta_blinding: Field,
    // Public inputs
    old_debt_commitment: pub Field,
    new_debt_commitment: pub Field,
    delta_commitment: pub Field,
    is_repayment: pub bool,
) {
    // 1. Verify all commitments
    let odc = pedersen_hash([old_debt as Field, old_blinding]);
    assert(odc == old_debt_commitment, "old debt commitment mismatch");

    let ndc = pedersen_hash([new_debt as Field, new_blinding]);
    assert(ndc == new_debt_commitment, "new debt commitment mismatch");

    let dc = pedersen_hash([delta as Field, delta_blinding]);
    assert(dc == delta_commitment, "delta commitment mismatch");

    // 2. Validate the state transition
    if is_repayment {
        // Repayment: new_debt = old_debt - delta
        assert(old_debt >= delta, "repayment exceeds debt");
        assert(new_debt == old_debt - delta, "invalid repayment update");
    } else {
        // Borrow: new_debt = old_debt + delta
        assert(new_debt == old_debt + delta, "invalid borrow update");
    }
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_valid_borrow() {
    let old_debt: u64 = 1000;
    let delta: u64 = 500;
    let new_debt: u64 = 1500;
    let ob: Field = 11;
    let nb: Field = 22;
    let db: Field = 33;

    let odc = pedersen_hash([old_debt as Field, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, odc, ndc, dc, false);
}

#[test]
fn test_borrow_from_zero() {
    let old_debt: u64 = 0;
    let delta: u64 = 10000;
    let new_debt: u64 = 10000;
    let ob: Field = 1;
    let nb: Field = 2;
    let db: Field = 3;

    let odc = pedersen_hash([old_debt as Field, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, odc, ndc, dc, false);
}

#[test]
fn test_valid_repayment() {
    let old_debt: u64 = 5000;
    let delta: u64 = 2000;
    let new_debt: u64 = 3000;
    let ob: Field = 11;
    let nb: Field = 22;
    let db: Field = 33;

    let odc = pedersen_hash([old_debt as Field, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, odc, ndc, dc, true);
}

#[test]
fn test_full_repayment() {
    let old_debt: u64 = 5000;
    let delta: u64 = 5000;
    let new_debt: u64 = 0;
    let ob: Field = 1;
    let nb: Field = 2;
    let db: Field = 3;

    let odc = pedersen_hash([old_debt as Field, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, odc, ndc, dc, true);
}

#[test(should_fail_with = "repayment exceeds debt")]
fn test_repay_more_than_owed() {
    let old_debt: u64 = 1000;
    let delta: u64 = 2000;
    let new_debt: u64 = 0;
    let ob: Field = 1;
    let nb: Field = 2;
    let db: Field = 3;

    let odc = pedersen_hash([old_debt as Field, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, odc, ndc, dc, true);
}

#[test(should_fail_with = "invalid borrow update")]
fn test_wrong_borrow_amount() {
    let old_debt: u64 = 1000;
    let delta: u64 = 500;
    let new_debt: u64 = 2000; // wrong: should be 1500
    let ob: Field = 1;
    let nb: Field = 2;
    let db: Field = 3;

    let odc = pedersen_hash([old_debt as Field, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, odc, ndc, dc, false);
}

#[test(should_fail_with = "invalid repayment update")]
fn test_wrong_repay_amount() {
    let old_debt: u64 = 5000;
    let delta: u64 = 2000;
    let new_debt: u64 = 2000; // wrong: should be 3000
    let ob: Field = 1;
    let nb: Field = 2;
    let db: Field = 3;

    let odc = pedersen_hash([old_debt as Field, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, odc, ndc, dc, true);
}

#[test(should_fail_with = "old debt commitment mismatch")]
fn test_tampered_old_debt() {
    let old_debt: u64 = 5000;
    let delta: u64 = 2000;
    let new_debt: u64 = 3000;
    let ob: Field = 1;
    let nb: Field = 2;
    let db: Field = 3;

    let fake_odc = pedersen_hash([9999, ob]);
    let ndc = pedersen_hash([new_debt as Field, nb]);
    let dc = pedersen_hash([delta as Field, db]);

    main(old_debt, new_debt, delta, ob, nb, db, fake_odc, ndc, dc, true);
}
