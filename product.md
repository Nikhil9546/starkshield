# Obscura: Privacy-Preserving BTC DeFi on Starknet

## What is Obscura?

Obscura is a privacy-preserving BTC DeFi protocol built on Starknet. It lets users stake BTC via liquid staking, shield their balances using ElGamal encryption, open private CDPs to mint stablecoins, and prove solvency — all without revealing actual amounts on-chain.

Every DeFi protocol today leaks your financial data. Balances, positions, strategies — everything is visible to MEV bots, competitors, and on-chain analysts. Obscura fixes this.

**The Problems We Solve:**

| Problem | Impact | Obscura's Answer |
|---------|--------|-----------------|
| Transparent Balances | MEV bots, competitors, and adversaries watch every move | ElGamal encrypted balances — on-chain ciphertexts only |
| Front-Running | Public mempool data enables sandwich attacks | Hidden amounts mean nothing to front-run |
| Linkable Identity | On-chain activity creates permanent traceable financial profiles | Commitments + nullifiers break position linkability |
| No Private Yield | BTC holders can't earn yield without exposing their position | Stake via Endur → shield via Tongo → private yield |

---

## Architecture

### System Architecture


https://github.com/user-attachments/assets/7188c33c-d6a7-40d6-aeab-766c9f59b99c


### Trust Model

| Component | Trust Assumption |
|-----------|-----------------|
| User Client | Trusted for key custody and local ZK proving |
| Starknet L2 | Trusted for execution correctness |
| Endur / Tongo | Honest-but-risky; integration surface minimized |
| Protocol Operator | No access to user encryption keys |
| Garaga Verifiers | Trustless — deterministic on-chain proof verification |

---

## Privacy Stack — Three Cryptographic Layers

### Layer 1: ElGamal Encrypted Balances

Balances are stored on-chain as ElGamal ciphertexts on the Baby JubJub curve:

```
Ciphertext = (C1, C2) where:
  C1 = r × G              (ephemeral public key)
  C2 = amount × G + r × PK (encrypted amount)

  r  = random blinding factor
  G  = generator point (Baby JubJub)
  PK = user's public key
```

**Properties:**
- **Additively homomorphic** — Contract can update encrypted balances: Enc(a) + Enc(b) = Enc(a+b) without decrypting
- **Owner-decryptable** — Only the private key holder can recover the plaintext amount
- **Semantically secure** — Ciphertexts reveal nothing about plaintexts
- **Re-randomizable** — Ciphertexts can be refreshed without changing plaintext

**Client-Side Operations:**
```
Key Generation:   sk = randomScalar(), pk = G × sk
Encryption:       r = randomScalar(), C1 = r × G, C2 = r × PK + amount × G
Decryption:       shared = sk × C1, encoded = C2 - shared, amount = discreteLog(encoded)
Homomorphic Add:  (a.C1 + b.C1, a.C2 + b.C2) = Enc(a + b)
```

### Layer 2: Pedersen Commitment Scheme

Every balance operation produces a Pedersen commitment used as a public input to ZK proofs:

```
commitment = PedersenHash(value, blinding_factor)
```

The contract stores commitments (not amounts). ZK proofs prove properties about committed values without revealing them. Commitments bind the value — you can't change it after committing — while the blinding factor keeps it hidden.

### Layer 3: Zero-Knowledge Proofs (Noir + Garaga)

Seven specialized circuits prove different properties about encrypted state:

<img width="1086" height="370" alt="image" src="https://github.com/user-attachments/assets/d2664d95-c79e-486e-b623-56a0f0fb98af" />


The contract never sees your amounts — it only sees the proof (which reveals nothing) and the commitment (which is hiding the value).

---

## ZK Circuits — All 7 Circuits Explained

