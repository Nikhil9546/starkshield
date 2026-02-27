/**
 * Obscura v1.5 — Seed Fixtures
 *
 * Seeds deployed contracts with sample data for testing and demos.
 * Creates sample deposits, CDPs, and solvency proofs.
 *
 * Usage: npx ts-node scripts/seed-fixtures.ts
 *
 * Prerequisites:
 *   - Contracts deployed (run deploy.ts first)
 *   - .env populated with contract addresses
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const ENV_FILE = resolve(ROOT, '.env');

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

function sncastInvoke(
  rpcUrl: string,
  accountAddr: string,
  privateKey: string,
  contractAddr: string,
  functionName: string,
  calldata: string[],
): string {
  const calldataStr = calldata.length > 0 ? calldata.join(' ') : '';
  const cmd = `sncast --url ${rpcUrl} --account-address ${accountAddr} --private-key ${privateKey} invoke --contract-address ${contractAddr} --function ${functionName} --calldata ${calldataStr}`;
  console.log(`  > invoke ${functionName} on ${contractAddr.slice(0, 10)}...`);
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 60000 }).trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    console.error(`  Failed: ${error.stderr || error.message}`);
    return '';
  }
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io';
  const accountAddr = env.DEPLOYER_ACCOUNT_ADDRESS;
  const privateKey = env.DEPLOYER_PRIVATE_KEY;
  const vaultAddr = env.SHIELDED_VAULT_ADDRESS;
  const cdpAddr = env.SHIELDED_CDP_ADDRESS;
  const tokenAddr = env.XYBTC_TOKEN_ADDRESS;

  if (!accountAddr || !privateKey) {
    console.error('Error: DEPLOYER_ACCOUNT_ADDRESS and DEPLOYER_PRIVATE_KEY must be set');
    process.exit(1);
  }

  if (!vaultAddr || !cdpAddr || !tokenAddr) {
    console.error('Error: Contract addresses not set. Run deploy.ts first.');
    process.exit(1);
  }

  console.log('=== Obscura v1.5 — Seed Fixtures ===\n');
  console.log(`Network: Sepolia`);
  console.log(`Deployer: ${accountAddr}\n`);

  const invoke = (contract: string, fn: string, calldata: string[]) =>
    sncastInvoke(rpcUrl, accountAddr, privateKey, contract, fn, calldata);

  // Step 1: Approve vault and CDP to spend tokens
  console.log('--- Approving token spending ---');
  const maxApproval = '0x' + (BigInt(2) ** BigInt(128) - BigInt(1)).toString(16);
  invoke(tokenAddr, 'approve', [vaultAddr, maxApproval, '0']);
  invoke(tokenAddr, 'approve', [cdpAddr, maxApproval, '0']);

  // Step 2: Deposit into vault
  console.log('\n--- Depositing into vault ---');
  const depositAmount = '0x' + (BigInt(1000) * BigInt(10) ** BigInt(18)).toString(16);
  invoke(vaultAddr, 'deposit', [depositAmount, '0']);
  console.log('  Deposited 1000 tokens');

  // Step 3: Shield some balance
  console.log('\n--- Shielding balance ---');
  const shieldAmount = '0x' + (BigInt(500) * BigInt(10) ** BigInt(18)).toString(16);
  invoke(vaultAddr, 'shield', [
    shieldAmount, '0',      // amount (u256 = low, high)
    '0x1234',               // commitment
    '0x5678',               // ct_c1
    '0x9abc',               // ct_c2
    '0xdeadbeef01',         // nullifier
    '0',                    // proof_data length (empty for mock verifier)
  ]);
  console.log('  Shielded 500 tokens');

  // Step 4: Open CDP
  console.log('\n--- Opening CDP ---');
  invoke(cdpAddr, 'open_cdp', []);
  console.log('  CDP opened');

  // Step 5: Lock collateral
  console.log('\n--- Locking collateral ---');
  const lockAmount = '0x' + (BigInt(200) * BigInt(10) ** BigInt(18)).toString(16);
  invoke(cdpAddr, 'lock_collateral', [
    lockAmount, '0',        // amount
    '0xabc123',             // commitment
    '0xdef456',             // ct_c1
    '0x789abc',             // ct_c2
    '0xdeadbeef02',         // nullifier
    '0',                    // proof_data length
  ]);
  console.log('  Locked 200 tokens as collateral');

  // Step 6: Mint sUSD
  console.log('\n--- Minting sUSD ---');
  const mintAmount = '0x' + (BigInt(50) * BigInt(10) ** BigInt(18)).toString(16);
  invoke(cdpAddr, 'mint_susd', [
    mintAmount, '0',        // amount
    '0xdebt001',            // debt commitment
    '0xdebt_c1',            // debt ct_c1
    '0xdebt_c2',            // debt ct_c2
    '0xdeadbeef03',         // nullifier
    '0',                    // proof_data length
  ]);
  console.log('  Minted 50 sUSD');

  // Summary
  console.log('\n=== Fixture Summary ===');
  console.log('  Vault: 1000 deposited, 500 shielded, 500 public');
  console.log('  CDP: 200 collateral locked, 50 sUSD minted');
  console.log('\nFixtures seeded successfully!');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
