# AGENTS.md — Obscura v1.5 Agent-Executable Instructions

> This file provides deterministic, copy-paste-ready commands for AI coding agents.

## Quick Start (Full Setup)

```bash
# 1. Clone and enter project
git clone <repo-url> obscura && cd obscura

# 2. Install Starknet toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh
source ~/.bashrc
scarb --version    # expect: scarb 2.x.x
snforge --version  # expect: snforge 0.x.x

# 3. Install Noir + Barretenberg (pinned versions)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
source ~/.bashrc
noirup --version 1.0.0-beta.16
nargo --version    # expect: 1.0.0-beta.16

curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
source ~/.bashrc
bbup --version 3.0.0-nightly.20251104
bb --version       # expect: 3.0.0-nightly.20251104

# 4. Install Garaga (Python 3.10 required)
python3.10 -m venv .venv
source .venv/bin/activate
pip install garaga==1.0.1
garaga --help

# 5. Install frontend deps
cd frontend && npm install && cd ..

# 6. Copy env
cp .env.example .env
```

## Build Commands

```bash
# Cairo contracts
cd contracts && scarb build && cd ..

# Noir circuits (all 7)
cd circuits/range_proof && nargo build && cd ../..
cd circuits/balance_sufficiency && nargo build && cd ../..
cd circuits/collateral_ratio && nargo build && cd ../..
cd circuits/debt_update_validity && nargo build && cd ../..
cd circuits/zero_debt && nargo build && cd ../..
cd circuits/vault_solvency && nargo build && cd ../..
cd circuits/cdp_safety_bound && nargo build && cd ../..

# Generate verifying keys (for each circuit)
bb write_vk -b ./circuits/range_proof/target/range_proof.json
bb write_vk -b ./circuits/balance_sufficiency/target/balance_sufficiency.json
bb write_vk -b ./circuits/collateral_ratio/target/collateral_ratio.json
bb write_vk -b ./circuits/debt_update_validity/target/debt_update_validity.json
bb write_vk -b ./circuits/zero_debt/target/zero_debt.json
bb write_vk -b ./circuits/vault_solvency/target/vault_solvency.json
bb write_vk -b ./circuits/cdp_safety_bound/target/cdp_safety_bound.json

# Generate Garaga verifier contracts
source .venv/bin/activate
garaga gen --system ultra_keccak_zk_honk --vk circuits/range_proof/target/vk --output verifier-contracts/range_proof/
garaga gen --system ultra_keccak_zk_honk --vk circuits/balance_sufficiency/target/vk --output verifier-contracts/balance_sufficiency/
garaga gen --system ultra_keccak_zk_honk --vk circuits/collateral_ratio/target/vk --output verifier-contracts/collateral_ratio/
garaga gen --system ultra_keccak_zk_honk --vk circuits/debt_update_validity/target/vk --output verifier-contracts/debt_update_validity/
garaga gen --system ultra_keccak_zk_honk --vk circuits/zero_debt/target/vk --output verifier-contracts/zero_debt/
garaga gen --system ultra_keccak_zk_honk --vk circuits/vault_solvency/target/vk --output verifier-contracts/vault_solvency/
garaga gen --system ultra_keccak_zk_honk --vk circuits/cdp_safety_bound/target/vk --output verifier-contracts/cdp_safety_bound/

# Frontend
cd frontend && npm run build && cd ..
```

## Test Commands

```bash
# Cairo contract tests
cd contracts && snforge test

# Noir circuit tests
cd circuits/range_proof && nargo test && cd ../..
cd circuits/balance_sufficiency && nargo test && cd ../..
cd circuits/collateral_ratio && nargo test && cd ../..
# ... repeat for all circuits

# Frontend tests
cd frontend && npm test
```

## Deployment Sequence (Starknet Sepolia)

```bash
# 1. Start local devnet (for testing)
starknet-devnet --seed 0 --port 5050

# 2. Declare + deploy verifier contracts first
sncast declare --contract-name UltraKeccakZKHonkVerifier --url http://localhost:5050
sncast deploy --class-hash <hash> --url http://localhost:5050

# 3. Deploy ShieldedVault
sncast declare --contract-name ShieldedVault --url http://localhost:5050
sncast deploy --class-hash <hash> --constructor-calldata <verifier_addr> <endur_addr> <tongo_addr>

# 4. Deploy ShieldedCDP
sncast declare --contract-name ShieldedCDP --url http://localhost:5050
sncast deploy --class-hash <hash> --constructor-calldata <verifier_addr> <vault_addr> <oracle_addr>

# 5. Deploy SolvencyProver
sncast declare --contract-name SolvencyProver --url http://localhost:5050
sncast deploy --class-hash <hash> --constructor-calldata <vault_addr> <cdp_addr> <verifier_addr>

# 6. Initialize parameters
sncast invoke --contract-address <vault_addr> --function initialize --calldata <MAX_DEPOSIT>
sncast invoke --contract-address <cdp_addr> --function initialize --calldata <MIN_CR=200>

# 7. Update frontend .env with deployed addresses
# 8. Deploy frontend
cd frontend && npm run build
```

## Network Config

| Network | RPC URL | Chain ID |
|---------|---------|----------|
| Devnet | http://localhost:5050 | SN_DEVNET |
| Sepolia | https://starknet-sepolia.public.blastapi.io | SN_SEPOLIA |
| Mainnet | https://starknet-mainnet.public.blastapi.io | SN_MAIN |

## Key External Contracts (Sepolia)

| Contract | Purpose | Address |
|----------|---------|---------|
| Endur Staking | BTC → xyBTC LST | TBD (check endur.fi docs) |
| Tongo Wrapper | ERC20 → Encrypted ERC20 | TBD (check docs.tongo.cash) |
| Vesu Lending | Optional yield | TBD (check vesu.xyz docs) |

## Coding Conventions

- Cairo: snake_case functions, PascalCase types, emit events on all state changes
- Noir: one circuit per Nargo workspace member, document public/private inputs
- TypeScript: strict mode, functional components, crypto in lib/ not components/
- All proofs verified BEFORE state mutation (never after)
- No hardcoded addresses — use constructor params or env vars
- Every function that touches encrypted state must have a corresponding proof type

## What Is In Scope

See CLAUDE.md section "What's In Scope (Must Ship)"

## What Is Out of Scope

- Private leverage loops
- Dark pool DEX
- Multi-strategy yield router
- Global cross-protocol solvency proofs
- Weight-blinded governance
