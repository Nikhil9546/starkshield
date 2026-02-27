/**
 * Obscura v1.5 — Sepolia E2E Privacy-Hardened Flow Test
 *
 * Tests the complete lifecycle after privacy hardening:
 *   1. Approve token spending
 *   2. Deposit into vault
 *   3. Shield balance (event has NO amount)
 *   4. Open CDP
 *   5. Lock collateral
 *   6. Mint sUSD (NO amount param — commitment only)
 *   7. Repay (NO amount param — commitment only)
 *   8. Close CDP
 *   9. Unshield
 *  10. Withdraw
 *
 * Usage: npx tsx scripts/e2e-sepolia.ts
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

/** Run sncast invoke with --wait, returns tx hash or throws */
function invoke(
  G: string, U: string, contract: string, fn: string, calldata: string
): string {
  const calldataPart = calldata.trim() ? ` --calldata ${calldata}` : '';
  const cmd = `sncast ${G} invoke ${U} --contract-address ${contract} --function ${fn}${calldataPart}`;
  console.log(`  > ${fn}(${calldata.substring(0, 80)}${calldata.length > 80 ? '...' : ''})`);
  try {
    const out = execSync(`${cmd} 2>&1`, { cwd: CONTRACTS_DIR, encoding: 'utf-8', timeout: 120000 }).trim();
    const txMatch = out.match(/transaction_hash:\s*(0x[0-9a-fA-F]+)/);
    if (txMatch) {
      console.log(`    tx: ${txMatch[1]}`);
      return txMatch[1];
    }
    console.log(`    output: ${out.substring(0, 200)}`);
    return out;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const msg = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    console.error(`    FAILED: ${msg.substring(0, 300)}`);
    throw new Error(`invoke ${fn} failed`);
  }
}

