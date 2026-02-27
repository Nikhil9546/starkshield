#!/bin/bash
# ===========================================================
# Obscura v1.5 — Full Development Environment Setup
# ===========================================================
# Run: chmod +x setup.sh && ./setup.sh
# Requires: Linux/macOS, curl, git, Python 3.10, Node.js 18+

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }

# -----------------------------------------------------------
section "1/7 — Prerequisites Check"
# -----------------------------------------------------------

command -v git >/dev/null 2>&1 || { err "git not found. Install git first."; exit 1; }
command -v curl >/dev/null 2>&1 || { err "curl not found. Install curl first."; exit 1; }
command -v node >/dev/null 2>&1 || { err "Node.js not found. Install Node.js 18+ first."; exit 1; }

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
    err "Node.js 18+ required. Found: $(node -v)"
    exit 1
fi
log "Node.js $(node -v) found"

# Check Python 3.10
if command -v python3.10 >/dev/null 2>&1; then
    log "Python 3.10 found"
    PYTHON_CMD="python3.10"
elif python3 --version 2>&1 | grep -q "3.10"; then
    log "Python 3.10 found (as python3)"
    PYTHON_CMD="python3"
else
    warn "Python 3.10 not found. Garaga requires Python 3.10 specifically."
    warn "Install it: sudo apt install python3.10 python3.10-venv (Ubuntu)"
    warn "Or: brew install python@3.10 (macOS)"
    PYTHON_CMD=""
fi

# -----------------------------------------------------------
section "2/7 — Install Starknet Toolchain (Scarb + Foundry + Devnet)"
# -----------------------------------------------------------

if command -v scarb >/dev/null 2>&1; then
    log "Scarb already installed: $(scarb --version 2>&1 | head -1)"
else
    log "Installing Starknet toolchain via starkup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    source "$HOME/.bashrc" 2>/dev/null || true
    log "Scarb installed: $(scarb --version 2>&1 | head -1)"
fi

if command -v snforge >/dev/null 2>&1; then
    log "Starknet Foundry already installed: $(snforge --version 2>&1 | head -1)"
else
    warn "snforge not found — may need to restart terminal after starkup"
fi

# -----------------------------------------------------------
section "3/7 — Install Noir + Barretenberg (Pinned Versions)"
# -----------------------------------------------------------

NOIR_TARGET="1.0.0-beta.16"
BB_TARGET="3.0.0-nightly.20251104"

if command -v nargo >/dev/null 2>&1; then
    CURRENT_NARGO=$(nargo --version 2>&1 | head -1)
    log "Nargo found: $CURRENT_NARGO"
    if ! echo "$CURRENT_NARGO" | grep -q "$NOIR_TARGET"; then
        warn "Version mismatch. Need $NOIR_TARGET for Garaga compatibility."
        warn "Run: noirup --version $NOIR_TARGET"
    fi
else
    log "Installing noirup..."
    curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
    export PATH="$HOME/.nargo/bin:$PATH"
    source "$HOME/.bashrc" 2>/dev/null || true
    log "Installing Nargo $NOIR_TARGET..."
    noirup --version "$NOIR_TARGET"
fi

if command -v bb >/dev/null 2>&1; then
    CURRENT_BB=$(bb --version 2>&1 | head -1)
    log "Barretenberg found: $CURRENT_BB"
    if ! echo "$CURRENT_BB" | grep -q "$BB_TARGET"; then
        warn "Version mismatch. Need $BB_TARGET for Garaga compatibility."
        warn "Run: bbup --version $BB_TARGET"
    fi
else
    log "Installing bbup..."
    curl -fsSL https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
    export PATH="$HOME/.bb:$PATH"
    source "$HOME/.bashrc" 2>/dev/null || source "$HOME/.zshrc" 2>/dev/null || true
    log "Installing Barretenberg (auto-matching Nargo version)..."
    bbup
fi

# -----------------------------------------------------------
section "4/7 — Install Garaga (Python 3.10 venv)"
# -----------------------------------------------------------

