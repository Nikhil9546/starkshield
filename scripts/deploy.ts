/**
 * StarkShield v1.5 — Contract Deployment Script
 *
 * Deploys all protocol contracts to Starknet Sepolia via sncast.
 * Usage: npx tsx scripts/deploy.ts
 *
 * Prerequisites:
 *   - contracts built: cd contracts && scarb build
 *   - sncast account created: sncast account create --name starkshield_deployer
 *   - Account funded and deployed on Sepolia
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const CONTRACTS_DIR = resolve(ROOT, 'contracts');
const ENV_FILE = resolve(ROOT, '.env');

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
  // Redirect stderr to stdout so we capture everything
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
  // Match "Class Hash: 0x..." or "class_hash: 0x..." or "class hash 0x..."
  const match = output.match(/[Cc]lass[_ ][Hh]ash[:\s]+(0x[0-9a-fA-F]+)/);
  if (match) return match[1];
  throw new Error(`Could not extract class hash from: ${output.substring(0, 300)}`);
}

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

  // sncast v0.56 syntax:
  //   Global flags: --account <name> --accounts-file <path> --wait
  //   Subcommand flags: --url <url> --contract-name <name> etc.
  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  console.log('=== StarkShield v1.5 Deployment ===\n');
  console.log(`Network: Sepolia`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Account: ${accountName} (${accountAddr})\n`);

  // Step 1: Build contracts
  console.log('--- Building contracts ---');
  run('scarb build');

  // Step 2: Declare all contracts (with --wait to avoid nonce issues)
  console.log('\n--- Declaring contracts ---');

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

  // Step 3: Deploy contracts in dependency order (with --wait)
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

  // 3b: Deploy MockProofVerifier (should_verify = true)
  console.log('\n  Deploying MockProofVerifier (should_verify=true)...');
  const mockVerifierOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['MockProofVerifier']} --constructor-calldata 1`,
  );
  deployed['MockProofVerifier'] = extractAddress(mockVerifierOutput);
  console.log(`    address: ${deployed['MockProofVerifier']}`);

  // 3c: Deploy MockPriceFeed
  console.log('\n  Deploying MockPriceFeed...');
  const price = '0x' + BigInt(50000 * 1e8).toString(16); // $50,000 with 8 decimals
  const timestamp = '0x' + Math.floor(Date.now() / 1000).toString(16);
  const priceFeedOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['MockPriceFeed']} --constructor-calldata ${price} 0 ${timestamp}`,
  );
  deployed['MockPriceFeed'] = extractAddress(priceFeedOutput);
  console.log(`    address: ${deployed['MockPriceFeed']}`);

  // 3d: Deploy ShieldedVault (uses MockProofVerifier)
  console.log('\n  Deploying ShieldedVault...');
  const vaultOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['ShieldedVault']} --constructor-calldata ${accountAddr} ${deployed['MockERC20']} ${deployed['MockProofVerifier']}`,
  );
  deployed['ShieldedVault'] = extractAddress(vaultOutput);
  console.log(`    address: ${deployed['ShieldedVault']}`);

  // 3e: Deploy ShieldedCDP (uses MockProofVerifier + MockPriceFeed)
  console.log('\n  Deploying ShieldedCDP...');
  const cdpOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['ShieldedCDP']} --constructor-calldata ${accountAddr} ${deployed['MockERC20']} ${deployed['MockProofVerifier']} ${deployed['MockPriceFeed']}`,
  );
  deployed['ShieldedCDP'] = extractAddress(cdpOutput);
  console.log(`    address: ${deployed['ShieldedCDP']}`);

  // 3f: Deploy SolvencyProver (uses MockProofVerifier)
  console.log('\n  Deploying SolvencyProver...');
  const solvencyOutput = run(
    `sncast ${G} deploy ${U} --class-hash ${classHashes['SolvencyProver']} --constructor-calldata ${accountAddr} ${deployed['MockProofVerifier']} ${accountAddr}`,
  );
  deployed['SolvencyProver'] = extractAddress(solvencyOutput);
  console.log(`    address: ${deployed['SolvencyProver']}`);

  // Step 4: Write addresses to .env
  console.log('\n--- Updating .env ---');
  let envContent = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf-8') : '';

  const replacements: Record<string, string> = {
    'SHIELDED_VAULT_ADDRESS': deployed['ShieldedVault'],
    'SHIELDED_CDP_ADDRESS': deployed['ShieldedCDP'],
    'PROOF_VERIFIER_ADDRESS': deployed['MockProofVerifier'],
    'SOLVENCY_PROVER_ADDRESS': deployed['SolvencyProver'],
    'PRICE_FEED_ADDRESS': deployed['MockPriceFeed'],
    'XYBTC_TOKEN_ADDRESS': deployed['MockERC20'],
    'VITE_VAULT_ADDRESS': deployed['ShieldedVault'],
    'VITE_CDP_ADDRESS': deployed['ShieldedCDP'],
    'VITE_VERIFIER_ADDRESS': deployed['MockProofVerifier'],
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
    `VITE_VERIFIER_ADDRESS=${deployed['MockProofVerifier']}`,
    `VITE_SOLVENCY_ADDRESS=${deployed['SolvencyProver']}`,
    `VITE_PRICE_FEED_ADDRESS=${deployed['MockPriceFeed']}`,
    `VITE_XYBTC_ADDRESS=${deployed['MockERC20']}`,
  ].join('\n');
  writeFileSync(FRONTEND_ENV, frontendEnv + '\n');
  console.log('  Frontend addresses written to frontend/.env');

  // Step 6: Summary
  console.log('\n=== Deployment Summary ===');
  for (const [name, address] of Object.entries(deployed)) {
    console.log(`  ${name}: ${address}`);
  }
  console.log('\nDeployment complete!');
}

main().catch((err) => {
  console.error('Deployment failed:', err.message || err);
  process.exit(1);
});
