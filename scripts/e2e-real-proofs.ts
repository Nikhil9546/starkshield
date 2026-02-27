/**
 * Obscura v1.5 — E2E Test with REAL Garaga Proof Verification on Sepolia
 *
 * Generates real ZK proofs via nargo + bb + garaga CLI, then submits
 * as transactions on Sepolia to verify end-to-end flow.
 *
 * Usage: npx tsx scripts/e2e-real-proofs.ts
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const CIRCUITS_DIR = resolve(ROOT, 'circuits');
const CONTRACTS_DIR = resolve(ROOT, 'contracts');
const ENV_FILE = resolve(ROOT, '.env');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const content = readFileSync(ENV_FILE, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
  return env;
}

function run(cmd: string, cwd: string = CONTRACTS_DIR): string {
  console.log(`  > ${cmd.substring(0, 120)}${cmd.length > 120 ? '...' : ''}`);
  return execSync(`${cmd} 2>&1`, { cwd, encoding: 'utf-8', timeout: 300000 }).trim();
}

function invoke(
  G: string, U: string, contract: string, fn: string, calldata: string,
): string {
  const calldataPart = calldata.trim() ? ` --calldata ${calldata}` : '';
  const cmd = `sncast ${G} invoke ${U} --contract-address ${contract} --function ${fn}${calldataPart}`;
  console.log(`  > ${fn}(${calldata.substring(0, 80)}${calldata.length > 80 ? '...' : ''})`);
  try {
    const out = execSync(`${cmd} 2>&1`, { cwd: CONTRACTS_DIR, encoding: 'utf-8', timeout: 300000 }).trim();
    // Check for execution error in output
    if (out.includes('Transaction execution error') || out.includes('REVERTED')) {
      throw new Error(`Transaction reverted: ${out.substring(0, 500)}`);
    }
    const txMatch = out.match(/[Tt]ransaction[_ ][Hh]ash[:\s]+(0x[0-9a-fA-F]+)/);
    if (txMatch) {
      console.log(`    tx: ${txMatch[1]}`);
      return txMatch[1];
    }
    console.log(`    output: ${out.substring(0, 200)}`);
    return out;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const msg = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    console.error(`    [ERROR] ${fn} failed: ${msg.substring(0, 400)}`);
    throw new Error(`invoke ${fn} failed: ${msg.substring(0, 200)}`);
  }
}

function call(
  G: string, U: string, contract: string, fn: string, calldata: string = '',
): string {
  const calldataPart = calldata ? ` --calldata ${calldata}` : '';
  const cmd = `sncast ${G} call ${U} --contract-address ${contract} --function ${fn}${calldataPart}`;
  try {
    return execSync(`${cmd} 2>&1`, { cwd: CONTRACTS_DIR, encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return (e.stdout || '') + (e.stderr || '');
  }
}

/** Stark prime for felt252 range check */
const STARK_PRIME = BigInt('3618502788666131213697322783095070105623107215331596699973092056135872020481');

/** Compute Pedersen hash via a helper Noir circuit */
function pedersenHash(value: string, blinding: string): string {
  const helperDir = '/tmp/pedersen_compute';
  mkdirSync(resolve(helperDir, 'src'), { recursive: true });
  writeFileSync(resolve(helperDir, 'Nargo.toml'),
    `[package]\nname = "pedersen_compute"\ntype = "bin"\nauthors = [""]\ncompiler_version = ">=0.1.0"\n\n[dependencies]\n`);
  writeFileSync(resolve(helperDir, 'src', 'main.nr'),
    `use std::hash::pedersen_hash;\nfn main(value: u64, blinding: Field) -> pub Field {\n    pedersen_hash([value as Field, blinding])\n}\n`);
  writeFileSync(resolve(helperDir, 'Prover.toml'), `value = "${value}"\nblinding = "${blinding}"\n`);
  const output = run('nargo execute', helperDir);
  const match = output.match(/Circuit output: (0x[0-9a-fA-F]+)/);
  if (!match) throw new Error(`Pedersen hash failed: ${output}`);
  return match[1];
}

/**
 * Find a blinding value that produces a Pedersen commitment within the Stark field.
 * Noir uses BN254 (~2^254) which is larger than Stark prime (~2^251),
 * so some commitments exceed felt252 range.
 */
