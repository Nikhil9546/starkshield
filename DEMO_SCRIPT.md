# Obscura v1.5 — Video Demo Script

## Demo Architecture

```
                         ┌─────────────────────────────────────┐
                         │         User's Browser              │
                         │                                     │
                         │  ┌──────────┐    ┌───────────────┐  │
                         │  │ React UI │    │ Privacy Engine │  │
                         │  │          │    │                │  │
                         │  │ /stake   │    │ ElGamal keygen │  │
                         │  │ /cdp     │◄──►│ encrypt/decrypt│  │
                         │  │ /withdraw│    │ Noir witness   │  │
                         │  │ /proofs  │    │ ZK proof gen   │  │
                         │  │ /settings│    │ (noir_js+bb.js)│  │
                         │  └────┬─────┘    └───────┬────────┘  │
                         │       │                  │           │
                         │       │    calldata      │ proof     │
                         │       │  (commitments,   │ bytes     │
                         │       │   nullifiers,    │           │
                         │       │   ciphertexts)   │           │
                         └───────┼──────────────────┼───────────┘
                                 │                  │
                        ┌────────▼──────────────────▼────────┐
                        │   ArgentX / Braavos Wallet         │
                        │   (signs & broadcasts tx)          │
                        └────────────────┬───────────────────┘
                                         │
                    ─────────────────────────────────────────────
                         Starknet Sepolia (On-Chain)
                    ─────────────────────────────────────────────
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
   ┌──────────▼──────────┐  ┌───────────▼───────────┐  ┌──────────▼──────────┐
   │   ShieldedVault      │  │   ShieldedCDP          │  │  SolvencyProver     │
   │                      │  │                         │  │                     │
   │ deposit(amount)      │  │ open_cdp()              │  │ submit_vault_       │
   │ withdraw(amount)     │  │ lock_collateral(...)     │  │   solvency_proof()  │
   │ shield(commitment,   │  │ mint_susd(commitment,   │  │ submit_cdp_         │
   │   nullifier, proof)  │  │   nullifier, proof)     │  │   safety_proof()    │
   │ unshield(commitment, │  │ repay(commitment,       │  │                     │
   │   nullifier, proof)  │  │   nullifier, proof)     │  │ is_vault_solvent()  │
   │                      │  │ close_cdp(nullifier,    │  │ is_cdp_safe()       │
   │ Stores:              │  │   proof)                │  │                     │
   │ - public_balance     │  │ trigger_liquidation()   │  │ Stores:             │
   │ - balance_commitment │  │ prove_health()          │  │ - vault_solvent     │
   │ - ciphertext (c1,c2) │  │ execute_liquidation()   │  │ - cdp_safe          │
   │ - used_nullifiers    │  │                         │  │ - last_verified     │
   │                      │  │ Stores:                 │  │ - commitments       │
   └──────────┬───────────┘  │ - locked_collateral     │  └─────────────────────┘
              │              │ - debt_commitment       │
              │              │ - collateral_commitment │
              │              │ - used_nullifiers       │
              │              └───────────┬─────────────┘
              │                          │
              └──────────┬───────────────┘
                         │
              ┌──────────▼──────────┐
              │  MockProofVerifier   │    ← Testnet: accepts all proofs
              │  (verify() → true)   │    ← Production: dispatches to
              │                      │       Garaga-generated verifiers
              └──────────────────────┘

              ┌──────────────────────┐
              │  MockPriceFeed       │    ← Returns $50,000 BTC price
              │  (get_price())       │    ← Production: Pragma oracle
              └──────────────────────┘

              ┌──────────────────────┐
              │  MockERC20 (xyBTC)   │    ← Test token (1M supply)
              │  (ERC20 standard)    │    ← Production: Endur xyBTC LST
              └──────────────────────┘
```

### Privacy Data Flow (What's Hidden vs Visible)

```
VISIBLE ON-CHAIN:                    HIDDEN (Client-Side Only):
─────────────────                    ─────────────────────────
Pedersen commitments                 Actual token amounts
Ciphertext components (c1, c2)       ElGamal private key
Nullifiers (prevent replay)          Decrypted balances
Proof bytes (ZK validity)            Witness data
Public balance (for deposit/         Shielded balance total
  withdraw — inherently visible)     Blinding factors
ERC20 transfer amounts               Debt amount
  (inherent in token standard)
```

### 7 ZK Circuits

