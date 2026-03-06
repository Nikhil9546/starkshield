/**
 * Obscura v1.5 — Submit Solvency Proofs (Real Garaga Verification)
 *
 * Generates real vault_solvency and cdp_safety_bound ZK proofs via
 * nargo + bb + garaga CLI, then submits them to the SolvencyProver contract.
 *
 * After running, the Proofs Dashboard will show both domains as "Verified".
 *
 * Prerequisites:
 *   - nargo 1.0.0-beta.16, bb 3.0.0-nightly.20251104, garaga 1.0.1 installed
 *   - Python venv activated: source .venv/bin/activate
 *   - Circuits compiled: cd circuits && nargo build
 *   - VKs generated: bb write_vk --scheme ultra_honk --oracle_hash keccak
 *   - Contracts deployed with real Garaga verifiers (deploy.ts --real)
 *   - Caller must be the authorized_prover on SolvencyProver
 *     (by default it's the deployer; use set_prover to authorize other wallets)
 *
 * Usage: npx tsx scripts/submit-solvency.ts
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

function extractTxHash(output: string): string | null {
  const match = output.match(/[Tt]ransaction[_ ][Hh]ash[:\s]+(0x[0-9a-fA-F]+)/);
  return match ? match[1] : null;
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
 * Noir uses BN254 (~2^254) which is larger than Stark prime (~2^251).
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

  run(`bb prove -b ./target/${circuitName}.json -w ./target/${circuitName}.gz -o ./target_keccak/proof --scheme ultra_honk --oracle_hash keccak`, dir);

  const testsDir = resolve(dir, 'tests');
  mkdirSync(testsDir, { recursive: true });
  const starkliFile = resolve(testsDir, 'starkli_calldata.txt');
  run(`bash -c 'source ${ROOT}/.venv/bin/activate && garaga calldata --system ultra_keccak_zk_honk --proof "${dir}/target_keccak/proof/proof" --vk "${dir}/target_keccak/vk" --public-inputs "${dir}/target_keccak/proof/public_inputs" --format starkli' > "${starkliFile}"`, dir);

  const raw = readFileSync(starkliFile, 'utf-8').trim();
  // starkli format: "LENGTH elem1 elem2 ..." — skip the first token (length)
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
  const solvencyAddr = env.SOLVENCY_PROVER_ADDRESS || env.VITE_SOLVENCY_ADDRESS;

  if (!solvencyAddr) {
    console.error('Error: SOLVENCY_PROVER_ADDRESS not set in .env');
    process.exit(1);
  }

  const G = `--account ${accountName} --accounts-file ${accountsFile} --wait`;
  const U = `--url ${rpcUrl}`;

  console.log('=== Submitting Solvency Proofs (Real Garaga Verification) ===\n');
  console.log(`  SolvencyProver: ${solvencyAddr}`);
  console.log(`  Account:        ${accountName}`);
  console.log(`  NOTE: Caller must be the authorized_prover on SolvencyProver.`);
  console.log(`        If not, run: sncast invoke --function set_prover --calldata <your_address>`);
  console.log('');

  // --- 1. Generate and submit vault solvency proof ---
  console.log('  [1/2] Generating vault solvency proof...');

  // Vault solvency: total_assets >= total_liabilities
  const totalAssets = '100000';      // 100k units
  const totalLiabilities = '80000';  // 80k units
  const numAccounts = 1;

  const { blinding: aBlinding, commitment: aCommitment } = findValidBlinding(totalAssets, 10);
  const { blinding: lBlinding, commitment: lCommitment } = findValidBlinding(totalLiabilities, 50);

  const vaultProof = generateProof('vault_solvency',
    `total_assets = "${totalAssets}"\ntotal_liabilities = "${totalLiabilities}"\nassets_blinding = "${aBlinding}"\nliabilities_blinding = "${lBlinding}"\nassets_commitment = "${aCommitment}"\nliabilities_commitment = "${lCommitment}"\n`);

  // submit_vault_solvency_proof(assets_commitment, liabilities_commitment, num_accounts, proof_data)
  const vaultCD = [
    aCommitment, lCommitment, `${numAccounts}`,
    `0x${vaultProof.length.toString(16)}`, ...vaultProof,
  ].join(' ');

  const vaultCmd = `sncast ${G} invoke ${U} --contract-address ${solvencyAddr} --function submit_vault_solvency_proof --calldata ${vaultCD}`;
  console.log(`\n  Submitting vault solvency proof on-chain...`);

  try {
    const vaultOutput = run(vaultCmd);
    const vaultTx = extractTxHash(vaultOutput);
    if (vaultTx) {
      console.log(`    Transaction: ${vaultTx}`);
      console.log(`    Explorer: https://sepolia.starkscan.co/tx/${vaultTx}`);
    } else {
      console.log(`    Output: ${vaultOutput.substring(0, 200)}`);
    }
    console.log('    Vault solvency proof submitted!\n');
  } catch (err: unknown) {
    const e = err as Error;
    console.error(`    FAILED: ${e.message}`);
    process.exit(1);
  }

  // --- 2. Generate and submit CDP safety proof ---
  console.log('  [2/2] Generating CDP safety proof...');

  // CDP safety: total_collateral * price >= total_debt * safety_ratio_percent * 1e8 / 100
  const totalCollateral = '10000';
  const totalDebt = '5000';
  const price = '5000000000000'; // $50,000 with 1e8 decimals
  const safetyRatioPercent = '200';
  const numCdps = 1;

  const { blinding: colBlinding, commitment: colCommitment } = findValidBlinding(totalCollateral, 150);
  const { blinding: debtBlinding, commitment: debtCommitment } = findValidBlinding(totalDebt, 250);

  const cdpProof = generateProof('cdp_safety_bound',
    `total_collateral = "${totalCollateral}"\ntotal_debt = "${totalDebt}"\ncollateral_blinding = "${colBlinding}"\ndebt_blinding = "${debtBlinding}"\ncollateral_commitment = "${colCommitment}"\ndebt_commitment = "${debtCommitment}"\nprice = "${price}"\nsafety_ratio_percent = "${safetyRatioPercent}"\n`);

  // submit_cdp_safety_proof(collateral_commitment, debt_commitment, price, safety_ratio_percent, num_cdps, proof_data)
  const cdpCD = [
    colCommitment, debtCommitment, price, safetyRatioPercent, `${numCdps}`,
    `0x${cdpProof.length.toString(16)}`, ...cdpProof,
  ].join(' ');

  const cdpCmd = `sncast ${G} invoke ${U} --contract-address ${solvencyAddr} --function submit_cdp_safety_proof --calldata ${cdpCD}`;
  console.log(`\n  Submitting CDP safety proof on-chain...`);

  try {
    const cdpOutput = run(cdpCmd);
    const cdpTx = extractTxHash(cdpOutput);
    if (cdpTx) {
      console.log(`    Transaction: ${cdpTx}`);
      console.log(`    Explorer: https://sepolia.starkscan.co/tx/${cdpTx}`);
    } else {
      console.log(`    Output: ${cdpOutput.substring(0, 200)}`);
    }
    console.log('    CDP safety proof submitted!\n');
  } catch (err: unknown) {
    const e = err as Error;
    console.error(`    FAILED: ${e.message}`);
    process.exit(1);
  }

  console.log('=== Both solvency proofs submitted successfully! ===');
  console.log('  Vault Solvency: Verified (real Garaga proof)');
  console.log('  CDP Safety:     Verified (real Garaga proof)');
  console.log('\n  The Proofs Dashboard should now show green badges.');
  console.log(`\n  SolvencyProver: https://sepolia.starkscan.co/contract/${solvencyAddr}`);
}

main().catch((err) => {
  console.error('\nSolvency proof submission failed:', err.message || err);
  process.exit(1);
});
