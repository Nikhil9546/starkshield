/**
 * Obscura v1.5 — Generate Verification Keys
 *
 * Compiles Noir circuits, generates verifying keys with Barretenberg,
 * and optionally generates Garaga Cairo verifier contracts.
 *
 * Usage: npx ts-node scripts/generate-vks.ts
 *
 * Prerequisites:
 *   - nargo 1.0.0-beta.16 installed
 *   - bb 3.0.0-nightly.20251104 installed
 *   - garaga 1.0.1 pip package installed (for verifier generation)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const CIRCUITS_DIR = resolve(ROOT, 'circuits');
const VERIFIER_DIR = resolve(ROOT, 'verifier-contracts');

const CIRCUITS = [
  'range_proof',
  'balance_sufficiency',
  'collateral_ratio',
  'debt_update_validity',
  'zero_debt',
  'vault_solvency',
  'cdp_safety_bound',
];

function run(cmd: string, cwd: string): string {
  console.log(`  > ${cmd}`);
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 300000 }).trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    console.error('  Command failed:', error.stderr || error.message);
    throw err;
  }
}

async function main() {
  console.log('=== Obscura v1.5 — Verification Key Generation ===\n');

  // Check tools
  try {
    const nargoVersion = execSync('nargo --version', { encoding: 'utf-8' }).trim();
    console.log(`nargo: ${nargoVersion}`);
  } catch {
    console.error('Error: nargo not found. Install with: noirup --version 1.0.0-beta.16');
    process.exit(1);
  }

  try {
    const bbVersion = execSync('bb --version', { encoding: 'utf-8' }).trim();
    console.log(`bb: ${bbVersion}`);
  } catch {
    console.error('Error: bb not found. Install with: bbup --version 3.0.0-nightly.20251104');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!existsSync(VERIFIER_DIR)) {
    mkdirSync(VERIFIER_DIR, { recursive: true });
  }

  // Step 1: Compile all circuits
  console.log('\n--- Compiling circuits ---');
  for (const circuit of CIRCUITS) {
    const circuitDir = resolve(CIRCUITS_DIR, circuit);
    if (!existsSync(circuitDir)) {
      console.log(`  Skipping ${circuit} (directory not found)`);
      continue;
    }
    console.log(`\n  Compiling ${circuit}...`);
    run('nargo build', circuitDir);
    console.log(`  OK`);
  }

  // Step 2: Run circuit tests
  console.log('\n--- Running circuit tests ---');
  for (const circuit of CIRCUITS) {
    const circuitDir = resolve(CIRCUITS_DIR, circuit);
    if (!existsSync(circuitDir)) continue;
    console.log(`\n  Testing ${circuit}...`);
    run('nargo test', circuitDir);
    console.log(`  OK`);
  }

  // Step 3: Generate verification keys
  console.log('\n--- Generating verification keys ---');
  for (const circuit of CIRCUITS) {
    const circuitDir = resolve(CIRCUITS_DIR, circuit);
    const targetJson = resolve(circuitDir, 'target', `${circuit}.json`);
    const vkPath = resolve(circuitDir, 'target', 'vk');

    if (!existsSync(targetJson)) {
      console.log(`  Skipping ${circuit} (no compiled artifact)`);
      continue;
    }

    console.log(`\n  Generating VK for ${circuit}...`);
    run(`bb write_vk -b ./target/${circuit}.json -o ./target/vk`, circuitDir);

    if (existsSync(vkPath)) {
      console.log(`  VK written to ${vkPath}`);
    } else {
      console.error(`  Warning: VK not found at ${vkPath}`);
    }
  }

  // Step 4: Generate Garaga Cairo verifier contracts (optional)
  console.log('\n--- Generating Garaga verifier contracts ---');
  let garagaAvailable = false;
  try {
    execSync('garaga --version', { encoding: 'utf-8' });
    garagaAvailable = true;
  } catch {
    console.log('  garaga CLI not found. Skipping verifier contract generation.');
    console.log('  Install with: pip install garaga==1.0.1 (Python 3.10 required)');
  }

  if (garagaAvailable) {
    for (const circuit of CIRCUITS) {
      const vkPath = resolve(CIRCUITS_DIR, circuit, 'target', 'vk');
      if (!existsSync(vkPath)) continue;

      console.log(`\n  Generating verifier for ${circuit}...`);
      try {
        run(
          `garaga gen --system ultra_keccak_zk_honk --vk ${vkPath} --output ${VERIFIER_DIR}/${circuit}_verifier.cairo`,
          ROOT,
        );
        console.log(`  OK`);
      } catch {
        console.log(`  Failed (non-fatal — verifier can be generated later)`);
      }
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Circuits compiled: ${CIRCUITS.length}`);
  console.log(`Verification keys: ${CIRCUITS_DIR}/*/target/vk`);
  if (garagaAvailable) {
    console.log(`Verifier contracts: ${VERIFIER_DIR}/`);
  }
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