if [ -n "$PYTHON_CMD" ]; then
    if [ ! -d ".venv" ]; then
        log "Creating Python 3.10 virtual environment..."
        $PYTHON_CMD -m venv .venv
    fi
    source .venv/bin/activate
    log "Installing Garaga 1.0.1..."
    pip install --quiet garaga==1.0.1
    log "Garaga installed: $(garaga --version 2>&1 || echo 'installed')"
    deactivate
else
    warn "Skipping Garaga installation (Python 3.10 not found)"
fi

# -----------------------------------------------------------
section "5/7 — Clone Required Repos & References"
# -----------------------------------------------------------

mkdir -p references

# Garaga (for reference and Cairo library usage)
if [ ! -d "references/garaga" ]; then
    log "Cloning Garaga repo (reference)..."
    git clone --depth 1 https://github.com/keep-starknet-strange/garaga.git references/garaga
else
    log "Garaga reference already cloned"
fi

# OpenZeppelin Cairo Contracts (for ERC20, access patterns)
if [ ! -d "references/openzeppelin-cairo" ]; then
    log "Cloning OpenZeppelin Cairo Contracts (reference)..."
    git clone --depth 1 https://github.com/OpenZeppelin/cairo-contracts.git references/openzeppelin-cairo
else
    log "OpenZeppelin Cairo reference already cloned"
fi

# Scaffold-Garaga (Noir+Garaga+Starknet starter reference)
if [ ! -d "references/scaffold-garaga" ]; then
    log "Cloning scaffold-garaga (reference starter)..."
    git clone --depth 1 https://github.com/KevinSheeranxyj/scaffold-garaga.git references/scaffold-garaga
else
    log "scaffold-garaga reference already cloned"
fi

# -----------------------------------------------------------
section "6/7 — Scaffold Project Structure"
# -----------------------------------------------------------

# Contracts
mkdir -p contracts/src contracts/tests
if [ ! -f "contracts/Scarb.toml" ]; then
    cat > contracts/Scarb.toml << 'EOF'
[package]
name = "obscura"
version = "0.1.0"
edition = "2024_07"
cairo-version = "2.11.4"

[dependencies]
starknet = "2.11.4"
openzeppelin_token = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v0.20.0" }
openzeppelin_access = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v0.20.0" }

[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.45.0" }

[[target.starknet-contract]]
sierra = true
casm = true
EOF
    log "Created contracts/Scarb.toml"
fi

if [ ! -f "contracts/src/lib.cairo" ]; then
    cat > contracts/src/lib.cairo << 'EOF'
mod types;
mod constants;
mod interfaces;
mod shielded_vault;
mod shielded_cdp;
mod proof_verifiers;
mod solvency_prover;
EOF
    log "Created contracts/src/lib.cairo"
fi

# Create placeholder Cairo files
for file in types constants interfaces shielded_vault shielded_cdp proof_verifiers solvency_prover; do
    if [ ! -f "contracts/src/${file}.cairo" ]; then
        echo "// Obscura v1.5 — ${file}" > "contracts/src/${file}.cairo"
        echo "// TODO: Implement per PRD spec" >> "contracts/src/${file}.cairo"
    fi
done
log "Cairo contract stubs created"

# Circuits
CIRCUITS="range_proof balance_sufficiency collateral_ratio debt_update_validity zero_debt vault_solvency cdp_safety_bound"
for circuit in $CIRCUITS; do
    mkdir -p "circuits/${circuit}/src"
    if [ ! -f "circuits/${circuit}/Nargo.toml" ]; then
        cat > "circuits/${circuit}/Nargo.toml" << EOF
[package]
name = "${circuit}"
type = "bin"
authors = ["Obscura"]
compiler_version = ">=1.0.0-beta.16"

[dependencies]
EOF
    fi
    if [ ! -f "circuits/${circuit}/src/main.nr" ]; then
        cat > "circuits/${circuit}/src/main.nr" << EOF
// Obscura v1.5 — ${circuit} circuit
// TODO: Implement per PRD spec section 6

fn main() {
    // Placeholder
    assert(1 == 1);
}

#[test]
fn test_placeholder() {
    main();
}
EOF
    fi
done
log "Noir circuit stubs created (7 circuits)"

# Frontend
mkdir -p frontend/src/{pages,components,lib/{privacy,proofs,contracts},hooks}
if [ ! -f "frontend/package.json" ]; then
    cat > frontend/package.json << 'EOF'
{
  "name": "obscura-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.20.0",
    "starknet": "^6.0.0",
    "get-starknet-core": "^4.0.0",
    "@noir-lang/noir_js": "1.0.0-beta.16",
    "@aztec/bb.js": "3.0.0-nightly.20251104",
    "garaga": "^1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
EOF
    log "Created frontend/package.json"
fi

if [ ! -f "frontend/vite.config.ts" ]; then
    cat > frontend/vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    exclude: ['@noir-lang/noir_js', '@aztec/bb.js'],
  },
});
EOF
    log "Created frontend/vite.config.ts"