| # | Circuit | Purpose | Public Inputs | Private Inputs | What It Proves |
|---|---------|---------|--------------|----------------|----------------|
| 1 | `range_proof` | Shield validation | commitment, max_value | amount, randomness | Value ∈ [0, max_value] and matches commitment |
| 2 | `balance_sufficiency` | Unshield / transfer | 3 commitments (old, amount, new) | plaintext_balance, randomness | balance ≥ amount, new_balance = balance - amount |
| 3 | `collateral_ratio` | CDP health check | 2 commitments, price, min_ratio | plaintext_collateral, plaintext_debt, randomness | collateral × price ≥ debt × min_ratio (200%) |
| 4 | `debt_update_validity` | Borrow / repay | 3 commitments, is_repayment | plaintext_debt, randomness | new_debt = old_debt ± delta (correct arithmetic) |
| 5 | `zero_debt` | CDP close | debt_commitment | plaintext=0, randomness | debt == 0 |
| 6 | `vault_solvency` | Protocol health | accumulator_before, accumulator_after, reserve_cipher | user_ciphers[], batch_commitments | total_assets ≥ total_liabilities |
| 7 | `cdp_safety_bound` | Protocol health | total_collateral_cipher, total_debt_cipher, price, min_ratio | plaintext_totals, randomness | Aggregate collateral covers aggregate debt |

All circuits are written in Noir, compiled to ACIR, and proven using Barretenberg's UltraKeccakZKHonk proving system. Proofs are generated entirely in-browser in ~5–15 seconds. On-chain verification happens via Garaga-generated Cairo verifier contracts using `library_call_syscall` — stateless, efficient, and upgradeable.

---

## Staking Flow — Private BTC Yield

### How Staking Works in Obscura

Obscura integrates liquid staking through Endur, so users never interact with validators directly. The entire staking infrastructure is abstracted away.


https://github.com/user-attachments/assets/d56d16fc-3362-4055-a0ec-573a9701a3a9




**Step-by-step:**

1. **Bridge BTC to Starknet** — Use a BTC bridge to bring Bitcoin to Starknet as wrapped BTC. This step is public on the Bitcoin blockchain.

2. **Deposit into ShieldedVault** — Call `deposit()` with your wrapped BTC. The vault routes it to Endur for staking, which mints xyBTC (a liquid staking token). Your BTC is now earning staking yield. **Requires: RANGE_PROOF**

3. **Shield to sxyBTC** — Convert public xyBTC into encrypted sxyBTC via Tongo's encrypted token wrapper. Your balance becomes an ElGamal ciphertext on-chain. Only your private key can decrypt it — the UI shows your decrypted balance locally. **Requires: DEBT_UPDATE_VALIDITY proof**

**Token Flow:** `wrapped BTC → deposit → Endur stakes → xyBTC (public, yield-bearing) → shield via Tongo → sxyBTC (encrypted, yield-bearing, private)`

**Key Properties:**
- No validator management required — Endur handles all delegation, rewards, and slashing protection
- xyBTC exchange rate appreciates as staking rewards accrue to the pool
- After shielding, nobody on-chain can see how much you hold — yield accrues silently
- Instant exit possible via DEX swap (bypass unbonding period)

---

## Shielding Protocol — The Privacy Layer

### What Shielding Does

Shielding converts a public on-chain balance into an encrypted balance that only you can read. It's the core privacy primitive of Obscura.

<img width="1264" height="658" alt="image" src="https://github.com/user-attachments/assets/ffb87ae4-9c2e-4e59-8851-51da920bb0ea" />


### Shield Operation (Public → Encrypted)

```
shield(amount, commitment, ciphertext, proof) → encrypted balance

1. Client: Build Pedersen commitment = Hash(amount, randomness)
2. Client: Encrypt amount with ElGamal → ciphertext (C1, C2)
3. Client: Generate RANGE_PROOF (first shield) or DEBT_UPDATE_VALIDITY proof (subsequent)
4. Client: Encode proof via Garaga npm → Starknet calldata
5. Contract: Verify proof on-chain via ProofVerifier → Garaga library_call
6. Contract: Store ciphertext, consume nullifier, emit event
```

### Unshield Operation (Encrypted → Public)

