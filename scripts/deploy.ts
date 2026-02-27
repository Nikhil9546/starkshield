/**
 * Obscura v1.5 — Contract Deployment Script
 *
 * Deploys all protocol contracts to Starknet Sepolia via sncast.
 * Supports two modes:
 *   --mock    Deploy with MockProofVerifier (default, for testing)
 *   --real    Deploy with real ProofVerifier + declare Garaga verifiers
 *
 * Usage: npx tsx scripts/deploy.ts [--real]
 *
 * Prerequisites:
 *   - contracts built: cd contracts && scarb build
 *   - sncast account created: sncast account create --name starkshield_deployer
 *   - Account funded and deployed on Sepolia
 *   - For --real mode: verifier contracts built (cd verifier-contracts/<name> && scarb build)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const CONTRACTS_DIR = resolve(ROOT, 'contracts');
const VERIFIERS_DIR = resolve(ROOT, 'verifier-contracts');
const ENV_FILE = resolve(ROOT, '.env');

const USE_REAL_VERIFIERS = process.argv.includes('--real');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = existsSync(ENV_FILE) ? ENV_FILE : resolve(ROOT, '.env.example');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
  return env;
}

/** Run a command capturing both stdout and stderr */
function run(cmd: string, cwd: string = CONTRACTS_DIR): string {
  console.log(`  > ${cmd}`);
  return execSync(`${cmd} 2>&1`, { cwd, encoding: 'utf-8', timeout: 300000 }).trim();
}

/** Run a command and return { ok, output } — never throws */
function tryRun(cmd: string, cwd: string = CONTRACTS_DIR): { ok: boolean; output: string } {
  console.log(`  > ${cmd}`);
  try {
    const output = execSync(`${cmd} 2>&1`, { cwd, encoding: 'utf-8', timeout: 300000 }).trim();
    return { ok: true, output };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = (e.stdout || '') + '\n' + (e.stderr || '') + '\n' + (e.message || '');
    return { ok: false, output };
  }
}

function extractAddress(output: string): string {
  const match = output.match(/contract_address:\s*(0x[0-9a-fA-F]+)/);
  if (match) return match[1];
  const hexMatch = output.match(/(0x[0-9a-fA-F]{40,66})/);
  if (hexMatch) return hexMatch[1];
  throw new Error(`Could not extract address from output: ${output}`);
}

function extractClassHash(output: string): string {
  const match = output.match(/[Cc]lass[_ ][Hh]ash[:\s]+(0x[0-9a-fA-F]+)/);
  if (match) return match[1];
  throw new Error(`Could not extract class hash from: ${output.substring(0, 300)}`);
}

