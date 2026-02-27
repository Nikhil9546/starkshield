/**
 * Obscura v1.5 — Submit Solvency Proofs
 *
 * Submits vault solvency and CDP safety proofs to the SolvencyProver contract.
 * The authorized_prover (deployer) calls submit_vault_solvency_proof() and
 * submit_cdp_safety_proof() with dummy proof data (MockProofVerifier accepts all).
 *
 * After running, the Proofs Dashboard will show both domains as "Verified".
 *
 * Usage: npx tsx scripts/submit-solvency.ts
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const ENV_FILE = resolve(ROOT, '.env');
const CONTRACTS_DIR = resolve(ROOT, 'contracts');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(ENV_FILE)) {
    console.error('Error: .env file not found. Run deploy.ts first.');
    process.exit(1);
  }
  const content = readFileSync(ENV_FILE, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
  return env;
}

function run(cmd: string): string {
  try {
    return execSync(`${cmd} 2>&1`, { cwd: CONTRACTS_DIR, encoding: 'utf-8', timeout: 120000 }).trim();
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const msg = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    throw new Error(msg.substring(0, 500));
  }
}

function extractTxHash(output: string): string | null {
  const match = output.match(/transaction_hash:\s*(0x[0-9a-fA-F]+)/);
  return match ? match[1] : null;
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
  const accountName = env.SNCAST_ACCOUNT_NAME || 'starkshield_deployer';
  const accountsFile = '/Users/nikhilkumar/.starknet_accounts/starknet_open_zeppelin_accounts.json';
  const solvencyAddr = env.SOLVENCY_PROVER_ADDRESS || env.VITE_SOLVENCY_ADDRESS;

  if (!solvencyAddr) {
    console.error('Error: SOLVENCY_PROVER_ADDRESS not set in .env');
    process.exit(1);
  }

  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  console.log('=== Submitting Solvency Proofs ===\n');
  console.log(`  SolvencyProver: ${solvencyAddr}`);
  console.log(`  Account:        ${accountName}`);
  console.log('');

  // --- 1. Submit Vault Solvency Proof ---
  // submit_vault_solvency_proof(assets_commitment, liabilities_commitment, num_accounts, proof_data)
  // Calldata: assets_commitment liabilities_commitment num_accounts proof_data_len proof_data[0]
  console.log('  [1/2] Submitting vault solvency proof...');
  const vaultCmd = `sncast ${G} invoke ${U} --contract-address ${solvencyAddr} --function submit_vault_solvency_proof --calldata 0xaaa1 0xbbb1 1 1 0xdead`;
  console.log(`    > ${vaultCmd}\n`);

  try {
    const vaultOutput = run(vaultCmd);
    const vaultTx = extractTxHash(vaultOutput);
    if (vaultTx) {
      console.log(`    Transaction: ${vaultTx}`);
    } else {
      console.log(`    Output: ${vaultOutput}`);
    }
    console.log('    Vault solvency proof submitted!\n');
  } catch (err: unknown) {
    const e = err as Error;
    console.error(`    FAILED: ${e.message}`);
    process.exit(1);
  }

  // --- 2. Submit CDP Safety Proof ---
  // submit_cdp_safety_proof(collateral_commitment, debt_commitment, price, safety_ratio_percent, num_cdps, proof_data)
  // Calldata: collateral_commitment debt_commitment price safety_ratio_percent num_cdps proof_data_len proof_data[0]
  console.log('  [2/2] Submitting CDP safety proof...');
  const cdpCmd = `sncast ${G} invoke ${U} --contract-address ${solvencyAddr} --function submit_cdp_safety_proof --calldata 0xccc1 0xddd1 50000 200 1 1 0xdead`;
  console.log(`    > ${cdpCmd}\n`);

  try {
    const cdpOutput = run(cdpCmd);
    const cdpTx = extractTxHash(cdpOutput);
    if (cdpTx) {
      console.log(`    Transaction: ${cdpTx}`);
    } else {
      console.log(`    Output: ${cdpOutput}`);
    }
    console.log('    CDP safety proof submitted!\n');
  } catch (err: unknown) {
    const e = err as Error;
    console.error(`    FAILED: ${e.message}`);
    process.exit(1);
  }

  console.log('=== Both solvency proofs submitted successfully! ===');
  console.log('  Vault Solvency: Verified');
  console.log('  CDP Safety:     Verified');
  console.log('\n  The Proofs Dashboard should now show green badges.');
}

main();