```
unshield(amount, commitment, ciphertext, proof) → public balance

1. Client: Decrypt current balance using private key
2. Client: Generate BALANCE_SUFFICIENCY proof (proves balance ≥ withdrawal amount)
3. Contract: Verify proof, update ciphertext, return public xyBTC
4. User: Withdraw public xyBTC from vault
```

### Key Management

All encryption keys are managed entirely client-side. The protocol operator never has access to private keys.

- Master key derived via PBKDF2 from user password
- ElGamal private key encrypted with AES-256-GCM in browser localStorage
- Optional export to encrypted JSON backup file
- **If you lose your encryption key, you lose access to your shielded balances forever** — there is no recovery mechanism

---

## Lending Protocol — ShieldedCDP

### How Private Lending Works

The ShieldedCDP lets users borrow sUSD stablecoins against their encrypted sxyBTC collateral. Every value — collateral amount, debt amount, collateral ratio — stays hidden behind Pedersen commitments and ZK proofs.



https://github.com/user-attachments/assets/a7a436a5-854a-49fd-bd3e-9402c3c9d2c4



### CDP Parameters

| Parameter | Value |
|-----------|-------|
| Collateral | sxyBTC (encrypted) |
| Stablecoin | sUSD (USD-pegged, encrypted) |
| Model | Overcollateralized CDP |
| Minimum Collateral Ratio | 200% |
| Liquidation Model | Mode A (Disclosure-on-Liquidation) |

### CDP Lifecycle — Full Detail

**1. Open CDP** — `open_cdp()` → Creates a new position with a unique position_id. No proof required.

**2. Lock Collateral** — `lock_collateral(amount, proof)` → Transfer sxyBTC from shielded balance to CDP. Amount stays encrypted. **Requires: BALANCE_SUFFICIENCY proof** (proves shielded balance ≥ lock amount without revealing either).

**3. Mint sUSD** — `mint_susd(commitment, proof)` → Borrow sUSD against locked collateral. **Requires: COLLATERAL_RATIO proof** (proves collateral × price ≥ debt × 200% without revealing collateral or debt amounts). On-chain calldata contains ONLY commitments, ciphertexts, nullifiers, and proof bytes — NO amounts.

**4. Repay sUSD** — `repay(commitment, proof)` → Burn sUSD to reduce debt. **Requires: DEBT_UPDATE_VALIDITY proof** (proves new_debt = old_debt - repayment, correct arithmetic).

**5. Close CDP** — `close_cdp(proof)` → Close position when fully repaid. **Requires: ZERO_DEBT proof** (proves debt == 0). Unlocks all collateral back to shielded balance.

### Liquidation Model (Mode A — Disclosure-on-Liquidation)


https://github.com/user-attachments/assets/f1dc8179-7822-48b7-a0ac-a8f3bd776b8b




- Oracle staleness automatically pauses minting
- If CR drops below threshold, liquidation window opens
- Owner can prove health via a fresh COLLATERAL_RATIO proof
- If unproven within the window, protocol can seize collateral with conservative bounds

---

## All DeFi Actions — Complete Reference

### Token Types

| Token | Type | Balance | Source | Use Case |
|-------|------|---------|--------|----------|
| xyBTC | Liquid Staking Token | Public (on-chain visible) | Endur liquid staking | BTC yield via staking |
| sxyBTC | Shielded xyBTC | Encrypted (ElGamal ciphertext) | Tongo encrypted wrapper | Private BTC holdings, CDP collateral |
| sUSD | Shielded Stablecoin | Encrypted (ElGamal ciphertext) | ShieldedCDP mint | Private stablecoin, DeFi payments |

### All 13 Executable Actions

