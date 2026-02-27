/**
 * Obscura v1.5 — Refresh MockPriceFeed Oracle Timestamp
 *
 * The MockPriceFeed on Sepolia has a fixed timestamp from deploy time.
 * The ShieldedCDP.mint_susd() requires the oracle timestamp to be within
 * ORACLE_STALENESS_THRESHOLD (3600s = 1 hour) of the current block time.
 *
 * This script calls set_price() to refresh the timestamp to "now".
 *
 * Usage: npx tsx scripts/refresh-oracle.ts
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

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
  const accountName = env.SNCAST_ACCOUNT_NAME || 'starkshield_deployer';
  const accountsFile = '/Users/nikhilkumar/.starknet_accounts/starknet_open_zeppelin_accounts.json';
  const priceFeedAddr = env.PRICE_FEED_ADDRESS || env.VITE_PRICE_FEED_ADDRESS;

  if (!priceFeedAddr) {
    console.error('Error: PRICE_FEED_ADDRESS not set in .env');
    process.exit(1);
  }

  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  // Price: $50,000 with 8 decimals = 5_000_000_000_000
  const price = '0x' + BigInt(50000 * 1e8).toString(16);
  // Timestamp: current unix epoch
  const timestamp = '0x' + Math.floor(Date.now() / 1000).toString(16);

  console.log('=== Refreshing MockPriceFeed Oracle ===\n');
  console.log(`  PriceFeed: ${priceFeedAddr}`);
  console.log(`  Price:     $50,000 (${price})`);
  console.log(`  Timestamp: ${Math.floor(Date.now() / 1000)} (${timestamp})`);
  console.log('');

  // set_price(price: u256, timestamp: u64)
  // u256 calldata: [low, high], u64 as felt
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
  const priceBig = BigInt(50000 * 1e8);
  const priceLow = '0x' + (priceBig & mask).toString(16);
  const priceHigh = '0x' + (priceBig >> BigInt(128)).toString(16);

  const cmd = `sncast ${G} invoke ${U} --contract-address ${priceFeedAddr} --function set_price --calldata ${priceLow} ${priceHigh} ${timestamp}`;
  console.log(`  > ${cmd}\n`);

  try {
    const output = execSync(`${cmd} 2>&1`, { cwd: CONTRACTS_DIR, encoding: 'utf-8', timeout: 120000 }).trim();
    const txMatch = output.match(/transaction_hash:\s*(0x[0-9a-fA-F]+)/);
    if (txMatch) {
      console.log(`  Transaction: ${txMatch[1]}`);
    } else {
      console.log(`  Output: ${output}`);
    }
    console.log('\n  Oracle timestamp refreshed successfully!');
    console.log('  mint_susd should now work for the next ~1 hour.');
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const msg = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    console.error(`  FAILED: ${msg.substring(0, 500)}`);
    process.exit(1);
  }
}

main();