/** Circuit type IDs matching contracts/src/types.cairo ProofTypes */
const CIRCUIT_TYPES: Record<string, number> = {
  range_proof: 1,
  balance_sufficiency: 2,
  collateral_ratio: 3,
  debt_update_validity: 4,
  zero_debt: 5,
  vault_solvency: 6,
  cdp_safety_bound: 7,
};

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
  const accountAddr = env.DEPLOYER_ACCOUNT_ADDRESS;
  const accountName = env.SNCAST_ACCOUNT_NAME || 'starkshield_deployer';
  const accountsFile = env.SNCAST_ACCOUNTS_FILE || '/Users/nikhilkumar/.starknet_accounts/starknet_open_zeppelin_accounts.json';

  if (!accountAddr) {
    console.error('Error: DEPLOYER_ACCOUNT_ADDRESS must be set in .env');
    process.exit(1);
  }

  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  console.log('=== Obscura v1.5 Deployment ===\n');
  console.log(`Network: Sepolia`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Account: ${accountName} (${accountAddr})`);
  console.log(`Verifier Mode: ${USE_REAL_VERIFIERS ? 'REAL (Garaga)' : 'MOCK'}\n`);

  // Step 1: Build contracts
  console.log('--- Building contracts ---');
  run('scarb build');

  // Step 2: Declare all protocol contracts
  console.log('\n--- Declaring protocol contracts ---');

  const contracts = [
    'MockERC20',
    'MockProofVerifier',
    'MockPriceFeed',
    'ProofVerifier',
    'ShieldedVault',
    'ShieldedCDP',
    'SolvencyProver',
  ];

  const classHashes: Record<string, string> = {};

  for (const name of contracts) {
    console.log(`\n  Declaring ${name}...`);
    const result = tryRun(`sncast ${G} declare ${U} --contract-name ${name}`);

    try {
      classHashes[name] = extractClassHash(result.output);
      if (result.ok) {
        console.log(`    class_hash: ${classHashes[name]}`);
      } else {
        console.log(`    (already declared) class_hash: ${classHashes[name]}`);
      }
    } catch {
      console.error(`    FATAL: Could not get class hash for ${name}`);
      console.error(`    Output: ${result.output.substring(0, 300)}`);
      process.exit(1);
    }
  }

  // Step 2b: If real verifiers, declare Garaga verifier contracts
  const verifierClassHashes: Record<string, string> = {};

  if (USE_REAL_VERIFIERS) {
    console.log('\n--- Declaring Garaga verifier contracts ---');

    for (const circuit of Object.keys(CIRCUIT_TYPES)) {
      const verifierName = `${circuit}_verifier`;
      const verifierDir = resolve(VERIFIERS_DIR, verifierName);

      if (!existsSync(verifierDir)) {
        console.error(`  ERROR: ${verifierDir} not found. Run garaga gen first.`);
        process.exit(1);
      }

      console.log(`\n  Declaring ${verifierName}...`);
      // Build if needed
      tryRun(`ASDF_SCARB_VERSION=2.14.0 scarb build`, verifierDir);

      const result = tryRun(
        `sncast ${G} declare ${U} --contract-name UltraKeccakZKHonkVerifier`,
        verifierDir,
      );

      try {
        verifierClassHashes[circuit] = extractClassHash(result.output);
        console.log(`    class_hash: ${verifierClassHashes[circuit]}`);
      } catch {
        console.error(`    FATAL: Could not get class hash for ${verifierName}`);
        console.error(`    Output: ${result.output.substring(0, 300)}`);
        process.exit(1);
      }
    }
  }

  // Step 3: Deploy contracts in dependency order
  console.log('\n--- Deploying contracts ---');
  const deployed: Record<string, string> = {};

  // 3a: Deploy Mock ERC20 (as xyBTC stand-in)
  console.log('\n  Deploying MockERC20 (xyBTC)...');
  const erc20InitSupply = '0x' + (BigInt(1000000) * BigInt(10) ** BigInt(18)).toString(16);
  const erc20Output = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['MockERC20']} --constructor-calldata ${erc20InitSupply} 0 ${accountAddr}`,
  );
  deployed['MockERC20'] = extractAddress(erc20Output);
  console.log(`    address: ${deployed['MockERC20']}`);

  // 3b: Deploy verifier (mock or real)
  let verifierAddress: string;

  if (USE_REAL_VERIFIERS) {
    console.log('\n  Deploying ProofVerifier (real Garaga dispatch)...');
    const verifierOutput = run(
      `sncast ${G} deploy ${U} --class-hash ${classHashes['ProofVerifier']} --constructor-calldata ${accountAddr}`,
    );
    verifierAddress = extractAddress(verifierOutput);
    deployed['ProofVerifier'] = verifierAddress;
    console.log(`    address: ${verifierAddress}`);

    // Register all 7 verifier class hashes
    console.log('\n  Registering verifier class hashes...');
    for (const [circuit, circuitType] of Object.entries(CIRCUIT_TYPES)) {
      const ch = verifierClassHashes[circuit];
      if (!ch) {
        console.error(`    ERROR: No class hash for ${circuit}`);
        continue;
      }
      console.log(`    Setting circuit ${circuitType} (${circuit}) -> ${ch.slice(0, 18)}...`);
      run(
        `sncast ${G} invoke ${U} --contract-address ${verifierAddress} --function set_verifier_class_hash --calldata ${circuitType} ${ch}`,
      );
    }
  } else {
    console.log('\n  Deploying MockProofVerifier (should_verify=true)...');
    const mockVerifierOutput = run(
      `sncast ${G} deploy ${U} --class-hash ${classHashes['MockProofVerifier']} --constructor-calldata 1`,
    );
    verifierAddress = extractAddress(mockVerifierOutput);
    deployed['MockProofVerifier'] = verifierAddress;
    console.log(`    address: ${verifierAddress}`);
  }

  // 3c: Deploy MockPriceFeed
  console.log('\n  Deploying MockPriceFeed...');
  const price = '0x' + BigInt(50000 * 1e8).toString(16);
  const timestamp = '0x' + Math.floor(Date.now() / 1000).toString(16);
  const priceFeedOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['MockPriceFeed']} --constructor-calldata ${price} 0 ${timestamp}`,
  );
  deployed['MockPriceFeed'] = extractAddress(priceFeedOutput);
  console.log(`    address: ${deployed['MockPriceFeed']}`);

  // 3d: Deploy ShieldedVault
  console.log('\n  Deploying ShieldedVault...');
  const vaultOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['ShieldedVault']} --constructor-calldata ${accountAddr} ${deployed['MockERC20']} ${verifierAddress}`,
  );
  deployed['ShieldedVault'] = extractAddress(vaultOutput);
  console.log(`    address: ${deployed['ShieldedVault']}`);

  // 3e: Deploy ShieldedCDP
  console.log('\n  Deploying ShieldedCDP...');
  const cdpOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['ShieldedCDP']} --constructor-calldata ${accountAddr} ${deployed['MockERC20']} ${verifierAddress} ${deployed['MockPriceFeed']}`,
  );
  deployed['ShieldedCDP'] = extractAddress(cdpOutput);
  console.log(`    address: ${deployed['ShieldedCDP']}`);

  // 3f: Deploy SolvencyProver
  console.log('\n  Deploying SolvencyProver...');
  const solvencyOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['SolvencyProver']} --constructor-calldata ${accountAddr} ${verifierAddress} ${accountAddr}`,
  );
  deployed['SolvencyProver'] = extractAddress(solvencyOutput);
  console.log(`    address: ${deployed['SolvencyProver']}`);

  // Step 4: Write addresses to .env
  console.log('\n--- Updating .env ---');
  let envContent = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf-8') : '';

  const replacements: Record<string, string> = {
    'SHIELDED_VAULT_ADDRESS': deployed['ShieldedVault'],
    'SHIELDED_CDP_ADDRESS': deployed['ShieldedCDP'],
    'PROOF_VERIFIER_ADDRESS': verifierAddress,
    'SOLVENCY_PROVER_ADDRESS': deployed['SolvencyProver'],
    'PRICE_FEED_ADDRESS': deployed['MockPriceFeed'],
    'XYBTC_TOKEN_ADDRESS': deployed['MockERC20'],
    'VITE_VAULT_ADDRESS': deployed['ShieldedVault'],
    'VITE_CDP_ADDRESS': deployed['ShieldedCDP'],
    'VITE_VERIFIER_ADDRESS': verifierAddress,
    'VITE_SOLVENCY_ADDRESS': deployed['SolvencyProver'],
    'VITE_PRICE_FEED_ADDRESS': deployed['MockPriceFeed'],
    'VITE_XYBTC_ADDRESS': deployed['MockERC20'],
  };

  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  writeFileSync(ENV_FILE, envContent);
  console.log('  Addresses written to .env');

  // Step 5: Write frontend .env
  const FRONTEND_ENV = resolve(ROOT, 'frontend', '.env');
  const network = env.VITE_STARKNET_NETWORK || 'sepolia';
  const frontendEnv = [
    `VITE_STARKNET_NETWORK=${network}`,
    `VITE_VAULT_ADDRESS=${deployed['ShieldedVault']}`,
    `VITE_CDP_ADDRESS=${deployed['ShieldedCDP']}`,
    `VITE_VERIFIER_ADDRESS=${verifierAddress}`,
    `VITE_SOLVENCY_ADDRESS=${deployed['SolvencyProver']}`,
    `VITE_PRICE_FEED_ADDRESS=${deployed['MockPriceFeed']}`,
    `VITE_XYBTC_ADDRESS=${deployed['MockERC20']}`,
  ].join('\n');
  writeFileSync(FRONTEND_ENV, frontendEnv + '\n');
  console.log('  Frontend addresses written to frontend/.env');

  // Step 6: Summary
  console.log('\n=== Deployment Summary ===');
  console.log(`  Mode: ${USE_REAL_VERIFIERS ? 'REAL Garaga Verifiers' : 'Mock Verifiers'}`);
  for (const [name, address] of Object.entries(deployed)) {
    console.log(`  ${name}: ${address}`);
  }
  if (USE_REAL_VERIFIERS) {
    console.log('\n  Verifier Class Hashes:');
    for (const [circuit, ch] of Object.entries(verifierClassHashes)) {
      console.log(`    ${circuit} (type ${CIRCUIT_TYPES[circuit]}): ${ch}`);
    }
  }
  console.log('\nDeployment complete!');
}

main().catch((err) => {
  console.error('Deployment failed:', err.message || err);
  process.exit(1);
});
