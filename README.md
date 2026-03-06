# Obscura v1.5

**Privacy-Preserving BTC DeFi on Starknet**

Obscura lets you stake BTC, borrow stablecoins, and prove solvency — all without revealing your balances. It combines ElGamal encrypted balances with zero-knowledge proofs verified on-chain via Garaga, so the blockchain enforces every rule while learning nothing about your funds.

**Live on Starknet Sepolia** | [Deployed Contracts](#deployed-contracts-sepolia)

---

## Table of Contents

- [Why Obscura](#why-obscura)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Privacy Stack](#privacy-stack)
- [Smart Contracts](#smart-contracts)
- [ZK Circuits](#zk-circuits)
- [Frontend](#frontend)
- [AI Assistant](#ai-assistant)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Testing](#testing)
- [Deployed Contracts (Sepolia)](#deployed-contracts-sepolia)
- [Security](#security)

---

## Why Obscura

DeFi on public blockchains has a fundamental problem: **every balance, every transaction, every position is visible to everyone**. This creates real risks:

- **Front-running** — MEV bots see your trades before they settle
- **Position hunting** — Liquidators target visible undercollateralized CDPs
- **Financial surveillance** — Anyone can map your entire portfolio from an address
- **Competitive disadvantage** — Institutional players avoid chains where strategies are exposed

Obscura solves this by making balances encrypted and operations provable without disclosure. You get the security guarantees of DeFi (collateral enforcement, solvency verification) without sacrificing privacy.

**What you can do:**

| Action | Privacy Level |
|--------|--------------|
| Deposit BTC into vault | Public (on-chain amount) |
| Shield balance (mint sxyBTC) | Encrypted (ElGamal ciphertext) |
| Open CDP & lock collateral | Encrypted collateral amount |
| Mint sUSD stablecoin | Encrypted debt amount |
| Prove collateral ratio >= 200% | ZK proof (no amounts revealed) |
| Prove vault solvency | ZK proof (aggregate, no individual data) |
| Withdraw & unshield | Returns to public balance |

---

## How It Works

### User Flow

```
  1. DEPOSIT            2. SHIELD              3. LOCK & BORROW
  +-----------+         +-----------+          +-----------+
  | Send BTC  |  --->   | Encrypt   |  --->    | Lock as   |
  | to Vault  |         | balance   |          | collateral|
  | (public)  |         | (sxyBTC)  |          | Mint sUSD |
  +-----------+         +-----------+          +-----------+
       |                      |                      |
       |  ERC20 transfer      |  ElGamal + ZK proof  |  ZK proof of CR >= 200%
       |  on-chain             |  on-chain             |  on-chain
       v                      v                      v
  Public balance         Encrypted balance      Private CDP position
  visible to all         only you can decrypt    only you know amounts
```

**Step by step:**

1. **Deposit** — Transfer xyBTC (wrapped BTC) into the ShieldedVault. This is a standard ERC20 transfer; the deposited amount is public.

2. **Shield** — Convert your public vault balance into an encrypted sxyBTC balance. The contract stores an ElGamal ciphertext that only your private key can decrypt. A ZK range proof proves your amount is valid without revealing it.

3. **Open CDP** — Lock your encrypted sxyBTC as collateral in a Shielded CDP. A ZK collateral ratio proof proves your position meets the 200% minimum collateralization — without revealing either the collateral or debt amounts.

4. **Mint sUSD** — Borrow the shielded stablecoin against your locked collateral. The debt is also stored as an encrypted commitment.

5. **Repay & Close** — Repay your sUSD debt. A zero-debt proof lets you close the CDP. A balance sufficiency proof ensures no underflow when you unshield back to a public balance.

6. **Solvency Proofs** — The protocol periodically submits aggregate solvency proofs (vault assets >= liabilities, CDP collateral covers debt) without revealing any individual position.

---

## Architecture

```
                     +--------------------------+
                     |     Frontend (React)     |
                     |   Vite + TypeScript      |
                     +-----+----------+---------+
                           |          |
              +------------+          +-------------+
              |                                     |
   +----------+----------+              +-----------+-----------+
   |   AI Chat Widget    |              |   DeFi Pages          |
   |   (DeepSeek API)    |              |   Stake/CDP/Withdraw  |
   +----------+----------+              +-----------+-----------+
              |                                     |
              v                                     v
   +----------+----------+         +----------------+------------------+
   |  AI Action Executor |         |                |                   |
   |  (13 action types)  | ------> |                |                   |
   +---------------------+  +------+------+  +-----+-------+  +-------+--------+
                             | Privacy      |  | Proof        |  | Contract       |
                             | Engine       |  | Pipeline     |  | Interaction    |
                             | (ElGamal)    |  | (Noir + BB)  |  | (starknet.js)  |
                             +------+------+  +-----+-------+  +-------+--------+
                                    |                |                   |
                                    v                v                   v
                              +-----------+  +-----------+        +----------+
                              | Key Mgmt  |  | Garaga    |        | Starknet |
                              | (Browser  |  | Calldata  |        | Sepolia  |
                              |  Storage) |  | Encoding  |        |          |
                              +-----------+  +-----------+        +-----+----+
                                                                        |
                                         +------------------------------+
                                         |              |               |
                                  +------+-----+ +-----+------+ +------+-------+
                                  | Shielded   | | Shielded   | | Solvency     |
                                  | Vault      | | CDP        | | Prover       |
                                  | (Cairo)    | | (Cairo)    | | (Cairo)      |
                                  +------+-----+ +-----+------+ +------+-------+
                                         |              |               |
                                         +--------------+---------------+
                                                        |
                                                +-------+-------+
                                                | ProofVerifier |
                                                | (Garaga       |
                                                |  On-chain VK) |
                                                +---------------+
```

### Component Breakdown

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS | User interface for all DeFi operations |
| **AI Assistant** | DeepSeek API + Vercel Serverless | Conversational DeFi — chat-driven deposits, shields, CDPs with ZK proofs |
| **Privacy Engine** | ElGamal on Baby JubJub curve | Key generation, encryption, decryption of balances |
| **Proof Pipeline** | Noir (noir_js) + Barretenberg (bb.js) | In-browser ZK proof generation (UltraKeccakZKHonk) |
| **Calldata Encoder** | Garaga npm package | Converts proofs into Starknet-compatible calldata |
| **Smart Contracts** | Cairo (Scarb + Starknet Foundry) | On-chain state management and proof verification |
| **Proof Verifier** | Garaga-generated Cairo verifiers | On-chain verification of ZK proofs via `library_call` |

---

## Privacy Stack

Obscura's privacy comes from three complementary cryptographic layers:

### 1. ElGamal Encrypted Balances

Balances are stored on-chain as ElGamal ciphertexts on the Baby JubJub curve:

```
Ciphertext = (C1, C2) where:
  C1 = r * G              (ephemeral public key)
  C2 = amount * G + r * PK (encrypted amount)

  r  = random blinding factor
  G  = generator point
  PK = user's public key
```

**Properties:**
- **Additively homomorphic** — The contract can update encrypted balances (`Enc(a) + Enc(b) = Enc(a+b)`) without decrypting
- **Owner-decryptable** — Only the private key holder can recover the plaintext amount
- **On-chain verifiable** — The ciphertext structure can be validated without knowing the plaintext

### 2. Pedersen Commitment Scheme

Every balance operation produces a Pedersen commitment used as a public input to ZK proofs:

```
commitment = PedersenHash(value, blinding)
```

The contract stores commitments (not amounts). ZK proofs prove properties about the committed values without revealing them.

### 3. Zero-Knowledge Proofs (Noir + Garaga)

Seven specialized circuits prove different properties:

```
User's Browser                    Starknet
+------------------+              +-------------------+
| 1. Build witness |              |                   |
|    (private data)|              |                   |
|        |         |              |                   |
| 2. noir_js       |              |                   |
|    compile       |              |                   |
|    witness       |              |                   |
|        |         |              |                   |
| 3. bb.js         |              |                   |
|    generate      |     proof    |                   |
|    proof         | -----------> | 4. Garaga         |
|        |         |   calldata   |    verifier       |
| 3b. garaga npm   |              |    (library_call) |
|     encode       |              |        |          |
|     calldata     |              | 5. If valid:      |
+------------------+              |    update state   |
                                  +-------------------+
```

**The contract never sees your amounts** — it only sees the proof (which reveals nothing) and the commitment (which is hiding).

---

## Smart Contracts

### ShieldedVault (`shielded_vault.cairo`)

The core vault manages deposits, withdrawals, and the shield/unshield lifecycle.

**Key functions:**

| Function | What it does | Privacy |
|----------|-------------|---------|
| `deposit(amount)` | Deposit xyBTC into public balance | Public |
| `withdraw(amount)` | Withdraw xyBTC from public balance | Public |
| `shield(amount, commitment, ciphertext, proof)` | Convert public balance to encrypted sxyBTC | Encrypted after this point |
| `unshield(amount, commitment, ciphertext, proof)` | Convert encrypted back to public | Decrypted after this point |

**Privacy enforcement:**
- First shield requires a **Range Proof** (proves amount is within valid range)
- Subsequent shields require a **Debt Update Validity** proof (proves new = old + delta)
- Unshield requires a **Balance Sufficiency** proof (proves balance >= withdrawal, no underflow)
- Every operation requires a unique **nullifier** to prevent replay attacks

### ShieldedCDP (`shielded_cdp.cairo`)

The CDP (Collateralized Debt Position) system lets users borrow sUSD against their encrypted collateral.

**Key functions:**

| Function | What it does | Proof Required |
|----------|-------------|---------------|
| `open_cdp()` | Create a new CDP position | None |
| `lock_collateral(amount, proof)` | Lock sxyBTC as collateral | Range Proof / Debt Update |
| `mint_susd(commitment, proof)` | Borrow sUSD against collateral | Collateral Ratio (>= 200%) |
| `repay(commitment, proof)` | Repay sUSD debt | Debt Update Validity |
| `close_cdp(proof)` | Close position (requires zero debt) | Zero Debt |

**Liquidation model (Mode A — Disclosure-on-Liquidation):**
- Oracle staleness automatically pauses minting
- If collateral ratio drops below threshold, a liquidation window opens
- The borrower can prove health via a fresh collateral ratio proof
- If unproven within the window, the protocol can seize collateral

### ProofVerifier (`proof_verifiers.cairo`)

Routes proof verification to the correct Garaga-generated verifier contract via `library_call_syscall`:

```
verify(proof_type, proof_data) -> bool

proof_type maps to a class hash:
  1 -> range_proof verifier
  2 -> balance_sufficiency verifier
  3 -> collateral_ratio verifier
  4 -> debt_update_validity verifier
  5 -> zero_debt verifier
  6 -> vault_solvency verifier
  7 -> cdp_safety_bound verifier
```

Each verifier is a Garaga-generated Cairo contract compiled from the Noir circuit's verification key. The `library_call` pattern means verifiers are stateless class hashes — efficient and upgradeable.

### SolvencyProver (`solvency_prover.cairo`)

Manages periodic protocol-wide solvency attestations:

- **Vault Solvency**: Proves `total_assets >= total_liabilities` across all vault accounts
- **CDP Safety Bound**: Proves `total_collateral * price >= total_debt * safety_ratio` across all CDPs

These are per-domain proofs — vault and CDP solvency are proven independently (no circular dependencies). An authorized prover submits the proofs; anyone can query the verification status.

---

## ZK Circuits

All circuits are written in [Noir](https://noir-lang.org/) and compiled to ACIR for the UltraKeccakZKHonk proving system.

| Circuit | Purpose | Public Inputs | What It Proves |
|---------|---------|--------------|---------------|
| **range_proof** | Shield validation | commitment, max_value | Value is in [0, max_value] and matches commitment |
| **balance_sufficiency** | Unshield / transfer | 3 commitments (old, amount, new) | balance >= amount, new_balance = balance - amount |
| **collateral_ratio** | CDP health check | 2 commitments, price, min_ratio | collateral * price >= debt * min_ratio |
| **debt_update_validity** | Borrow / repay | 3 commitments, is_repayment | new_debt = old_debt +/- delta (correct arithmetic) |
| **zero_debt** | CDP close | debt_commitment | debt == 0 |
| **vault_solvency** | Protocol health | 2 commitments, num_accounts | total_assets >= total_liabilities |
| **cdp_safety_bound** | Protocol health | 2 commitments, price, ratio, num_cdps | Aggregate collateral covers aggregate debt |

All circuits use **Pedersen hashing** on the BN254 curve for commitments and **field arithmetic** for range/ratio checks.

---

## Frontend

The React frontend provides five pages:

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing Page | Protocol overview, feature highlights, call-to-action |
| `/docs` | Documentation | Architecture docs and protocol explanation |
| `/stake` | Stake Page | Deposit xyBTC, shield to sxyBTC, faucet (testnet) |
| `/cdp` | CDP Page | Open CDP, lock collateral, mint/repay sUSD, close |
| `/withdraw` | Withdraw Page | Unshield sxyBTC back to public xyBTC, withdraw |
| `/proofs` | Proofs Dashboard | View proof history, solvency status, submit solvency proofs |
| `/settings` | Settings | Privacy key management, backup/restore |
| — | AI Chat (widget) | Floating bottom-right assistant — explains protocol and executes operations |

### Client-Side Privacy Engine

All cryptographic operations happen in the browser — private keys never leave the client:

```
frontend/src/lib/
  privacy/
    keygen.ts      # ElGamal keypair generation (Baby JubJub curve)
    encrypt.ts     # Amount encryption + Pedersen commitment computation
    decrypt.ts     # Amount decryption using private key
    storage.ts     # Encrypted key storage in browser localStorage
  proofs/
    circuits.ts    # Load compiled Noir circuits from /public/circuits/
    witness.ts     # Build witness inputs for each circuit type
    prover.ts      # Generate proofs using noir_js + bb.js (in-browser)
    calldata.ts    # Encode proofs as Garaga-compatible Starknet calldata
```

### Proof Generation Flow

When you shield, borrow, repay, or perform any private operation:

1. **Witness Construction** — The frontend builds the private witness (your balance, blinding factor, etc.)
2. **Circuit Execution** — `noir_js` compiles the witness against the circuit ACIR
3. **Proof Generation** — `bb.js` (Barretenberg) generates an UltraKeccakZKHonk proof
4. **Calldata Encoding** — The `garaga` npm package encodes the proof + verification key into Starknet calldata
5. **Transaction Submission** — `starknet.js` submits the transaction with proof calldata
6. **On-chain Verification** — The Garaga verifier contract validates the proof, then the contract updates state

All of this happens in your browser in ~5-15 seconds.

---

## AI Assistant

Obscura includes an AI-powered chat assistant that can **explain the protocol and execute real DeFi operations** through natural language.

### What It Does

The AI chat widget (bottom-right corner) connects to DeepSeek's API and has full context about your wallet state — balances, CDP positions, privacy score, and on-chain data. It can:

- **Explain** — How ZK proofs work, what each circuit does, privacy vs public data
- **Analyze** — Your current positions, CDP health, collateral ratio scenarios
- **Execute** — Real on-chain operations with ZK proof generation, directly from chat

### Executable Actions

When you ask the AI to do something ("shield 5 xyBTC for me"), it returns a structured action block. The frontend parses it, shows a **confirmation dialog** (Execute / Cancel), then runs the full pipeline — witness generation, ZK proof, Garaga calldata encoding, and contract transaction — with live status updates in the chat.

| Action | What Happens |
|--------|-------------|
| `faucet` | Mint 100 test xyBTC |
| `deposit` | Deposit xyBTC into vault |
| `shield` | Convert to encrypted sxyBTC (ZK range proof) |
| `unshield` | Convert back to public (ZK balance sufficiency proof) |
| `withdraw` | Withdraw public xyBTC |
| `open_cdp` | Create a CDP position |
| `lock_collateral` | Lock xyBTC as collateral (ZK range proof) |
| `mint_susd` | Borrow sUSD (ZK collateral ratio proof) |
| `repay` | Repay sUSD debt (ZK debt update proof) |
| `close_cdp` | Close CDP (ZK zero debt proof) |
| `check_balances` | Fetch and display on-chain + local balances |
| `check_solvency` | Query protocol solvency status |
| `submit_solvency` | Submit vault + CDP solvency proofs |

### Architecture

```
User Chat Input
      |
      v
+------------------+     +---------------------+
| DeepSeek API     | --> | AI Response + Action |
| (via Vercel      |     | Block Parsing        |
|  serverless fn)  |     +----------+----------+
+------------------+                |
                                    v
                         +----------+----------+
                         | Confirmation Dialog  |
                         | [Execute] [Cancel]   |
                         +----------+----------+
                                    |
                                    v
                         +----------+----------+
                         | Action Executor      |
                         | - Witness generation |
                         | - ZK proof (noir_js) |
                         | - Garaga calldata    |
                         | - Contract tx        |
                         +----------+----------+
                                    |
                                    v
                         +----------+----------+
                         | Live Status Updates  |
                         | Success/Fail Result  |
                         | Starkscan TX Link    |
                         +---------------------+
```

### Security

- **API key protection** — DeepSeek API key is server-side only (Vercel env var `DEEPSEEK_API_KEY`). The `VITE_DEEPSEEK_API_KEY` fallback is for local dev only.
- **XSS protection** — All AI-generated content is HTML-escaped before rendering. Only safe tags (`<strong>`, `<code>`, `<span>`, `<a>`) are allowed.
- **User confirmation** — Every executable action requires explicit user approval before any transaction is submitted.
- **Same proof pipeline** — The AI executor uses the exact same contract functions and ZK proof generation as the UI pages. No shortcuts.

### Files

```
frontend/
  api/
    chat.ts                    # Vercel serverless proxy for DeepSeek API
  src/
    components/
      AIChat.tsx               # Floating chat widget with action execution UI
    lib/ai/
      client.ts                # DeepSeek API client + system prompt
      executor.ts              # 13-action executor with ZK proof pipeline
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Python 3.10** (for Garaga CLI)
- **Starknet wallet** (Argent X or Braavos browser extension)

### Install Toolchain

```bash
# Starknet tools (Scarb + Foundry + Devnet)
curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh

# Noir compiler (must match Garaga compatibility)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
noirup --version 1.0.0-beta.16

# Barretenberg prover backend (must match Garaga compatibility)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
bbup --version 3.0.0-nightly.20251104

# Garaga (Python 3.10 required)
python3.10 -m venv .venv
source .venv/bin/activate
pip install garaga==1.0.1
```

### Build Everything

```bash
# 1. Compile Cairo contracts
cd contracts && scarb build

# 2. Compile Noir circuits
cd circuits
for circuit in range_proof balance_sufficiency collateral_ratio \
               debt_update_validity zero_debt vault_solvency cdp_safety_bound; do
  cd $circuit && nargo build && cd ..
done

# 3. Generate verification keys (requires bb)
for circuit in range_proof balance_sufficiency collateral_ratio \
               debt_update_validity zero_debt vault_solvency cdp_safety_bound; do
  bb write_vk -b ./target/${circuit}.json -o ./target/${circuit}_vk
done

# 4. Generate Garaga verifier contracts
garaga gen --system ultra_keccak_zk_honk \
  --vk ./circuits/target/range_proof_vk \
  --output ./verifier-contracts/

# 5. Install frontend dependencies & build
cd frontend && npm install && npm run build
```

### Run Locally (Devnet)

```bash
# Terminal 1: Start local Starknet devnet
starknet-devnet --seed 0

# Terminal 2: Deploy contracts to devnet
cd scripts && npx tsx deploy.ts

# Terminal 3: Start frontend dev server
cd frontend && npm run dev
```

Open `http://localhost:5173` and connect your wallet.

### Run on Sepolia

The contracts are already deployed on Sepolia testnet. To use the frontend:

```bash
cd frontend

# .env is already configured with Sepolia addresses
npm install
npm run dev
```

Connect your Argent X or Braavos wallet (switch to Sepolia network) and you're ready to go.

---

## Deployment

### Deploy to Starknet Sepolia

```bash
# 1. Set up deployer account
cp .env.example .env
# Edit .env with your deployer private key and account address

# 2. Deploy all contracts
npx tsx scripts/deploy.ts

# 3. Submit initial solvency proofs
npx tsx scripts/submit-solvency.ts

# 4. Refresh oracle price feed
npx tsx scripts/refresh-oracle.ts
```

### Deploy Frontend to Vercel

```bash
cd frontend
npx vercel --prod
```

Environment variables needed in Vercel:

```
VITE_STARKNET_NETWORK=sepolia
VITE_VAULT_ADDRESS=<from deployment>
VITE_CDP_ADDRESS=<from deployment>
VITE_VERIFIER_ADDRESS=<from deployment>
VITE_SOLVENCY_ADDRESS=<from deployment>
VITE_PRICE_FEED_ADDRESS=<from deployment>
VITE_XYBTC_ADDRESS=<from deployment>

# AI Assistant (server-side only — NOT prefixed with VITE_)
DEEPSEEK_API_KEY=<your DeepSeek API key>
```

The `DEEPSEEK_API_KEY` is used by the Vercel serverless function (`/api/chat`) and never exposed to the browser. For local development, set `VITE_DEEPSEEK_API_KEY` in `frontend/.env` instead.

---

## Testing

### Cairo Contract Tests (117 passing)

```bash
cd contracts && snforge test
```

Tests cover:
- Vault: deposit, withdraw, shield, unshield with proof verification
- CDP: open, lock, mint, repay, close lifecycle
- Solvency: proof submission and status tracking
- Adversarial: replay attacks, malformed ciphertext, stale oracle, liquidation windows

### Noir Circuit Tests

```bash
cd circuits
for circuit in range_proof balance_sufficiency collateral_ratio \
               debt_update_validity zero_debt vault_solvency cdp_safety_bound; do
  cd $circuit && nargo test && cd ..
done
```

### Frontend Build Check

```bash
cd frontend && npm run build
```

### End-to-End (Real Proofs on Sepolia)

```bash
npx tsx scripts/e2e-real-proofs.ts
```

Runs the full 10-step lifecycle with real ZK proof generation and on-chain Garaga verification:

```
Step 1:  Mint test xyBTC (faucet)
Step 2:  Approve vault spending
Step 3:  Deposit into vault
Step 4:  Shield (Range Proof)
Step 5:  Open CDP
Step 6:  Lock collateral (Debt Update)
Step 7:  Mint sUSD (Collateral Ratio)
Step 8:  Repay sUSD (Debt Update)
Step 9:  Close CDP (Zero Debt)
Step 10: Unshield (Balance Sufficiency)
```

---

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| MockERC20 (xyBTC) | `0x02f17d553d2d1dd9510274519052c7d83e756067bb29752603c5695974b59c35` |
| ProofVerifier | `0x04c4e22683a7512582b50986d402781b7d092611b820778a1881b4f62d77ec4a` |
| MockPriceFeed | `0x02919a999949af65985feb9bf3a34b55788c747cb78af472db2119ebb5bb96aa` |
| ShieldedVault | `0x03f143d78bd7b75a3f32a49af6a78d70f8eeb68d71107d2a1614af7e7c5546e8` |
| ShieldedCDP | `0x00d45c53f1d08ffcd85249a27cb2b24630fb7d86c821a8b926683a70ca9c61c8` |
| SolvencyProver | `0x06e9f60b113ded9ed86a985e0e1e115cfa5cf73c0bdeb2bae7169d0db74714a8` |

View on [Starkscan](https://sepolia.starkscan.co/) or [Voyager](https://sepolia.voyager.online/).

---

## Security

### Invariants

These properties are enforced by the proof system and must always hold:

1. **No balance underflow** — Balance sufficiency proof prevents spending more than you have
2. **Proof-before-state** — Every state change requires a valid ZK proof verified on-chain
3. **Collateral ratio >= 200%** — Collateral ratio proof enforces minimum collateralization
4. **Zero-debt closure** — CDPs can only close after proving debt is exactly zero
5. **No proof replay** — Nullifiers prevent reusing a proof for multiple operations
6. **Domain separation** — Each proof type has a unique verifier key; proofs cannot cross circuits
7. **Oracle freshness** — Stale price data automatically pauses minting
8. **Per-domain solvency** — Vault and CDP solvency are proven independently

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Balance front-running | Balances are encrypted; amounts are hidden |
| Proof forgery | Garaga verifier rejects invalid proofs on-chain |
| Replay attacks | Unique nullifiers consumed per operation |
| Key compromise | Keys stored encrypted in browser; backup/restore in Settings |
| Oracle manipulation | Staleness check pauses minting; price feed is updateable |
| Contract upgrade attacks | Verifier class hashes are admin-controlled with events |

### What Remains Public

Obscura provides **transactional privacy**, not full anonymity:

- **Wallet addresses** are public (Starknet accounts)
- **Transaction existence** is visible (you made a transaction)
- **Deposit/withdrawal events** are emitted (but amounts are committed, not plaintext)
- **CDP existence** is visible (address has a CDP open)
- **Proof type** is visible (the contract knows which circuit was used)

What is **hidden**:
- Exact balances (encrypted via ElGamal)
- Collateral amounts (Pedersen commitments)
- Debt amounts (Pedersen commitments)
- Collateral ratios (proven >= 200% without revealing exact value)
- Individual positions in solvency proofs (only aggregates are proven)

---

## Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Cairo | 2.11.4 | Smart contract language for Starknet |
| Scarb | Latest stable | Cairo build tool |
| Starknet Foundry | v0.56.0 | Contract testing framework (snforge) |
| Noir | 1.0.0-beta.16 | ZK circuit language |
| Barretenberg | 3.0.0-nightly.20251104 | Proof generation backend |
| Garaga | 1.0.1 | On-chain proof verification (Cairo verifier generation) |
| React | 18.3 | Frontend framework |
| TypeScript | 5.5 | Type-safe frontend development |
| Vite | 5.4 | Frontend bundler |
| starknet.js | 6.x | Starknet wallet and contract interaction |
| OpenZeppelin Cairo | v0.20.0 | Standard contract patterns (ERC20, access control) |
| DeepSeek API | v1 | AI assistant (chat + executable DeFi actions) |
| Vercel Serverless | Node.js | API proxy for DeepSeek (keeps API key server-side) |

---

## Repository Structure

```
obscura/
├── contracts/               # Cairo smart contracts
│   ├── src/
│   │   ├── shielded_vault.cairo    # Deposit, shield, unshield
│   │   ├── shielded_cdp.cairo      # CDP lifecycle + liquidation
│   │   ├── proof_verifiers.cairo   # Garaga proof routing
│   │   ├── solvency_prover.cairo   # Protocol-wide solvency
│   │   ├── types.cairo             # Ciphertext, ProofTypes
│   │   └── interfaces.cairo        # Trait definitions
│   └── tests/                      # 117 passing tests
├── circuits/                # Noir ZK circuits (7 circuits)
│   ├── range_proof/
│   ├── balance_sufficiency/
│   ├── collateral_ratio/
│   ├── debt_update_validity/
│   ├── zero_debt/
│   ├── vault_solvency/
│   └── cdp_safety_bound/
├── frontend/                # React + TypeScript dApp
│   ├── api/
│   │   └── chat.ts          # Vercel serverless: DeepSeek API proxy
│   ├── src/
│   │   ├── pages/           # Stake, CDP, Withdraw, Proofs, Settings
│   │   ├── components/
│   │   │   └── AIChat.tsx   # Floating AI chat widget with action execution
│   │   ├── lib/ai/
│   │   │   ├── client.ts    # DeepSeek API client + system prompt
│   │   │   └── executor.ts  # 13-action executor (ZK proofs + contract txs)
│   │   ├── lib/privacy/     # ElGamal keygen, encrypt, decrypt
│   │   ├── lib/proofs/      # Noir witness, prover, Garaga calldata
│   │   └── lib/contracts/   # Contract interaction layer
│   ├── public/circuits/     # Compiled circuit artifacts + VKs
│   └── vercel.json          # API route + SPA rewrite config
├── verifier-contracts/      # Garaga-generated Cairo verifiers (7)
├── scripts/                 # Deploy, E2E tests, oracle refresh, solvency
└── docs/                    # Architecture, threat model
```



