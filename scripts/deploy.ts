/**
 * StarkShield v1.5 — Contract Deployment Script
 *
 * Deploys all protocol contracts to Starknet Sepolia via sncast.
 * Usage: npx ts-node scripts/deploy.ts
 *
 * Prerequisites:
 *   - contracts built: cd contracts && scarb build
 *   - sncast configured with deployer account
 *   - .env populated with DEPLOYER_PRIVATE_KEY and DEPLOYER_ACCOUNT_ADDRESS
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const CONTRACTS_DIR = resolve(ROOT, 'contracts');
const ENV_FILE = resolve(ROOT, '.env');

// Load environment
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

function run(cmd: string, cwd: string = CONTRACTS_DIR): string {
  console.log(`> ${cmd}`);
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 120000 }).trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    console.error('Command failed:', error.stderr || error.message);
    throw err;
  }
}

function extractAddress(output: string): string {
  // sncast deploy outputs "contract_address: 0x..."
  const match = output.match(/contract_address:\s*(0x[0-9a-fA-F]+)/);
  if (match) return match[1];
  // Fallback: look for any hex address in output
  const hexMatch = output.match(/(0x[0-9a-fA-F]{40,66})/);
  if (hexMatch) return hexMatch[1];
  throw new Error(`Could not extract address from output: ${output}`);
}

function extractClassHash(output: string): string {
  const match = output.match(/class_hash:\s*(0x[0-9a-fA-F]+)/);
  if (match) return match[1];
  const hexMatch = output.match(/(0x[0-9a-fA-F]{40,66})/);
  if (hexMatch) return hexMatch[1];
  throw new Error(`Could not extract class hash from output: ${output}`);
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io';
  const accountAddr = env.DEPLOYER_ACCOUNT_ADDRESS;
  const privateKey = env.DEPLOYER_PRIVATE_KEY;

  if (!accountAddr || !privateKey) {
    console.error('Error: DEPLOYER_ACCOUNT_ADDRESS and DEPLOYER_PRIVATE_KEY must be set in .env');
    process.exit(1);
  }

  const sncastFlags = `--url ${rpcUrl} --account-address ${accountAddr} --private-key ${privateKey}`;

  console.log('=== StarkShield v1.5 Deployment ===\n');
  console.log(`Network: Sepolia`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Deployer: ${accountAddr}\n`);

  // Step 1: Build contracts
  console.log('--- Building contracts ---');
  run('scarb build');

  // Step 2: Declare all contracts
  console.log('\n--- Declaring contracts ---');

  const contracts = [
    'MockERC20',
    'MockProofVerifier',
    'MockPriceFeed',
    'ProofVerifiers',
    'ShieldedVault',
    'ShieldedCDP',
    'SolvencyProver',
  ];

  const classHashes: Record<string, string> = {};

  for (const name of contracts) {
    console.log(`\nDeclaring ${name}...`);
    try {
      const output = run(
        `sncast ${sncastFlags} declare --contract-name ${name}`,
      );
      classHashes[name] = extractClassHash(output);
      console.log(`  class_hash: ${classHashes[name]}`);
    } catch {
      console.log(`  (may already be declared, continuing...)`);
    }
  }

  // Step 3: Deploy contracts in dependency order
  console.log('\n--- Deploying contracts ---');
  const deployed: Record<string, string> = {};

  // 3a: Deploy Mock ERC20 (as xyBTC stand-in)
  console.log('\nDeploying MockERC20 (xyBTC)...');
  const erc20InitSupply = '0x' + (BigInt(1000000) * BigInt(10) ** BigInt(18)).toString(16);
  const erc20Output = run(
    `sncast ${sncastFlags} deploy --class-hash ${classHashes['MockERC20']} --constructor-calldata ${erc20InitSupply} 0 ${accountAddr}`,
  );
  deployed['MockERC20'] = extractAddress(erc20Output);
  console.log(`  address: ${deployed['MockERC20']}`);

  // 3b: Deploy ProofVerifiers
  console.log('\nDeploying ProofVerifiers...');
  const verifierOutput = run(
    `sncast ${sncastFlags} deploy --class-hash ${classHashes['ProofVerifiers']} --constructor-calldata ${accountAddr}`,
  );
  deployed['ProofVerifiers'] = extractAddress(verifierOutput);
  console.log(`  address: ${deployed['ProofVerifiers']}`);

  // 3c: Deploy MockPriceFeed
  console.log('\nDeploying MockPriceFeed...');
  const price = '0x' + BigInt(50000 * 1e8).toString(16); // $50,000 with 8 decimals
  const timestamp = '0x' + Math.floor(Date.now() / 1000).toString(16);
  const priceFeedOutput = run(
    `sncast ${sncastFlags} deploy --class-hash ${classHashes['MockPriceFeed']} --constructor-calldata ${price} 0 ${timestamp}`,
  );
  deployed['MockPriceFeed'] = extractAddress(priceFeedOutput);
  console.log(`  address: ${deployed['MockPriceFeed']}`);

  // 3d: Deploy ShieldedVault
  console.log('\nDeploying ShieldedVault...');
  const vaultOutput = run(
    `sncast ${sncastFlags} deploy --class-hash ${classHashes['ShieldedVault']} --constructor-calldata ${accountAddr} ${deployed['MockERC20']} ${deployed['ProofVerifiers']}`,
  );
  deployed['ShieldedVault'] = extractAddress(vaultOutput);
  console.log(`  address: ${deployed['ShieldedVault']}`);

  // 3e: Deploy ShieldedCDP
  console.log('\nDeploying ShieldedCDP...');
  const cdpOutput = run(
    `sncast ${sncastFlags} deploy --class-hash ${classHashes['ShieldedCDP']} --constructor-calldata ${accountAddr} ${deployed['MockERC20']} ${deployed['ProofVerifiers']} ${deployed['MockPriceFeed']}`,
  );
  deployed['ShieldedCDP'] = extractAddress(cdpOutput);
  console.log(`  address: ${deployed['ShieldedCDP']}`);

  // 3f: Deploy SolvencyProver
  console.log('\nDeploying SolvencyProver...');
  const solvencyOutput = run(
    `sncast ${sncastFlags} deploy --class-hash ${classHashes['SolvencyProver']} --constructor-calldata ${accountAddr} ${deployed['ProofVerifiers']} ${accountAddr}`,
  );
  deployed['SolvencyProver'] = extractAddress(solvencyOutput);
  console.log(`  address: ${deployed['SolvencyProver']}`);

  // Step 4: Write addresses to .env
  console.log('\n--- Updating .env ---');
  let envContent = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf-8') : readFileSync(resolve(ROOT, '.env.example'), 'utf-8');

  const replacements: Record<string, string> = {
    'SHIELDED_VAULT_ADDRESS': deployed['ShieldedVault'],
    'SHIELDED_CDP_ADDRESS': deployed['ShieldedCDP'],
    'PROOF_VERIFIER_ADDRESS': deployed['ProofVerifiers'],
    'SOLVENCY_PROVER_ADDRESS': deployed['SolvencyProver'],
    'PRICE_FEED_ADDRESS': deployed['MockPriceFeed'],
    'XYBTC_TOKEN_ADDRESS': deployed['MockERC20'],
    'VITE_VAULT_ADDRESS': deployed['ShieldedVault'],
    'VITE_CDP_ADDRESS': deployed['ShieldedCDP'],
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
  console.log('Addresses written to .env');

  // Step 5: Summary
  console.log('\n=== Deployment Summary ===');
  for (const [name, address] of Object.entries(deployed)) {
    console.log(`  ${name}: ${address}`);
  }
  console.log('\nDeployment complete!');
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