| # | Action | What Happens | ZK Proof Required | Privacy Level |
|---|--------|-------------|-------------------|---------------|
| 1 | **Faucet** | Mint 100 test xyBTC (testnet) | None | Public |
| 2 | **Deposit** | Deposit xyBTC into ShieldedVault | None | Public |
| 3 | **Shield** | Convert public balance → encrypted sxyBTC | RANGE_PROOF (first) / DEBT_UPDATE_VALIDITY (subsequent) | Encrypted after |
| 4 | **Unshield** | Convert encrypted sxyBTC → public xyBTC | BALANCE_SUFFICIENCY | Public after |
| 5 | **Withdraw** | Withdraw public xyBTC from vault | None | Public |
| 6 | **Open CDP** | Create a CDP position | None | Position visible, amounts hidden |
| 7 | **Lock Collateral** | Lock sxyBTC as CDP collateral | RANGE_PROOF / DEBT_UPDATE_VALIDITY | Encrypted |
| 8 | **Mint sUSD** | Borrow sUSD against collateral | COLLATERAL_RATIO (≥ 200%) | Encrypted |
| 9 | **Repay** | Pay back sUSD debt | DEBT_UPDATE_VALIDITY | Encrypted |
| 10 | **Close CDP** | Close position (zero debt required) | ZERO_DEBT | Encrypted |
| 11 | **Check Balances** | Fetch on-chain + locally decrypted balances | None | Local only |
| 12 | **Check Solvency** | Query protocol solvency status | None | Public attestation |
| 13 | **Submit Solvency** | Submit vault + CDP solvency proofs | VAULT_SOLVENCY + CDP_SAFETY_BOUND | Aggregate only |

### Proof Generation Flow (In-Browser)

Every private operation follows this pipeline:

<img width="1086" height="370" alt="image" src="https://github.com/user-attachments/assets/bfaa8cd1-7db9-4862-80b2-1ac40dd7a0ae" />


---

## Solvency Proofs — Protocol Health

Obscura maintains two independent solvency domains. This isolation prevents issues in one domain from affecting the other.

### Vault Solvency
**Proves:** Sum(UserDepositsCipher) == VaultReserveCipher
Ensures all user deposits are backed by actual reserves. No individual position is revealed — only the aggregate proof passes or fails.

### CDP Solvency
**Proves:** TotalDebt ≤ TotalCollateral × Price / MIN_CR
Ensures all minted sUSD is overcollateralized. Aggregate proof — no individual CDP amounts disclosed.

An authorized prover submits proofs periodically. Anyone can query verification status on-chain.

---

## AI Assistant — Chat-Driven DeFi

Obscura includes an AI-powered chat assistant (bottom-right widget) that can explain the protocol AND execute real DeFi operations through natural language.

```
"Shield 5 xyBTC for me"
        │
        ▼
┌──────────────────┐     ┌─────────────────────┐
│ DeepSeek API     │────▶│ Structured Action    │
│ (Vercel          │     │ Block Returned       │
│  serverless)     │     └──────────┬──────────┘
└──────────────────┘                │
                                    ▼
                         ┌──────────────────────┐
                         │ Confirmation Dialog   │
                         │ [Execute]  [Cancel]   │
                         └──────────┬──────────┘
                                    │ Execute
                                    ▼
                         ┌──────────────────────┐
                         │ Full ZK Pipeline      │
                         │ Witness → Proof →     │
                         │ Calldata → TX         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Live Status + Result  │
                         │ Starkscan TX Link     │
                         └──────────────────────┘
```

**Capabilities:** Explain ZK proofs and circuits, analyze positions and CDP health, execute all 13 actions with full proof pipeline, provide privacy score assessment.

**Security:** API key server-side only (Vercel env), XSS-escaped output, user confirmation required for every action, same proof pipeline as UI pages.

---

## What's Visible vs Hidden On-Chain

| Visible On-Chain | Hidden (Client-Side Only) |
|-----------------|--------------------------|
| Pedersen commitments | Actual token amounts |
| Ciphertext components (C1, C2) | ElGamal private key |
| Nullifiers | Decrypted balances |
| Proof bytes | Shielded balance totals |
| Public deposit/withdraw amounts | Debt amounts & strategies |
| Transaction existence | Collateral ratios (exact value) |
| CDP existence (address has one) | Individual solvency positions |
| Proof type used | Amount relationships |

Check any transaction on Starkscan — the `SUSDMinted` and `DebtRepaid` events contain commitments and nullifiers, but zero amount information.