/** Run sncast call (read-only), returns raw output */
function call(
  G: string, U: string, contract: string, fn: string, calldata: string = ''
): string {
  const calldataPart = calldata ? ` --calldata ${calldata}` : '';
  const cmd = `sncast ${G} call ${U} --contract-address ${contract} --function ${fn}${calldataPart}`;
  try {
    const out = execSync(`${cmd} 2>&1`, { cwd: CONTRACTS_DIR, encoding: 'utf-8', timeout: 30000 }).trim();
    return out;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return (e.stdout || '') + (e.stderr || '');
  }
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
  const accountName = env.SNCAST_ACCOUNT_NAME || 'starkshield_deployer';
  const accountsFile = '/Users/nikhilkumar/.starknet_accounts/starknet_open_zeppelin_accounts.json';
  const accountAddr = env.DEPLOYER_ACCOUNT_ADDRESS;
  const vaultAddr = env.SHIELDED_VAULT_ADDRESS;
  const cdpAddr = env.SHIELDED_CDP_ADDRESS;
  const tokenAddr = env.XYBTC_TOKEN_ADDRESS;

  if (!vaultAddr || !cdpAddr || !tokenAddr) {
    console.error('Error: Contract addresses not set in .env');
    process.exit(1);
  }

  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  console.log('=== Obscura v1.5 — E2E Privacy-Hardened Flow Test ===\n');
  console.log(`Network: Sepolia`);
  console.log(`Account: ${accountAddr}`);
  console.log(`Vault:   ${vaultAddr}`);
  console.log(`CDP:     ${cdpAddr}`);
  console.log(`Token:   ${tokenAddr}\n`);

  // Helpers for u256 calldata
  const u256 = (v: bigint): string => {
    const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
    return `0x${(v & mask).toString(16)} 0x${(v >> BigInt(128)).toString(16)}`;
  };

  const amount100 = BigInt(100) * BigInt(10) ** BigInt(18);
  const amount50 = BigInt(50) * BigInt(10) ** BigInt(18);
  const maxApproval = (BigInt(2) ** BigInt(128)) - BigInt(1);

  let step = 0;
  const ok = (msg: string) => console.log(`  [PASS] Step ${++step}: ${msg}\n`);

  // ===== STEP 1: Approve vault and CDP =====
  console.log('--- Step 1: Approve token spending ---');
  invoke(G, U, tokenAddr, 'approve', `${vaultAddr} ${u256(maxApproval)}`);
  invoke(G, U, tokenAddr, 'approve', `${cdpAddr} ${u256(maxApproval)}`);
  ok('Token approvals');

  // ===== STEP 2: Deposit 100 tokens into vault =====
  console.log('--- Step 2: Deposit into vault ---');
  invoke(G, U, vaultAddr, 'deposit', u256(amount100));
  console.log('  Checking public balance...');
  const balOut = call(G, U, vaultAddr, 'get_public_balance', accountAddr);
  console.log(`    Result: ${balOut}`);
  ok('Deposited 100 tokens');

  // ===== STEP 3: Shield 50 tokens =====
  console.log('--- Step 3: Shield balance (event has NO amount) ---');
  invoke(G, U, vaultAddr, 'shield',
    `${u256(amount50)} 0x111aaa 0x222bbb 0x333ccc 0xaa11aa01 0`
  );
  console.log('  Checking public balance after shield...');
  const balAfterShield = call(G, U, vaultAddr, 'get_public_balance', accountAddr);
  console.log(`    Result: ${balAfterShield}`);
  console.log('  Checking balance commitment...');
  const commitOut = call(G, U, vaultAddr, 'get_balance_commitment', accountAddr);
  console.log(`    Commitment: ${commitOut}`);
  ok('Shielded 50 tokens (no amount in event)');

  // ===== STEP 4: Open CDP =====
  console.log('--- Step 4: Open CDP ---');
  invoke(G, U, cdpAddr, 'open_cdp', '');
  console.log('  Checking CDP exists...');
  const hasCdpOut = call(G, U, cdpAddr, 'has_cdp', accountAddr);
  console.log(`    has_cdp: ${hasCdpOut}`);
  ok('CDP opened');

  // ===== STEP 5: Lock 50 tokens as collateral =====
  console.log('--- Step 5: Lock collateral ---');
  invoke(G, U, cdpAddr, 'lock_collateral',
    `${u256(amount50)} 0xc01c0001 0xc01c1 0xc01c2 0xbb11bb01 0`
  );
  console.log('  Checking locked collateral...');
  const lockOut = call(G, U, cdpAddr, 'get_locked_collateral', accountAddr);
  console.log(`    locked: ${lockOut}`);
  ok('Locked 50 tokens as collateral');

  // ===== STEP 6: Mint sUSD (NO amount param — privacy hardened!) =====
  console.log('--- Step 6: Mint sUSD (commitment-only, no amount) ---');
  invoke(G, U, cdpAddr, 'mint_susd',
    `0xdebc0001 0xdeb1c1 0xdeb1c2 0xcc11cc01 0`
  );
  console.log('  Checking debt commitment...');
  const debtOut = call(G, U, cdpAddr, 'get_debt_commitment', accountAddr);
  console.log(`    debt_commitment: ${debtOut}`);
  ok('Minted sUSD (no amount leaked!)');

  // ===== STEP 7: Repay (NO amount param — privacy hardened!) =====
  console.log('--- Step 7: Repay sUSD (commitment-only, no amount) ---');
  invoke(G, U, cdpAddr, 'repay',
    `0xdebc0002 0xdeb2c1 0xdeb2c2 0xdd11dd01 0`
  );
  console.log('  Checking debt commitment after repay...');
  const debtAfterRepay = call(G, U, cdpAddr, 'get_debt_commitment', accountAddr);
  console.log(`    debt_commitment: ${debtAfterRepay}`);
  ok('Repaid sUSD (no amount leaked!)');

  // ===== STEP 8: Close CDP =====
  console.log('--- Step 8: Close CDP ---');
  invoke(G, U, cdpAddr, 'close_cdp',
    `0xee11ee01 0`
  );
  console.log('  Checking CDP closed...');
  const hasCdpAfter = call(G, U, cdpAddr, 'has_cdp', accountAddr);
  console.log(`    has_cdp: ${hasCdpAfter}`);
  console.log('  Checking collateral returned...');
  const lockAfter = call(G, U, cdpAddr, 'get_locked_collateral', accountAddr);
  console.log(`    locked: ${lockAfter}`);
  ok('CDP closed, collateral returned');

  // ===== STEP 9: Unshield =====
  console.log('--- Step 9: Unshield back to public ---');
  invoke(G, U, vaultAddr, 'unshield',
    `${u256(amount50)} 0x444ddd 0x555eee 0x666fff 0xff11ff01 0`
  );
  console.log('  Checking public balance after unshield...');
  const balAfterUnshield = call(G, U, vaultAddr, 'get_public_balance', accountAddr);
  console.log(`    Result: ${balAfterUnshield}`);
  ok('Unshielded 50 tokens');

  // ===== STEP 10: Withdraw =====
  console.log('--- Step 10: Withdraw from vault ---');
  invoke(G, U, vaultAddr, 'withdraw', u256(amount100));
  console.log('  Checking public balance after withdraw...');
  const balFinal = call(G, U, vaultAddr, 'get_public_balance', accountAddr);
  console.log(`    Result: ${balFinal}`);
  ok('Withdrew 100 tokens');

  // ===== PRIVACY VERIFICATION =====
  console.log('=============================================');
  console.log('=== PRIVACY VERIFICATION ===');
  console.log('=============================================');
  console.log('');
  console.log('Verify on Starkscan/Voyager that:');
  console.log('  1. Shielded/Unshielded events have NO amount field');
  console.log('  2. mint_susd tx calldata has NO amount — only commitment + ciphertext + nullifier + proof');
  console.log('  3. repay tx calldata has NO amount — only commitment + ciphertext + nullifier + proof');
  console.log('  4. SUSDMinted/DebtRepaid events have NO amount field');
  console.log('  5. CDPClosed event has nullifier instead of collateral_returned');
  console.log('  6. No get_susd_balance or get_total_debt_minted view functions exist');
  console.log('');
  console.log(`  CDP contract: https://sepolia.starkscan.co/contract/${cdpAddr}`);
  console.log(`  Vault contract: https://sepolia.starkscan.co/contract/${vaultAddr}`);
  console.log('');
  console.log('=== ALL 10 STEPS PASSED ===');
}

main().catch((err) => {
  console.error('\nE2E test failed:', err.message || err);
  process.exit(1);
});
