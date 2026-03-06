/**
 * Obscura v1.5 — Seed Fixtures (Real Garaga Verification)
 *
 * Seeds deployed contracts with sample data for testing and demos.
 * Creates sample deposits, shields with real ZK proofs, opens CDPs,
 * locks collateral, and mints sUSD.
 *
 * Uses named sncast accounts (not raw private keys) and u64-safe
 * token amounts (8 decimals) for circuit compatibility.
 *
 * Prerequisites:
 *   - Contracts deployed with real Garaga verifiers: npx tsx scripts/deploy.ts --real
 *   - .env populated with contract addresses
 *   - nargo, bb, garaga CLI installed (see CLAUDE.md)
 *   - Python venv activated: source .venv/bin/activate
 *   - Oracle refreshed: npx tsx scripts/refresh-oracle.ts
 *
 * Usage: npx tsx scripts/seed-fixtures.ts
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

function run(cmd: string, cwd: string = CONTRACTS_DIR): string {
  try {
    return execSync(`${cmd} 2>&1`, { cwd, encoding: 'utf-8', timeout: 300000 }).trim();
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const msg = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    throw new Error(msg.substring(0, 500));
  }
}

function invoke(
  G: string, U: string, contract: string, fn: string, calldata: string,
): string {
  const calldataPart = calldata.trim() ? ` --calldata ${calldata}` : '';
  const cmd = `sncast ${G} invoke ${U} --contract-address ${contract} --function ${fn}${calldataPart}`;
  console.log(`  > ${fn}(${calldata.substring(0, 80)}${calldata.length > 80 ? '...' : ''})`);
  try {
    const out = execSync(`${cmd} 2>&1`, { cwd: CONTRACTS_DIR, encoding: 'utf-8', timeout: 300000 }).trim();
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

const u256cd = (v: bigint): string => {
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
  return `0x${(v & mask).toString(16)} 0x${(v >> BigInt(128)).toString(16)}`;
};

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

  run(`bb prove -b ./target/${circuitName}.json -w ./target/${circuitName}.gz -o ./target_keccak/proof --scheme ultra_honk --oracle_hash keccak`, dir);

  const testsDir = resolve(dir, 'tests');
  mkdirSync(testsDir, { recursive: true });
  const starkliFile = resolve(testsDir, 'starkli_calldata.txt');
  run(`bash -c 'source ${ROOT}/.venv/bin/activate && garaga calldata --system ultra_keccak_zk_honk --proof "${dir}/target_keccak/proof/proof" --vk "${dir}/target_keccak/vk" --public-inputs "${dir}/target_keccak/proof/public_inputs" --format starkli' > "${starkliFile}"`, dir);

  const raw = readFileSync(starkliFile, 'utf-8').trim();
  const allTokens = raw.split(/\s+/).filter(t => t.length > 0);
  const elems = allTokens.slice(1); // skip the length prefix
  console.log(`  [PROOF] ${circuitName}: ${elems.length} calldata felts`);
  return elems;
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
  const accountName = env.SNCAST_ACCOUNT_NAME || 'starkshield_deployer';
  const accountsFile = '/Users/nikhilkumar/.starknet_accounts/starknet_open_zeppelin_accounts.json';
  const vaultAddr = env.SHIELDED_VAULT_ADDRESS;
  const cdpAddr = env.SHIELDED_CDP_ADDRESS;
  const tokenAddr = env.XYBTC_TOKEN_ADDRESS;
  const priceFeedAddr = env.PRICE_FEED_ADDRESS;

  if (!vaultAddr || !cdpAddr || !tokenAddr) {
    console.error('Error: Contract addresses not set. Run deploy.ts first.');
    process.exit(1);
  }

  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  console.log('=== Obscura v1.5 — Seed Fixtures (Real Garaga Proofs) ===\n');
  console.log(`  Account:   ${accountName}`);
  console.log(`  Vault:     ${vaultAddr}`);
  console.log(`  CDP:       ${cdpAddr}`);
  console.log(`  Token:     ${tokenAddr}`);
  console.log('');

  // Use u64-safe amounts (8 decimals, NOT 18) for circuit compatibility
  // 1000 tokens @ 8 decimals = 100_000_000_000 (fits u64)
  const depositAmount = BigInt(1000) * BigInt(10) ** BigInt(8);
  const shieldAmount = BigInt(500) * BigInt(10) ** BigInt(8);
  const lockAmount = BigInt(200) * BigInt(10) ** BigInt(8);
  const mintAmount = BigInt(1) * BigInt(10) ** BigInt(8);
  const maxApproval = (BigInt(2) ** BigInt(128)) - BigInt(1);

  // Generate unique nullifiers for this run
  const rnd = () => '0x' + Array.from({length: 8}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const nullShield = rnd();
  const nullLock = rnd();
  const nullMint = rnd();

  // --- Refresh oracle timestamp ---
  if (priceFeedAddr) {
    console.log('--- Refreshing oracle timestamp ---');
    const price = '0x' + BigInt(50000 * 1e8).toString(16);
    const ts = '0x' + Math.floor(Date.now() / 1000).toString(16);
    invoke(G, U, priceFeedAddr, 'set_price', `${price} 0 ${ts}`);
    console.log('  Oracle refreshed\n');
  }

  // --- Step 1: Approve token spending ---
  console.log('--- Step 1: Approve token spending ---');
  invoke(G, U, tokenAddr, 'approve', `${vaultAddr} ${u256cd(maxApproval)}`);
  invoke(G, U, tokenAddr, 'approve', `${cdpAddr} ${u256cd(maxApproval)}`);
  console.log('  Approvals set\n');

  // --- Step 2: Deposit into vault ---
  console.log('--- Step 2: Deposit 1000 tokens ---');
  invoke(G, U, vaultAddr, 'deposit', u256cd(depositAmount));
  console.log('  Deposited 1000 tokens\n');

  // --- Step 3: Shield with range_proof ---
  console.log('--- Step 3: Shield 500 tokens (range_proof) ---');
  const sValue = shieldAmount.toString();
  const sMax = '18446744073709551615';
  const { blinding: sBlinding, commitment: sCommitment } = findValidBlinding(sValue, 100);

  const rangeProof = generateProof('range_proof',
    `value = "${sValue}"\nblinding = "${sBlinding}"\ncommitment = "${sCommitment}"\nmax_value = "${sMax}"\n`);

  const shieldCD = [
    ...u256cd(shieldAmount).split(' '),
    sCommitment, '0x111aaa', '0x222bbb', nullShield,
    `0x${rangeProof.length.toString(16)}`, ...rangeProof,
  ].join(' ');
  invoke(G, U, vaultAddr, 'shield', shieldCD);
  console.log('  Shielded 500 tokens with real range_proof\n');

  // --- Step 4: Open CDP ---
  console.log('--- Step 4: Open CDP ---');
  invoke(G, U, cdpAddr, 'open_cdp', '');
  console.log('  CDP opened\n');

  // --- Step 5: Lock collateral (range_proof) ---
  console.log('--- Step 5: Lock 200 tokens as collateral ---');
  const cValue = lockAmount.toString();
  const { blinding: cBlinding, commitment: cCommitment } = findValidBlinding(cValue, 200);

  const lockRangeProof = generateProof('range_proof',
    `value = "${cValue}"\nblinding = "${cBlinding}"\ncommitment = "${cCommitment}"\nmax_value = "${sMax}"\n`);

  const lockCD = [
    ...u256cd(lockAmount).split(' '),
    cCommitment, '0xc01c1', '0xc01c2', nullLock,
    `0x${lockRangeProof.length.toString(16)}`, ...lockRangeProof,
  ].join(' ');
  invoke(G, U, cdpAddr, 'lock_collateral', lockCD);
  console.log('  Locked 200 tokens with real range_proof\n');

  // --- Step 6: Mint sUSD (collateral_ratio proof) ---
  console.log('--- Step 6: Mint 1 sUSD ---');
  const { blinding: dBlinding, commitment: dCommitment } = findValidBlinding(mintAmount.toString(), 400);

  const crProof = generateProof('collateral_ratio',
    `collateral = "${cValue}"\ndebt = "${mintAmount}"\ncollateral_blinding = "${cBlinding}"\ndebt_blinding = "${dBlinding}"\ncollateral_commitment = "${cCommitment}"\ndebt_commitment = "${dCommitment}"\nprice = "5000000000000"\nmin_ratio_percent = "200"\n`);

  const mintCD = [
    dCommitment, '0xdeb1c1', '0xdeb1c2', nullMint,
    `0x${crProof.length.toString(16)}`, ...crProof,
  ].join(' ');
  invoke(G, U, cdpAddr, 'mint_susd', mintCD);
  console.log('  Minted 1 sUSD with real collateral_ratio proof\n');

  // --- Summary ---
  console.log('=== Fixture Summary ===');
  console.log('  Vault: 1000 deposited, 500 shielded (real range_proof), 500 public');
  console.log('  CDP: 200 collateral locked (real range_proof), 1 sUSD minted (real collateral_ratio)');
  console.log('');
  console.log('  All proofs verified on-chain via real Garaga verifiers!');
  console.log('\nFixtures seeded successfully!');
}

main().catch((err) => {
  console.error('\nSeeding failed:', err.message || err);
  process.exit(1);
});
