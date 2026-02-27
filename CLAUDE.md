# Obscura v1.5 — Claude Code Configuration

## Project Overview
Obscura v1.5 is a privacy-preserving BTC DeFi protocol on Starknet. Users bridge BTC, deposit into ShieldedVault (which stakes via Endur and mints xyBTC), wrap into sxyBTC (encrypted balances via Tongo's ElGamal encryption), optionally supply to Vesu lending, open private CDPs using sxyBTC as collateral to mint shielded stablecoin sUSD, and withdraw/unshield back to public assets.

Privacy stack: ElGamal encrypted balances (Tongo) + ZK proofs (Noir circuits) verified on-chain via Garaga.

## Architecture Summary
- **Cairo Contracts** (Starknet): ShieldedVault, ShieldedCDP, ProofVerifiers, SolvencyProver
- **ZK Circuits** (Noir): range_proof, balance_sufficiency, collateral_ratio, debt_update_validity, zero_debt, vault_solvency, cdp_safety_bound
- **Frontend** (React/TypeScript + Vite): Stake, CDP, Withdraw, Proofs Dashboard, Settings
- **Client Privacy Engine** (TypeScript): ElGamal keygen, encrypt/decrypt, Noir witness generation, proof generation pipeline

## What's In Scope (Must Ship)
- ShieldedVault: deposit, stake, mint sxyBTC, withdraw, unshield
- ShieldedCDP: lock collateral (sxyBTC), mint sUSD, repay, close
- Bounded liquidation model (Mode A: Disclosure-on-Liquidation)
- Proof system: local proving + on-chain verification via Garaga
- Solvency: per-domain (Vault + CDP) — NOT global cross-protocol
- Frontend dApp: /stake, /cdp, /withdraw, /proofs, /settings
- Dev tooling: deploy scripts, fixtures, CI, unit + integration + adversarial tests

## What's Out of Scope (Do NOT Build)
- Private leverage loops
- Dark pool DEX
- Multi-strategy yield router
- Global cross-protocol solvency proofs
- Weight-blinded governance

## Optional (Ship If Time)
- VesuAdapter for supplying vault reserves
- Semaphore identity for governance (read-only UI)

---

## Technology Stack & Versions

### Cairo / Starknet
- **Scarb**: Latest stable (install via starkup)
- **Starknet Foundry** (snforge/sncast): Latest stable
- **Starknet Devnet**: For local testing
- **OpenZeppelin Cairo Contracts**: For standard patterns (ERC20, access control)
- **Network**: Starknet Sepolia testnet first

### Noir (ZK Circuits)
- **Nargo**: `1.0.0-beta.16` (must match Garaga compatibility)
- **Barretenberg (bb)**: `3.0.0-nightly.20251104` (must match Garaga)
- Circuits compile to ACIR → UltraKeccakZKHonk proofs

### Garaga (On-Chain Verification)
- **garaga pip package**: `1.0.1` (Python 3.10 REQUIRED)
- **garaga npm package**: For frontend calldata generation
- Generates Cairo verifier contracts from Noir verification keys
- CLI: `garaga gen --system ultra_keccak_zk_honk --vk <path>`

### Frontend
- **React 18+** with TypeScript
- **Vite** for bundling
- **starknet.js** for wallet connection and contract interaction
- **@noir-lang/noir_js** + **@aztec/bb.js** for in-browser proof generation
- **garaga** npm package for calldata encoding
- **TailwindCSS** for styling

### External Protocol Integrations
- **Endur** (https://app.endur.fi): Liquid staking, mints xyBTC LSTs from wrapped BTC
- **Tongo** (https://docs.tongo.cash): Confidential ERC20 wrapper using ElGamal encryption
- **Vesu** (optional): Lending protocol on Starknet

---

## Repository Structure

```
obscura/
├── CLAUDE.md                    # THIS FILE
├── AGENTS.md                    # Agent-executable instructions
├── README.md                    # Project documentation
├── .env.example                 # Environment template
│
├── contracts/                   # Cairo smart contracts
│   ├── Scarb.toml
│   ├── src/
│   │   ├── lib.cairo
│   │   ├── shielded_vault.cairo
│   │   ├── shielded_cdp.cairo
│   │   ├── proof_verifiers.cairo
│   │   ├── solvency_prover.cairo
│   │   ├── types.cairo          # Ciphertext, CipherDelta, Proof types
│   │   ├── interfaces.cairo     # Trait definitions
│   │   ├── constants.cairo      # MIN_CR, MAX_DEPOSIT, etc.
│   │   └── vesu_adapter.cairo   # Optional
│   └── tests/
│       ├── test_vault.cairo
│       ├── test_cdp.cairo
│       ├── test_solvency.cairo
│       └── test_adversarial.cairo
│
├── circuits/                    # Noir ZK circuits
│   ├── Nargo.toml
│   ├── range_proof/
│   │   └── src/main.nr
│   ├── balance_sufficiency/
│   │   └── src/main.nr
│   ├── collateral_ratio/
│   │   └── src/main.nr
│   ├── debt_update_validity/
│   │   └── src/main.nr
│   ├── zero_debt/
│   │   └── src/main.nr
│   ├── vault_solvency/
│   │   └── src/main.nr
│   └── cdp_safety_bound/
│       └── src/main.nr
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── pages/
│       │   ├── StakePage.tsx      # /stake
│       │   ├── CDPPage.tsx        # /cdp
│       │   ├── WithdrawPage.tsx   # /withdraw
│       │   ├── ProofsPage.tsx     # /proofs
│       │   └── SettingsPage.tsx   # /settings
│       ├── components/
│       │   ├── WalletConnect.tsx
│       │   ├── ProofProgress.tsx
│       │   ├── BalanceDisplay.tsx
│       │   └── SolvencyCard.tsx
│       ├── lib/
│       │   ├── privacy/
│       │   │   ├── keygen.ts       # ElGamal keypair generation
│       │   │   ├── encrypt.ts      # Amount encryption
│       │   │   ├── decrypt.ts      # Amount decryption
│       │   │   └── storage.ts      # Secure key storage
│       │   ├── proofs/
│       │   │   ├── witness.ts      # Witness generation
│       │   │   ├── prover.ts       # Proof generation (noir_js + bb.js)
│       │   │   ├── calldata.ts     # Garaga calldata packaging
│       │   │   └── circuits.ts     # Circuit loading
│       │   └── contracts/
│       │       ├── vault.ts        # ShieldedVault contract calls
│       │       ├── cdp.ts          # ShieldedCDP contract calls
│       │       └── config.ts       # Contract addresses, ABIs
│       └── hooks/
│           ├── useWallet.ts
│           ├── useProof.ts
│           └── useBalance.ts
│
├── scripts/
│   ├── deploy.ts                # Contract deployment (sncast)
│   ├── seed-fixtures.ts         # Test data seeding
│   └── generate-vks.ts          # Generate verifying keys from circuits
│
├── verifier-contracts/          # Generated by Garaga CLI
│   └── (auto-generated Cairo verifier contracts)
│
└── docs/
    ├── architecture.md
    ├── threat-model.md
    └── deployment-guide.md
```

---

## Coding Conventions

### Cairo
- Use snake_case for functions and variables
- Use PascalCase for types, structs, enums, traits
- Every public function must emit an event
- All state-changing functions require proof verification BEFORE state mutation
- Use `assert!` with descriptive error messages
- Component pattern for reusable logic (OpenZeppelin style)
- Group related storage under clearly named sections

### Noir
- Each circuit is its own Nargo workspace member
- Public inputs clearly documented in comments
- Private inputs (witnesses) never exposed
- Use `assert()` for constraints
- Include `#[test]` functions for each circuit
- Pin exact Noir/BB versions in Nargo.toml

### TypeScript/React
- Strict TypeScript (`strict: true`)
- Functional components with hooks only
- All crypto operations in `lib/privacy/` and `lib/proofs/`
- Never store private keys in plaintext — use encrypted browser storage
- Show proof generation progress with percentage/status
- Error boundaries around proof generation with retry + debug hints

### General
- No `console.log` in production code (use structured logger)
- All secrets via environment variables
- Deterministic, reproducible builds
- Every PR must pass: contract tests, circuit tests, frontend build

---

## Key Design Decisions (Pre-Made)

| Decision | Choice |
|----------|--------|
| Liquidation mode | Mode A: Disclosure-on-Liquidation |
| Oracle interface | Simple price feed contract; mint pauses if stale |
| Ciphertext accumulator | Incremental with periodic proof batching |
| MIN_CR | 200% (hardcoded for v1.5, not governance-controlled) |
| Proof system | Noir → UltraKeccakZKHonk → Garaga Cairo verifier |
| Solvency scope | Per-domain only (Vault + CDP separately) |
| Frontend proving | In-browser via noir_js + bb.js (client-side) |

---

## Implementation Order (Dependency Chain)

### Phase 1: Scaffold + Tooling
1. Initialize repo structure
2. Set up Scarb.toml with OpenZeppelin Cairo deps
3. Set up Nargo.toml workspace for all 7 circuits
4. Set up frontend with Vite + React + starknet.js
5. Write AGENTS.md with local dev commands

### Phase 2: Circuits + Verifiers
6. Implement all 7 Noir circuits with tests
7. Compile circuits, generate verifying keys
8. Use Garaga CLI to generate Cairo verifier contracts
9. Deploy verifiers to devnet and test

### Phase 3: ShieldedVault
10. Implement types.cairo (Ciphertext, CipherDelta, etc.)
11. Implement ShieldedVault.cairo
12. Write vault unit tests (deposit, withdraw, unshield)
13. Write adversarial tests (replay proofs, malformed ciphertext)

### Phase 4: ShieldedCDP
14. Implement ShieldedCDP.cairo
15. Implement liquidation Mode A logic
16. Write CDP unit tests (open, lock, mint, repay, close)
17. Write liquidation window tests

### Phase 5: Solvency
18. Implement SolvencyProver.cairo
19. Implement vault_solvency + cdp_safety_bound circuit integration
20. Test on-chain solvency proof verification

### Phase 6: Frontend
21. Implement Client Privacy Engine (keygen, encrypt, decrypt)
22. Implement proof generation pipeline (witness → prove → calldata)
23. Build /stake page flow
24. Build /cdp page flow
25. Build /withdraw page flow
26. Build /proofs dashboard
27. Build /settings (key backup/restore)

### Phase 7: E2E + Deploy
28. Integration tests: deposit → sxyBTC → CDP → sUSD → repay → close → withdraw
29. Deploy to Starknet Sepolia
30. Record demo

---

## Local Development Commands

```bash
# === INSTALL TOOLCHAIN ===
# Starknet tools (Scarb + Foundry + Devnet)
curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh

# Noir + Barretenberg (specific versions for Garaga compatibility)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
noirup --version 1.0.0-beta.16
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
bbup --version 3.0.0-nightly.20251104

# Garaga (Python 3.10 required)
python3.10 -m venv .venv
source .venv/bin/activate
pip install garaga==1.0.1

# Frontend
cd frontend && npm install

# === BUILD ===
# Compile Cairo contracts
cd contracts && scarb build

# Compile Noir circuits
cd circuits && nargo build

# Generate verifying keys
cd circuits && bb write_vk -b ./target/<circuit>.json

# Generate Garaga verifier contracts
garaga gen --system ultra_keccak_zk_honk --vk ./circuits/target/vk --output ./verifier-contracts/

# === TEST ===
# Cairo contract tests
cd contracts && snforge test

# Noir circuit tests
cd circuits && nargo test

# Frontend
cd frontend && npm run build && npm run test

# === DEPLOY (Sepolia) ===
cd scripts && npx ts-node deploy.ts

# === LOCAL DEVNET ===
starknet-devnet --seed 0
```

---

## Environment Variables (.env.example)

```env
# Starknet
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
DEPLOYER_PRIVATE_KEY=
DEPLOYER_ACCOUNT_ADDRESS=

# Contract Addresses (filled after deployment)
SHIELDED_VAULT_ADDRESS=
SHIELDED_CDP_ADDRESS=
PROOF_VERIFIER_ADDRESS=
SOLVENCY_PROVER_ADDRESS=

# Oracle
PRICE_FEED_ADDRESS=

# Endur Integration
ENDUR_STAKING_ADDRESS=
XYBCT_TOKEN_ADDRESS=

# Tongo Integration
TONGO_WRAPPER_ADDRESS=

# Frontend
VITE_STARKNET_NETWORK=sepolia
VITE_VAULT_ADDRESS=
VITE_CDP_ADDRESS=
```

---

## Security Invariants (Must Always Hold)

1. Encrypted balance NEVER underflows — enforced by balance_sufficiency proof
2. Only valid proofs can change ciphertext state — verifier checks before state mutation
3. CDP collateral ratio ALWAYS ≥ MIN_CR (200%) — enforced by collateral_ratio proof
4. Position can only close with zero_debt proof
5. Solvency proofs are per-domain — no cross-domain coupling
6. Oracle staleness → mint pauses automatically
7. Proof domain separation — each proof type has unique verifier key ID
8. No replay attacks — nullifiers or nonce-based commitment hashes

---

## Testing Requirements

### Must Pass (Acceptance Criteria)
- [ ] User can deposit + see decrypted balance locally
- [ ] User can mint sUSD with valid collateral proof
- [ ] Invalid proofs always revert
- [ ] Vault solvency proof verifies on-chain
- [ ] CDP safety bound proof verifies on-chain
- [ ] Clean deploy to Sepolia with docs + scripts

### Adversarial Tests
- [ ] Replay proof attempt → revert
- [ ] Malformed ciphertext → revert
- [ ] Oracle stale data → mint paused
- [ ] Liquidation window timeout → conservative seizure