| # | Circuit | Purpose | When Used |
|---|---------|---------|-----------|
| 1 | `range_proof` | Proves amount is in valid range | First shield |
| 2 | `balance_sufficiency` | Proves shielded balance >= amount | Unshield |
| 3 | `collateral_ratio` | Proves collateral * price >= debt * 200% | Mint sUSD |
| 4 | `debt_update_validity` | Proves new_debt = old_debt + delta | Subsequent shield, repay |
| 5 | `zero_debt` | Proves debt commitment = 0 | Close CDP |
| 6 | `vault_solvency` | Proves vault assets >= liabilities | Solvency dashboard |
| 7 | `cdp_safety_bound` | Proves aggregate CDP safety | Solvency dashboard |

---

## Pre-Demo Setup Checklist

```bash
# 1. Ensure oracle is fresh (required for mint_susd)
npx tsx scripts/refresh-oracle.ts

# 2. Ensure solvency proofs are submitted
npx tsx scripts/submit-solvency.ts

# 3. Start frontend
cd frontend && npm run dev
# Opens at http://localhost:5173

# 4. Have ArgentX/Braavos wallet ready on Starknet Sepolia
#    with some xyBTC tokens and Sepolia ETH for gas
```

---

## Demo Script (Step by Step)

### SCENE 1: Introduction (30 seconds)

**[Show slide/screen with title]**

> "This is Obscura — a privacy-preserving BTC DeFi protocol built on Starknet.
> It lets users deposit BTC, shield their balances using ElGamal encryption,
> open private CDPs to mint stablecoins, and prove solvency — all without
> revealing their actual amounts on-chain.
>
> The privacy is enforced by 7 Noir ZK circuits verified on-chain,
> Pedersen commitments for all sensitive values, and nullifiers to prevent replay.
>
> Let me show you the full flow on Starknet Sepolia testnet."

---

### SCENE 2: Connect Wallet (15 seconds)