---

## Smart Contracts — Deployed on Starknet Sepolia

### Contract Suite

| Contract | Address | Purpose |
|----------|---------|---------|
| ShieldedVault | `0x03f143d78bd7b75a3f32a49af6a78d70f8eeb68d71107d2a1614af7e7c5546e8` | Deposit, shield, unshield, withdraw |
| ShieldedCDP | `0x00d45c53f1d08ffcd85249a27cb2b24630fb7d86c821a8b926683a70ca9c61c8` | CDP lifecycle + liquidation |
| ProofVerifier | `0x04c4e22683a7512582b50986d402781b7d092611b820778a1881b4f62d77ec4a` | Garaga proof routing (7 verifier class hashes) |
| SolvencyProver | `0x06e9f60b113ded9ed86a985e0e1e115cfa5cf73c0bdeb2bae7169d0db74714a8` | Protocol-wide solvency attestations |
| MockPriceFeed | `0x02919a999949af65985feb9bf3a34b55788c747cb78af472db2119ebb5bb96aa` | BTC price oracle (testnet) |
| xyBTC Token | `0x02f17d553d2d1dd9510274519052c7d83e756067bb29752603c5695974b59c35` | MockERC20 for testnet |

### Security Invariants

These properties are enforced by the proof system and must always hold:

- **No balance underflow** — Balance sufficiency proof prevents spending more than you have
- **Proof-before-state** — Every state change requires a valid ZK proof verified on-chain
- **Collateral ratio ≥ 200%** — Collateral ratio proof enforces minimum collateralization
- **Zero-debt closure** — CDPs can only close after proving debt is exactly zero
- **No proof replay** — Nullifiers prevent reusing a proof for multiple operations
- **Domain separation** — Each proof type has a unique verifier key; proofs cannot cross circuits
- **Oracle freshness** — Stale price data automatically pauses minting
- **Per-domain solvency** — Vault and CDP solvency are proven independently

### Testing

- **117 passing Cairo contract tests** — Vault lifecycle, CDP lifecycle, solvency, adversarial (replay attacks, malformed ciphertext, stale oracle, liquidation windows)
- **7 Noir circuit test suites** — Each circuit independently tested
- **E2E real proofs on Sepolia** — Full 10-step lifecycle with real ZK proof generation and on-chain Garaga verification

---

## Tech Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Smart Contracts | Cairo | 2.11.4 | Contract language for Starknet |
| Build Tool | Scarb | Latest stable | Cairo package manager |
| Testing | Starknet Foundry (snforge) | v0.56.0 | Contract test framework |
| ZK Circuits | Noir | 1.0.0-beta.16 | ZK circuit language |
| Proving Backend | Barretenberg (bb.js) | 3.0.0-nightly.20251104 | In-browser proof generation (UltraKeccakZKHonk) |
| On-Chain Verification | Garaga | 1.0.1 | Cairo verifier generation from Noir VKs |
| Frontend | React | 18.3 | UI framework |
| Language | TypeScript | 5.5 | Type-safe frontend |
| Bundler | Vite | 5.4 | Frontend build tool |
| Styling | TailwindCSS | Latest | UI styling |
| Wallet SDK | starknet.js | 6.x | Wallet + contract interaction |
| Contract Standards | OpenZeppelin Cairo | v0.20.0 | ERC20, access control |
| AI Assistant | DeepSeek API | v1 | Chat + executable DeFi actions |
| API Proxy | Vercel Serverless | Node.js | Server-side API key protection |
| Encryption | ElGamal on Baby JubJub | — | Client-side balance encryption |
| Key Storage | AES-256-GCM | — | Encrypted key storage in browser |
| Commitments | Pedersen Hash | BN254 | Value binding for ZK proofs |

---

## Future Roadmap — Obscura v2.0

Obscura v1.5 proved that private DeFi works — encrypted balances, 7 ZK circuits, on-chain Garaga verification. The v2.0 evolution transforms Obscura from a privacy protocol into the first platform offering **private yield optimization**. Five phases, three new ZK circuits, zero compromises on privacy.