function findValidBlinding(value: string, startBlinding: number = 1): { blinding: string; commitment: string } {
  for (let b = startBlinding; b < startBlinding + 100; b++) {
    const commitment = pedersenHash(value, b.toString());
    const commitBigInt = BigInt(commitment);
    if (commitBigInt < STARK_PRIME) {
      console.log(`    Found valid blinding=${b} for value=${value} (commitment ${commitment.substring(0, 20)}...)`);
      return { blinding: b.toString(), commitment };
    }
  }
  throw new Error(`Could not find valid blinding for value=${value}`);
}

/** Generate a real Garaga proof and return the calldata as hex strings */
function generateProof(circuitName: string, proverToml: string): string[] {
  const dir = resolve(CIRCUITS_DIR, circuitName);
  writeFileSync(resolve(dir, 'Prover.toml'), proverToml);

  console.log(`\n  [PROOF] Generating proof for ${circuitName}...`);
  run('nargo execute', dir);

  // Ensure VK available
  const vkSrc = resolve(dir, 'target_keccak', 'vk');
  const vkDst = resolve(dir, 'target', 'vk');
  if (existsSync(vkSrc) && !existsSync(vkDst)) {
    execSync(`cp "${vkSrc}" "${vkDst}"`);
  }

  run(`bb prove -b ./target/${circuitName}.json -w ./target/${circuitName}.gz -o ./target_keccak/proof --scheme ultra_honk --oracle_hash keccak`, dir);

  const testsDir = resolve(dir, 'tests');
  mkdirSync(testsDir, { recursive: true });
  // Use starkli format (decimal integers, space-separated) for sncast compatibility
  const starkliFile = resolve(testsDir, 'starkli_calldata.txt');
  run(`bash -c 'source ${ROOT}/.venv/bin/activate && garaga calldata --system ultra_keccak_zk_honk --proof "${dir}/target_keccak/proof/proof" --vk "${dir}/target_keccak/vk" --public-inputs "${dir}/target_keccak/proof/public_inputs" --format starkli' > "${starkliFile}"`, dir);

  const raw = readFileSync(starkliFile, 'utf-8').trim();
  // starkli format: "LENGTH elem1 elem2 ..." — skip the first token (length)
  const allTokens = raw.split(/\s+/).filter(t => t.length > 0);
  const elems = allTokens.slice(1); // skip the length prefix
  console.log(`  [PROOF] ${circuitName}: ${elems.length} calldata felts`);
  return elems;
}