fi

if [ ! -f "frontend/tsconfig.json" ]; then
    cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
EOF
    log "Created frontend/tsconfig.json"
fi

# Scripts
mkdir -p scripts
for script in deploy seed-fixtures generate-vks; do
    if [ ! -f "scripts/${script}.ts" ]; then
        echo "// Obscura v1.5 — ${script}" > "scripts/${script}.ts"
        echo "// TODO: Implement" >> "scripts/${script}.ts"
    fi
done
log "Script stubs created"

# Verifier contracts output dir
mkdir -p verifier-contracts
log "Verifier contracts output directory created"

# Docs
mkdir -p docs
for doc in architecture threat-model deployment-guide; do
    if [ ! -f "docs/${doc}.md" ]; then
        echo "# ${doc}" > "docs/${doc}.md"
        echo "TODO: Write documentation" >> "docs/${doc}.md"
    fi
done
log "Documentation stubs created"

# .env.example
if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
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
XYBTC_TOKEN_ADDRESS=

# Tongo Integration
TONGO_WRAPPER_ADDRESS=

# Frontend
VITE_STARKNET_NETWORK=sepolia
VITE_VAULT_ADDRESS=
VITE_CDP_ADDRESS=
EOF
    log "Created .env.example"
fi

# .gitignore
if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.venv/

# Build outputs
contracts/target/
circuits/*/target/
frontend/dist/
verifier-contracts/*/target/

# Environment
.env
.secrets

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# References (cloned repos)
references/
EOF
    log "Created .gitignore"
fi

# -----------------------------------------------------------
section "7/7 — Setup Complete"
# -----------------------------------------------------------

echo ""
log "Obscura v1.5 development environment is ready!"
echo ""
echo -e "${CYAN}Project Structure:${NC}"
echo "  contracts/     — Cairo smart contracts (Scarb)"
echo "  circuits/      — Noir ZK circuits (7 circuits)"
echo "  frontend/      — React + TypeScript + Vite"
echo "  scripts/       — Deploy, fixtures, VK generation"
echo "  references/    — Garaga, OpenZeppelin, scaffold-garaga"
echo "  docs/          — Architecture, threat model, deployment"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Implement Noir circuits (circuits/*/src/main.nr)"
echo "  2. Compile: cd circuits/<name> && nargo build"
echo "  3. Generate VKs: bb write_vk -b ./target/<name>.json"
echo "  4. Generate verifiers: garaga gen --system ultra_keccak_zk_honk --vk target/vk"
echo "  5. Implement Cairo contracts (contracts/src/)"
echo "  6. Test: cd contracts && snforge test"
echo "  7. Build frontend: cd frontend && npm install && npm run dev"
echo ""
echo -e "${CYAN}Claude Code:${NC}"
echo "  CLAUDE.md is configured as the system prompt."
echo "  AGENTS.md has all executable commands."
echo "  Run: claude --project-dir . to start coding with context."
echo ""
warn "Version Pinning Critical: Noir=$NOIR_TARGET, BB=$BB_TARGET, Garaga=1.0.1"
warn "These versions MUST match for proof generation ↔ verification compatibility."