### Phase 1: Performance-Based Validator Multipliers (Q2 2026)
**Priority: Critical | New Circuits: 1**

Currently, all staking is routed to Endur generically — every user gets the same xyBTC minting rate regardless of validator quality. Phase 1 introduces a Performance Score (P-Score) system that routes stake to higher-performing validators and adjusts sxyBTC minting rates accordingly.

**P-Score Formula:**
```
P-Score = (100 – commission_rate) × decay_factor × uptime_weight
```

- `commission_rate`: Validator's fee (3–15%)
- `decay_factor`: Penalizes historical downtime/slashing (0.0–1.0)
- `uptime_weight`: Rolling 30-day uptime (0.85–1.0)

**Multiplier Mechanism:**
```
multiplier = (validator_p_score × 10000) / network_average_p_score
```
Multipliers range from 0.5x to 1.5x. Users staking through higher-performing validators receive more sxyBTC per unit of BTC deposited, creating natural capital flow toward quality validators.

**Privacy Integration:**
A new ZK circuit — `multiplier_tier_proof.nr` — proves that sxyBTC was minted at a valid multiplier tier without revealing the exact amount, validator, or multiplier value. On-chain, the contract only sees that the minting falls within an approved tier bracket.

**Deliverables:**
- ValidatorRegistry contract with on-chain P-Score tracking
- `multiplier_tier_proof` Noir circuit + Garaga verifier
- ShieldedVault.shield() updated to accept multiplier proof + tier commitment
- Frontend validator picker with performance metrics

---

### Phase 2: Auto-Appreciating Collateral (Q2–Q3 2026)
**Priority: High | Modified Circuits: 1**

In v1.5, collateral locked in CDPs is static. But since xyBTC is a liquid staking token, its exchange rate against underlying BTC appreciates as staking rewards accrue to the pool. Phase 2 makes the CDP system aware of this appreciation.

Since staking yield (7–12% APY) outpaces the stability fee on debt (2% APR), collateral health naturally improves over time — fewer liquidations, better capital efficiency.

**Updated Collateral Ratio Proof:**
```
"My collateral × current_exchange_rate × price ≥ debt × min_ratio"
```
The `collateral_ratio_v2.nr` circuit adds `exchange_rate` as a public input. The prover reveals nothing about the collateral amount — only that the ratio holds after applying the current rate.

**Key Properties:**
- Exchange rate is public (protocol-wide number), but individual holdings remain encrypted
- Users can prove "my position was healthy at open and has only improved" without revealing amounts
- Collateral value growth outpaces debt accumulation, naturally reducing liquidation risk
- ShieldedCDP reads exchange rate from Endur's pool contract and passes it to the verifier

---

### Phase 3: Three-Layer Oracle Fortress (Q3 2026)
**Priority: High | New Circuits: 0**

In transparent DeFi, a bad oracle price is dangerous. In privacy DeFi, it is catastrophic. When balances are encrypted, external observers cannot detect insolvency caused by price manipulation — the protocol could become silently undercollateralized with no one able to verify it until solvency proofs fail.

| Layer | Source | Trigger | Behavior |
|-------|--------|---------|----------|
| **Primary** | Pragma TWAP Oracle | Default — active when healthy | Time-weighted average price over configurable window |
| **Fallback** | Staleness Circuit Breaker | Stale >2hrs or deviation >10% | Pauses minting, CDPs enter repay-only mode |
| **Emergency** | Admin Manual Override | Breaker active >6 hours | Override price + mandatory solvency re-proof |

**Solvency Re-Proof Requirement:**
When emergency override activates, both vault solvency and CDP safety bound proofs must be resubmitted and verified against the corrected price before any new minting can resume.

**Deliverables:**
- New `OracleRouter.cairo` contract — aggregates Pragma feeds with TWAP, staleness detection, override logic
- ShieldedCDP.mint() checks oracle health before accepting CR proofs
- SolvencyProver adds mandatory re-proof flag blocking minting until cleared