const u256cd = (v: bigint): string => {
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
  return `0x${(v & mask).toString(16)} 0x${(v >> BigInt(128)).toString(16)}`;
};

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
  const accountName = env.SNCAST_ACCOUNT_NAME || 'starkshield_deployer';
  const accountsFile = '/Users/nikhilkumar/.starknet_accounts/starknet_open_zeppelin_accounts.json';
  const accountAddr = env.DEPLOYER_ACCOUNT_ADDRESS!;
  const vaultAddr = env.SHIELDED_VAULT_ADDRESS!;
  const cdpAddr = env.SHIELDED_CDP_ADDRESS!;
  const tokenAddr = env.XYBTC_TOKEN_ADDRESS!;
  const priceFeedAddr = env.PRICE_FEED_ADDRESS!;

  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  console.log('=== Obscura v1.5 — E2E Real Proof Test ===\n');
  console.log(`Account:    ${accountAddr}`);
  console.log(`Vault:      ${vaultAddr}`);
  console.log(`CDP:        ${cdpAddr}`);
  console.log(`Token:      ${tokenAddr}`);
  console.log(`PriceFeed:  ${priceFeedAddr}\n`);

  // Use amounts that fit in u64 (max ~1.8e19) for circuit compatibility
  // 100 tokens with 8 decimals = 10_000_000_000 (fits u64 easily)
  const amount = BigInt(100) * BigInt(10) ** BigInt(8);    // 10_000_000_000
  const shieldAmt = BigInt(50) * BigInt(10) ** BigInt(8);  // 5_000_000_000
  const maxApproval = (BigInt(2) ** BigInt(128)) - BigInt(1);
  let step = 0;
  const pass = (msg: string) => console.log(`\n  [PASS] Step ${++step}: ${msg}\n`);

  // Generate unique nullifiers for this run (random hex values)
  const rnd = () => '0x' + Array.from({length: 8}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const nullShield = rnd();
  const nullLock = rnd();
  const nullMint = rnd();
  const nullRepay = rnd();
  const nullClose = rnd();
  const nullUnshield = rnd();
  console.log(`Nullifiers: shield=${nullShield} lock=${nullLock} mint=${nullMint} repay=${nullRepay} close=${nullClose} unshield=${nullUnshield}`);

  // --- Refresh oracle timestamp ---
  console.log('--- Refreshing oracle timestamp ---');
  const price = '0x' + BigInt(50000 * 1e8).toString(16);
  const ts = '0x' + Math.floor(Date.now() / 1000).toString(16);
  invoke(G, U, priceFeedAddr, 'set_price', `${price} 0 ${ts}`);
  console.log('  Oracle refreshed');

  // --- Step 1: Approve ---
  console.log('\n--- Step 1: Approve ---');
  invoke(G, U, tokenAddr, 'approve', `${vaultAddr} ${u256cd(maxApproval)}`);
  invoke(G, U, tokenAddr, 'approve', `${cdpAddr} ${u256cd(maxApproval)}`);
  pass('Approvals');

  // --- Step 2: Deposit ---
  console.log('--- Step 2: Deposit 100 tokens ---');
  invoke(G, U, vaultAddr, 'deposit', u256cd(amount));
  pass('Deposit');

  // --- Step 3: Shield with range_proof ---
  console.log('--- Step 3: Shield 50 tokens (range_proof) ---');
  const sValue = shieldAmt.toString();
  const sMax = '18446744073709551615';
  const { blinding: sBlinding, commitment: sCommitment } = findValidBlinding(sValue, 100);

  const rangeProof = generateProof('range_proof',
    `value = "${sValue}"\nblinding = "${sBlinding}"\ncommitment = "${sCommitment}"\nmax_value = "${sMax}"\n`);

  const shieldCD = [
    ...u256cd(shieldAmt).split(' '),
    sCommitment, '0x111aaa', '0x222bbb', nullShield,
    `0x${rangeProof.length.toString(16)}`, ...rangeProof,
  ].join(' ');
  invoke(G, U, vaultAddr, 'shield', shieldCD);
  pass('Shield with REAL range_proof');

  // --- Step 4: Open CDP ---
  console.log('--- Step 4: Open CDP ---');
  invoke(G, U, cdpAddr, 'open_cdp', '');
  pass('CDP opened');

  // --- Step 5: Lock collateral (range_proof for first lock) ---
  // The CDP contract uses RANGE_PROOF for the first lock (no existing collateral commitment).
  // lock_collateral does transfer_from(user, cdp, amount) so user needs tokens in wallet.
  console.log('--- Step 5: Lock 50 tokens as collateral ---');
  const cValue = shieldAmt.toString();
  const cMax = '18446744073709551615';
  const { blinding: cBlinding, commitment: cCommitment } = findValidBlinding(cValue, 200);

  const lockRangeProof = generateProof('range_proof',
    `value = "${cValue}"\nblinding = "${cBlinding}"\ncommitment = "${cCommitment}"\nmax_value = "${cMax}"\n`);

  const lockCD = [
    ...u256cd(shieldAmt).split(' '),
    cCommitment, '0xc01c1', '0xc01c2', nullLock,
    `0x${lockRangeProof.length.toString(16)}`, ...lockRangeProof,
  ].join(' ');
  invoke(G, U, cdpAddr, 'lock_collateral', lockCD);
  pass('Lock collateral with REAL range_proof');

  // --- Step 6: Mint sUSD (collateral_ratio proof) ---
  // mint_susd requires COLLATERAL_RATIO proof: collateral * price >= debt * MIN_CR
  console.log('--- Step 6: Mint sUSD ---');
  const susdAmt = BigInt(1) * BigInt(10) ** BigInt(8); // 1 sUSD with 8 decimals
  const { blinding: dNewBlinding, commitment: dNewCommitment } = findValidBlinding(susdAmt.toString(), 400);
  // Zero debt commitment for "old debt = 0"
  const { blinding: dZeroBlinding, commitment: dZeroCommitment } = findValidBlinding('0', 300);

  // Collateral = 50 tokens, debt = 1 sUSD, price = 50000 * 1e8, min_ratio = 200
  const crMintProof = generateProof('collateral_ratio',
    `collateral = "${cValue}"\ndebt = "${susdAmt}"\ncollateral_blinding = "${cBlinding}"\ndebt_blinding = "${dNewBlinding}"\ncollateral_commitment = "${cCommitment}"\ndebt_commitment = "${dNewCommitment}"\nprice = "5000000000000"\nmin_ratio_percent = "200"\n`);

  const mintCD = [
    dNewCommitment, '0xdeb1c1', '0xdeb1c2', nullMint,
    `0x${crMintProof.length.toString(16)}`, ...crMintProof,
  ].join(' ');
  invoke(G, U, cdpAddr, 'mint_susd', mintCD);
  pass('Mint sUSD with REAL collateral_ratio proof');

  // --- Step 7: Repay ---
  console.log('--- Step 7: Repay sUSD ---');
  const { blinding: rNewBlinding, commitment: rNewCommitment } = findValidBlinding('0', 600);
  const { blinding: rDeltaBlinding, commitment: rDeltaCommitment } = findValidBlinding(susdAmt.toString(), 700);

  const repayProof = generateProof('debt_update_validity',
    `old_debt = "${susdAmt}"\nnew_debt = "0"\ndelta = "${susdAmt}"\nold_blinding = "${dNewBlinding}"\nnew_blinding = "${rNewBlinding}"\ndelta_blinding = "${rDeltaBlinding}"\nold_debt_commitment = "${dNewCommitment}"\nnew_debt_commitment = "${rNewCommitment}"\ndelta_commitment = "${rDeltaCommitment}"\nis_repayment = "1"\n`);

  const repayCD = [
    rNewCommitment, '0xdeb2c1', '0xdeb2c2', nullRepay,
    `0x${repayProof.length.toString(16)}`, ...repayProof,
  ].join(' ');
  invoke(G, U, cdpAddr, 'repay', repayCD);
  pass('Repay with REAL debt_update_validity proof');

  // --- Step 8: Close CDP (zero_debt) ---
  console.log('--- Step 8: Close CDP ---');
  const zdProof = generateProof('zero_debt',
    `debt = "0"\nblinding = "${rNewBlinding}"\ndebt_commitment = "${rNewCommitment}"\n`);

  const closeCD = [
    nullClose,
    `0x${zdProof.length.toString(16)}`, ...zdProof,
  ].join(' ');
  invoke(G, U, cdpAddr, 'close_cdp', closeCD);
  pass('CDP closed with REAL zero_debt proof');

  // --- Step 9: Unshield (balance_sufficiency) ---
  console.log('--- Step 9: Unshield 50 tokens ---');
  const { blinding: uNewBlinding, commitment: uNewCommitment } = findValidBlinding('0', 800);
  const { blinding: uAmtBlinding, commitment: uAmtCommitment } = findValidBlinding(sValue, 900);

  const bsProof = generateProof('balance_sufficiency',
    `balance = "${sValue}"\namount = "${sValue}"\nnew_balance = "0"\nbalance_blinding = "${sBlinding}"\namount_blinding = "${uAmtBlinding}"\nnew_balance_blinding = "${uNewBlinding}"\nbalance_commitment = "${sCommitment}"\namount_commitment = "${uAmtCommitment}"\nnew_balance_commitment = "${uNewCommitment}"\n`);

  const unshieldCD = [
    ...u256cd(shieldAmt).split(' '),
    uNewCommitment, '0x444ddd', '0x555eee', nullUnshield,
    `0x${bsProof.length.toString(16)}`, ...bsProof,
  ].join(' ');
  invoke(G, U, vaultAddr, 'unshield', unshieldCD);
  pass('Unshield with REAL balance_sufficiency proof');

  // --- Step 10: Withdraw ---
  console.log('--- Step 10: Withdraw 100 tokens ---');
  invoke(G, U, vaultAddr, 'withdraw', u256cd(amount));
  pass('Withdraw');

  console.log('\n=============================================');
  console.log('=== ALL 10 STEPS PASSED — REAL PROOFS ===');
  console.log('=============================================');
  console.log(`\nVault: https://sepolia.starkscan.co/contract/${vaultAddr}`);
  console.log(`CDP:   https://sepolia.starkscan.co/contract/${cdpAddr}`);
}

main().catch((err) => {
  console.error('\nE2E test failed:', err.message || err);
  process.exit(1);
});