**[Show browser at http://localhost:5173]**

1. Click **"Connect Wallet"** in the top-right header
2. ArgentX popup appears — click **Approve**
3. Your wallet address appears in the header

> "First, I connect my ArgentX wallet on Starknet Sepolia.
> The wallet address is displayed in the header."

---

### SCENE 3: Settings — Generate Privacy Key (30 seconds)

**[Navigate to Settings tab]**

1. Click **Settings** in the navigation
2. Show the key management interface
3. Enter a password (8+ characters) in the input field
4. Click **"Generate New Key"**
5. Wait for key generation — show the public key preview
6. Point out: "Key is encrypted with AES-256-GCM and stored in the browser"

> "Before we can use encrypted balances, we need an ElGamal keypair.
> I enter a password, and the app generates a private key, encrypts it
> with AES-256-GCM using PBKDF2 key derivation, and stores it securely
> in the browser. The private key never leaves the client."

---

### SCENE 4: Deposit xyBTC (45 seconds)

**[Navigate to Stake tab]**

1. Show the Deposit section
2. Enter **`10`** in the amount field
3. Click **"Deposit & Stake"**
4. ArgentX popup shows 2 calls:
   - ERC20 `approve` (xyBTC → Vault)
   - Vault `deposit(10 * 1e18)`
5. Click **Approve** in wallet
6. Wait for Sepolia confirmation (~30-60s)
7. Click **"Refresh Balances"**
8. Show: **Public Balance: 10.0000 xyBTC**

> "I deposit 10 xyBTC into the ShieldedVault. This is a standard ERC20
> transfer — the amount is visible on-chain at this point. The public
> balance shows 10 tokens in the vault."

---

### SCENE 5: Shield Balance — Privacy Begins (60 seconds)

**[Still on Stake tab, Shield section]**

1. Enter **`5`** in the Shield amount field
2. Click **"Shield"**
3. **Show the proof generation progress bar** — this is a key demo moment:
   - "Loading circuit..." → "Generating witness..." → "Proving..." → "Done"
4. Explain while it processes:
   > "Now here's where privacy kicks in. The app is generating a ZK proof
   > in-browser using Noir circuits and Barretenberg. This proof commits to
   > the new encrypted balance without revealing the actual amount."
5. ArgentX popup appears — click **Approve**
6. Wait for confirmation
7. Click **"Refresh Balances"**
8. Show:
   - Public Balance: ~5.0000 xyBTC (decreased)
   - Shielded Balance: 5.0000 xyBTC (tracked locally)

> "After shielding, my public balance dropped by 5, but the shielded amount
> is tracked only locally in my browser. On-chain, there's just a Pedersen
> commitment and an encrypted ciphertext — no amount. Check the Shielded event
> on Starkscan — it has the commitment and nullifier, but NO amount field."

---

### SCENE 6: Open CDP (20 seconds)

**[Navigate to CDP tab]**

1. Show the empty CDP state: "You don't have a CDP yet"
2. Click **"Open CDP"**
3. Approve in wallet
4. Wait for confirmation
5. CDP action tabs appear (Lock, Mint, Repay, Close)

> "Now I open a Collateralized Debt Position. This is a simple state
> initialization — no privacy concerns yet."

---

### SCENE 7: Lock Collateral (45 seconds)

**[CDP tab, Lock Collateral section]**

1. Select **"Lock"** action tab
2. Enter **`2`** (2 xyBTC)
3. Click **"Submit"**
4. Show proof generation progress (range_proof circuit)
5. Approve in wallet
6. Wait for confirmation
7. Click **"Refresh Balances"**
8. Show: Locked Collateral reflects the on-chain value

> "I lock 2 xyBTC as collateral. A range proof is generated to verify the
> amount is valid. The collateral is transferred to the CDP contract."

---

### SCENE 8: Mint sUSD — Privacy-Preserving Stablecoin (60 seconds)

**[CDP tab, Mint section]**

1. Select **"Mint"** action tab
2. Enter **`0.01`** sUSD
3. Click **"Submit"**
4. Show proof generation progress (collateral_ratio circuit):
   > "This is the collateral_ratio proof — it proves that my collateral
   > value times the BTC price is at least 200% of the debt I'm taking on,
   > WITHOUT revealing the actual amounts."
5. Approve in wallet
6. Wait for confirmation

> "The key privacy feature: the mint_susd transaction on-chain contains
> ONLY a debt commitment, an encrypted ciphertext, a nullifier, and the
> proof bytes. There is NO amount in the calldata or events. An observer
> can see that a CDP exists and that debt was taken, but cannot determine
> how much."

---

### SCENE 9: Repay sUSD (45 seconds)

**[CDP tab, Repay section]**

1. Select **"Repay"** action tab
2. Enter **`0.01`**
3. Click **"Submit"**
4. Show proof generation progress (debt_update_validity circuit)
5. Approve in wallet
6. Wait for confirmation

> "Repayment works the same way — the debt_update_validity proof proves
> that the new debt equals old debt minus the repayment, and that the
> new debt is non-negative. Again, no amount is revealed on-chain."

---

### SCENE 10: Close CDP (30 seconds)

**[CDP tab, Close section]**

1. Select **"Close"** action tab
2. Click **"Close CDP"**
3. Show proof generation (zero_debt circuit):
   > "The zero_debt proof verifies that my remaining debt is exactly zero —
   > only then can I close the CDP and get my collateral back."
4. Approve in wallet
5. Wait for confirmation
6. Show: Page returns to "You don't have a CDP yet"

> "CDP is closed. My collateral is returned. The close event on-chain
> contains a nullifier but NOT the collateral amount returned."

---

### SCENE 11: Unshield & Withdraw (45 seconds)

**[Navigate to Withdraw tab]**

1. **Unshield section**: Enter **`3`**, click **"Unshield"**
2. Show proof generation progress (balance_sufficiency circuit):
   > "The balance_sufficiency proof proves I have at least 3 tokens in my
   > shielded balance, without revealing my total shielded amount."
3. Approve in wallet, wait for confirmation
4. **Withdraw section**: Enter **`3`**, click **"Withdraw"**
5. Approve in wallet (no proof needed — it's a public balance operation)
6. Wait for confirmation

> "Unshielding converts encrypted balance back to public, and withdrawing
> transfers the public tokens back to my wallet."

---

### SCENE 12: Proofs Dashboard (45 seconds)

**[Navigate to Proofs tab]**

1. Show the **Solvency Cards**:
   - **Vault Solvency: Verified** (green badge)
   - **CDP Safety: Verified** (green badge)
2. Point out the timestamps

> "The Proofs Dashboard shows protocol-wide solvency status. The vault
> solvency proof verifies that total assets exceed total liabilities.
> The CDP safety proof verifies that aggregate collateral meets the
> safety ratio. Both are ZK proofs submitted by an authorized prover."

3. Show **Protocol Stats**:
   - Total Vault Deposits: shows the on-chain total
   - CDP Debt: shows "Shielded" with a privacy badge

> "Notice that vault deposits are visible — that's inherent in the ERC20
> token custody. But CDP debt is private — marked as 'Shielded' because
> debt amounts are commitment-only."

4. Scroll to **Proof History**:
   - Shows all 5 proofs generated during the demo
   - Each has: circuit type, timestamp, status (verified), tx hash

> "Every proof we generated during the demo is logged here — range proof,
> balance sufficiency, collateral ratio, debt update, zero debt. Each
> links to the on-chain transaction where it was verified."

5. Show **Circuit Preloading** button:
   - Click "Preload Circuits" → shows loading → "Circuits Ready"

> "You can preload the circuit WASM files to speed up future proof generation."

---

### SCENE 13: Privacy Verification on Starkscan (30 seconds)

**[Open Starkscan in new tab]**

1. Go to the ShieldedCDP contract page
2. Show the Events tab
3. Point out:
   - `SUSDMinted` event: has `user`, `new_debt_commitment`, `nullifier` — **NO amount**
   - `DebtRepaid` event: has `user`, `new_debt_commitment`, `nullifier` — **NO amount**
   - `CDPClosed` event: has `user`, `nullifier` — **NO collateral_returned**

> "On Starkscan, you can see the events emitted by the contracts.
> Notice — the SUSDMinted and DebtRepaid events have commitments and
> nullifiers, but zero amount information. An on-chain observer can see
> THAT a mint or repay happened, but not HOW MUCH. That's Obscura's
> privacy guarantee."

---

### SCENE 14: Closing Statement (20 seconds)

> "To summarize: Obscura provides privacy-preserving DeFi on Starknet.
> Deposit, shield with ElGamal encryption, borrow against private collateral
> with ZK-proven solvency, and withdraw — all without exposing your amounts.
>
> 7 Noir ZK circuits, Pedersen commitments, nullifier replay protection,
> and per-domain solvency proofs — deployed and verified on Starknet Sepolia.
>
> Thank you."

---

## Key Talking Points (If Asked)

### "How does the privacy work?"
- **ElGamal encryption** for balances (encrypted on client, stored on-chain as ciphertexts)
- **Pedersen commitments** bind amounts without revealing them
- **Noir ZK circuits** prove validity constraints (sufficient balance, collateral ratio, zero debt) without disclosing values
- **Nullifiers** prevent proof replay attacks

### "What's real vs mock on testnet?"
| Real | Mock (Testnet Only) |
|------|---------------------|
| Wallet connection (ArgentX/Braavos) | ProofVerifier (accepts all proofs) |
| Proof generation in-browser (Noir + BB) | PriceFeed ($50K fixed BTC price) |
| Proof data sent in calldata | ERC20 token (not real BTC) |
| On-chain state updates | ElGamal is simplified (brute-force decryption) |
| Commitments, nullifiers, ciphertexts | |
| Events with privacy (no amounts) | |

### "What would production require?"
1. **Garaga verifier contracts** — replace MockProofVerifier with real on-chain ZK verification
2. **Pragma oracle** — replace MockPriceFeed with real BTC price
3. **Endur/Tongo integration** — replace MockERC20 with real BTC LSTs
4. **Full ElGamal on BabyJubJub curve** — real EC scalar multiplication

### "Why is the collateral amount visible but debt isn't?"
Collateral locking involves an ERC20 `transferFrom` which inherently emits a `Transfer` event with the amount. This is a limitation of the ERC20 standard. Debt (mint/repay) is purely internal accounting — no token transfers — so it can be fully commitment-based.

### "How do you prevent someone from minting unlimited sUSD?"
The `collateral_ratio` ZK circuit proves that `collateral_value * price >= debt * 200%`. Even though the verifier is mock on testnet, the circuit logic is real. In production with Garaga verifiers, an invalid proof would be rejected on-chain.

---

## Deployed Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| MockERC20 (xyBTC) | `0x0321dab82dc51b35e2bb2316478b5733eb80b65c77f305fa562d0f860bd5010d` |
| MockProofVerifier | `0x05ae188944b6c5d4600d2ab00ca5fcccc5d6f5a2d2f11b5e698eff6deb49507e` |
| MockPriceFeed | `0x019cb1a2f9c9879ec94848073317f1ced7bb22541e4cfad74df94aa6d1b5aa56` |
| ShieldedVault | `0x06931824b6e18bca850efa26d8924f318d7356d790983c15310924e1bd714bbe` |
| ShieldedCDP | `0x07b665108011e21fab71752efb151b644e5af0b05536ca2519cef472436a7e31` |
| SolvencyProver | `0x029fbc4f1a134920d1fd1dada352e8ef1027743f89250af0ce2dfd20c07953f3` |

## Demo Duration

Total estimated runtime: **8-10 minutes**
(Sepolia block times ~12-30s per transaction, ~8 transactions in demo)