---

### Phase 4: Continuous Health Factor with ZK Range Proofs (Q3–Q4 2026)
**Priority: Medium | New Circuits: 1**

v1.5's liquidation model is binary — either your CR proof passes (≥200%) or you enter liquidation pending. Phase 4 introduces a continuous health factor:

```
health_factor = (collateral_value × liquidation_threshold) / debt_value
```

**ZK Health Tier System:**

| Tier | Health Factor | Status | User Action |
|------|--------------|--------|-------------|
| Safe | > 2.0 | Fully healthy | No action needed |
| Watch | 1.5 – 2.0 | Approaching threshold | Consider adding collateral |
| Warning | 1.1 – 1.5 | Near liquidation | Urgent: add collateral or repay |
| Critical | < 1.1 | Liquidation window opens | Prove health or face seizure |

New `health_tier_proof.nr` circuit proves which tier a position falls in without revealing the exact health factor. Tier proofs can also be consumed by external protocols for counterparty risk assessment.

---

### Phase 5: Stability Fee & Liquidation Economics (Q4 2026)
**Priority: Medium | New Circuits: 1**

**Stability Fee:** 2% APR on minted sUSD, settled through 30-day re-proof cycles (7-day grace period). Fee calculation happens client-side; ZK proof validates `new_debt = old_debt + accrued_fee`.

**Structured Liquidation Penalties:**

| Scenario | Penalty | ZK Requirement |
|----------|---------|----------------|
| Self-liquidation (user-initiated) | 2% of collateral | Balance sufficiency proof |
| Grace period expiry | 5% of collateral | Penalty calculation proof |
| Forced liquidation | 10% of collateral | Penalty calculation proof |

New circuit: `penalty_calculation.nr` — proves `penalty = collateral × penalty_rate` and `remaining = collateral – penalty` without revealing amounts.

---

### ZK Circuit Evolution: v1.5 → v2.0

| Circuit | v1.5 | v2.0 | Change |
|---------|------|------|--------|
| range_proof | ✓ | ✓ | No change |
| balance_sufficiency | ✓ | ✓ | No change |
| collateral_ratio | ✓ | v2 | Adds exchange_rate public input |
| debt_update_validity | ✓ | v2 | Supports fee accrual accounting |
| zero_debt | ✓ | ✓ | No change |
| vault_solvency | ✓ | ✓ | No change |
| cdp_safety_bound | ✓ | ✓ | No change |
| multiplier_tier_proof | — | **NEW** | Proves minting at valid multiplier tier |
| health_tier_proof | — | **NEW** | Proves health factor within tier range |
| penalty_calculation | — | **NEW** | Proves correct liquidation penalty math |

**Total circuits: 7 → 10.** All new circuits use the same Noir + Barretenberg + Garaga pipeline. Existing circuits maintain backward compatibility.

### Consolidated Timeline

| Quarter | Phase | Key Deliverable | Dependency |
|---------|-------|-----------------|------------|
| Q2 2026 | Validator Multipliers | P-Score + multiplier_tier_proof | Endur validator API |
| Q2–Q3 2026 | Auto-Appreciating Collateral | collateral_ratio_v2 circuit | Phase 1 |
| Q3 2026 | Oracle Fortress | OracleRouter + solvency re-proof | Pragma integration |
| Q3–Q4 2026 | Health Factor Tiers | health_tier_proof circuit | Phase 2 + 3 |
| Q4 2026 | Stability Fee & Liquidation | penalty_calculation circuit | Phase 4 |

Phases 1 and 3 are independent and can progress in parallel. Phases 2, 4, and 5 are sequential.

---

## Links

- **Demo Video:** [https://youtu.be/bto7QkCaKIQ](https://youtu.be/bto7QkCaKIQ)
- **GitHub:** [https://github.com/Nikhil9546/starkshield](https://github.com/Nikhil9546/starkshield)
- **Live App:** [https://starkshield-ten.vercel.app/](https://starkshield-ten.vercel.app/)

---

*That's private DeFi.*
