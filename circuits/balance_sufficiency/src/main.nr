// Obscura v1.5 -- balance_sufficiency circuit
//
// Proves that an encrypted balance is sufficient to cover a transfer amount,
// and that the new balance is correctly computed as balance - amount.
//
// Security invariant: Encrypted balance NEVER underflows.
//
// Public inputs:
//   - balance_commitment: pedersen_hash([balance, balance_blinding])
//   - amount_commitment: pedersen_hash([amount, amount_blinding])
//   - new_balance_commitment: pedersen_hash([new_balance, new_balance_blinding])
//
// Private inputs (witnesses):
//   - balance: current plaintext balance
//   - amount: transfer/withdrawal amount
//   - new_balance: resulting balance (= balance - amount)
//   - balance_blinding, amount_blinding, new_balance_blinding: commitment randomness

use std::hash::pedersen_hash;

fn main(
    // Private witnesses
    balance: u64,
    amount: u64,
    new_balance: u64,
    balance_blinding: Field,
    amount_blinding: Field,
    new_balance_blinding: Field,
    // Public inputs
    balance_commitment: pub Field,
    amount_commitment: pub Field,
    new_balance_commitment: pub Field,
) {
    // 1. Verify all three commitments
    let computed_bc = pedersen_hash([balance as Field, balance_blinding]);
    assert(computed_bc == balance_commitment, "balance commitment mismatch");

    let computed_ac = pedersen_hash([amount as Field, amount_blinding]);
    assert(computed_ac == amount_commitment, "amount commitment mismatch");

    let computed_nbc = pedersen_hash([new_balance as Field, new_balance_blinding]);
    assert(computed_nbc == new_balance_commitment, "new balance commitment mismatch");

    // 2. Prove balance >= amount (no underflow)
    assert(balance >= amount, "insufficient balance");

    // 3. Prove the balance transition is correct
    assert(new_balance == balance - amount, "invalid balance update");
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_valid_transfer() {
    let balance: u64 = 10000;
    let amount: u64 = 3000;
    let new_balance: u64 = 7000;
    let bb: Field = 111;
    let ab: Field = 222;
    let nbb: Field = 333;

    let bc = pedersen_hash([balance as Field, bb]);
    let ac = pedersen_hash([amount as Field, ab]);
    let nbc = pedersen_hash([new_balance as Field, nbb]);

    main(balance, amount, new_balance, bb, ab, nbb, bc, ac, nbc);
}

#[test]
fn test_full_withdrawal() {
    let balance: u64 = 5000;
    let amount: u64 = 5000;
    let new_balance: u64 = 0;
    let bb: Field = 1;
    let ab: Field = 2;
    let nbb: Field = 3;

    let bc = pedersen_hash([balance as Field, bb]);
    let ac = pedersen_hash([amount as Field, ab]);
    let nbc = pedersen_hash([new_balance as Field, nbb]);

    main(balance, amount, new_balance, bb, ab, nbb, bc, ac, nbc);
}

#[test]
fn test_small_transfer() {
    let balance: u64 = 1000000000000000000; // 1e18
    let amount: u64 = 1;
    let new_balance: u64 = 999999999999999999;
    let bb: Field = 10;
    let ab: Field = 20;
    let nbb: Field = 30;

    let bc = pedersen_hash([balance as Field, bb]);
    let ac = pedersen_hash([amount as Field, ab]);
    let nbc = pedersen_hash([new_balance as Field, nbb]);

    main(balance, amount, new_balance, bb, ab, nbb, bc, ac, nbc);
}

#[test(should_fail_with = "insufficient balance")]
fn test_insufficient_balance() {
    let balance: u64 = 1000;
    let amount: u64 = 2000;
    let new_balance: u64 = 0;
    let bb: Field = 1;
    let ab: Field = 2;
    let nbb: Field = 3;

    let bc = pedersen_hash([balance as Field, bb]);
    let ac = pedersen_hash([amount as Field, ab]);
    let nbc = pedersen_hash([new_balance as Field, nbb]);

    main(balance, amount, new_balance, bb, ab, nbb, bc, ac, nbc);
}

#[test(should_fail_with = "invalid balance update")]
fn test_wrong_new_balance() {
    let balance: u64 = 10000;
    let amount: u64 = 3000;
    let new_balance: u64 = 8000; // wrong: should be 7000
    let bb: Field = 1;
    let ab: Field = 2;
    let nbb: Field = 3;

    let bc = pedersen_hash([balance as Field, bb]);
    let ac = pedersen_hash([amount as Field, ab]);
    let nbc = pedersen_hash([new_balance as Field, nbb]);

    main(balance, amount, new_balance, bb, ab, nbb, bc, ac, nbc);
}

#[test(should_fail_with = "balance commitment mismatch")]
fn test_tampered_balance_commitment() {
    let balance: u64 = 10000;
    let amount: u64 = 3000;
    let new_balance: u64 = 7000;
    let bb: Field = 1;
    let ab: Field = 2;
    let nbb: Field = 3;

    let fake_bc = pedersen_hash([9999, bb]); // wrong balance in commitment
    let ac = pedersen_hash([amount as Field, ab]);
    let nbc = pedersen_hash([new_balance as Field, nbb]);

    main(balance, amount, new_balance, bb, ab, nbb, fake_bc, ac, nbc);
}
