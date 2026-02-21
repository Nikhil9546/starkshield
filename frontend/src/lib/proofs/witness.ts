/**
 * Witness generation for Noir circuits.
 * Each circuit type has its own witness structure matching the Noir circuit inputs.
 */

import { CircuitType } from './circuits';

export type WitnessMap = Map<number, string>;

/** Witness inputs for range_proof circuit */
export interface RangeProofWitness {
  value: bigint;
  min_val: bigint;
  max_val: bigint;
  blinding: bigint;
  commitment: bigint; // public
}

/** Witness inputs for balance_sufficiency circuit */
export interface BalanceSufficiencyWitness {
  balance: bigint;
  amount: bigint;
  balance_blinding: bigint;
  new_balance_blinding: bigint;
  balance_commitment: bigint; // public
  new_balance_commitment: bigint; // public
}

/** Witness inputs for collateral_ratio circuit */
export interface CollateralRatioWitness {
  collateral_value: bigint;
  debt_value: bigint;
  min_ratio: bigint;
  price: bigint;
  collateral_blinding: bigint;
  debt_blinding: bigint;
  collateral_commitment: bigint; // public
  debt_commitment: bigint; // public
}

/** Witness inputs for debt_update_validity circuit */
export interface DebtUpdateWitness {
  old_debt: bigint;
  new_debt: bigint;
  delta: bigint;
  is_increase: boolean;
  old_blinding: bigint;
  new_blinding: bigint;
  old_commitment: bigint; // public
  new_commitment: bigint; // public
}

/** Witness inputs for zero_debt circuit */
export interface ZeroDebtWitness {
  debt: bigint;
  blinding: bigint;
  commitment: bigint; // public
}

/** Witness inputs for vault_solvency circuit */
export interface VaultSolvencyWitness {
  total_assets: bigint;
  total_liabilities: bigint;
  num_accounts: bigint;
  assets_blinding: bigint;
  liabilities_blinding: bigint;
  assets_commitment: bigint; // public
  liabilities_commitment: bigint; // public
}

/** Witness inputs for cdp_safety_bound circuit */
export interface CDPSafetyWitness {
  total_collateral: bigint;
  total_debt: bigint;
  price: bigint;
  min_ratio: bigint;
  num_cdps: bigint;
  collateral_blinding: bigint;
  debt_blinding: bigint;
  collateral_commitment: bigint; // public
  debt_commitment: bigint; // public
}

export type CircuitWitness =
  | { type: CircuitType.RANGE_PROOF; data: RangeProofWitness }
  | { type: CircuitType.BALANCE_SUFFICIENCY; data: BalanceSufficiencyWitness }
  | { type: CircuitType.COLLATERAL_RATIO; data: CollateralRatioWitness }
  | { type: CircuitType.DEBT_UPDATE_VALIDITY; data: DebtUpdateWitness }
  | { type: CircuitType.ZERO_DEBT; data: ZeroDebtWitness }
  | { type: CircuitType.VAULT_SOLVENCY; data: VaultSolvencyWitness }
  | { type: CircuitType.CDP_SAFETY_BOUND; data: CDPSafetyWitness };

/**
 * Convert a witness structure to a flat input map for noir_js.
 * Keys are the Noir parameter names, values are hex-encoded field elements.
 */
export function generateWitnessInputs(
  witness: CircuitWitness
): Record<string, string> {
  const toHex = (v: bigint | boolean): string => {
    if (typeof v === 'boolean') return v ? '0x1' : '0x0';
    return '0x' + v.toString(16);
  };

  const inputs: Record<string, string> = {};

  switch (witness.type) {
    case CircuitType.RANGE_PROOF: {
      const d = witness.data;
      inputs['value'] = toHex(d.value);
      inputs['min_val'] = toHex(d.min_val);
      inputs['max_val'] = toHex(d.max_val);
      inputs['blinding'] = toHex(d.blinding);
      inputs['commitment'] = toHex(d.commitment);
      break;
    }
    case CircuitType.BALANCE_SUFFICIENCY: {
      const d = witness.data;
      inputs['balance'] = toHex(d.balance);
      inputs['amount'] = toHex(d.amount);
      inputs['balance_blinding'] = toHex(d.balance_blinding);
      inputs['new_balance_blinding'] = toHex(d.new_balance_blinding);
      inputs['balance_commitment'] = toHex(d.balance_commitment);
      inputs['new_balance_commitment'] = toHex(d.new_balance_commitment);
      break;
    }
    case CircuitType.COLLATERAL_RATIO: {
      const d = witness.data;
      inputs['collateral_value'] = toHex(d.collateral_value);
      inputs['debt_value'] = toHex(d.debt_value);
      inputs['min_ratio'] = toHex(d.min_ratio);
      inputs['price'] = toHex(d.price);
      inputs['collateral_blinding'] = toHex(d.collateral_blinding);
      inputs['debt_blinding'] = toHex(d.debt_blinding);
      inputs['collateral_commitment'] = toHex(d.collateral_commitment);
      inputs['debt_commitment'] = toHex(d.debt_commitment);
      break;
    }
    case CircuitType.DEBT_UPDATE_VALIDITY: {
      const d = witness.data;
      inputs['old_debt'] = toHex(d.old_debt);
      inputs['new_debt'] = toHex(d.new_debt);
      inputs['delta'] = toHex(d.delta);
      inputs['is_increase'] = toHex(d.is_increase);
      inputs['old_blinding'] = toHex(d.old_blinding);
      inputs['new_blinding'] = toHex(d.new_blinding);
      inputs['old_commitment'] = toHex(d.old_commitment);
      inputs['new_commitment'] = toHex(d.new_commitment);
      break;
    }
    case CircuitType.ZERO_DEBT: {
      const d = witness.data;
      inputs['debt'] = toHex(d.debt);
      inputs['blinding'] = toHex(d.blinding);
      inputs['commitment'] = toHex(d.commitment);
      break;
    }
    case CircuitType.VAULT_SOLVENCY: {
      const d = witness.data;
      inputs['total_assets'] = toHex(d.total_assets);
      inputs['total_liabilities'] = toHex(d.total_liabilities);
      inputs['num_accounts'] = toHex(d.num_accounts);
      inputs['assets_blinding'] = toHex(d.assets_blinding);
      inputs['liabilities_blinding'] = toHex(d.liabilities_blinding);
      inputs['assets_commitment'] = toHex(d.assets_commitment);
      inputs['liabilities_commitment'] = toHex(d.liabilities_commitment);
      break;
    }
    case CircuitType.CDP_SAFETY_BOUND: {
      const d = witness.data;
      inputs['total_collateral'] = toHex(d.total_collateral);
      inputs['total_debt'] = toHex(d.total_debt);
      inputs['price'] = toHex(d.price);
      inputs['min_ratio'] = toHex(d.min_ratio);
      inputs['num_cdps'] = toHex(d.num_cdps);
      inputs['collateral_blinding'] = toHex(d.collateral_blinding);
      inputs['debt_blinding'] = toHex(d.debt_blinding);
      inputs['collateral_commitment'] = toHex(d.collateral_commitment);
      inputs['debt_commitment'] = toHex(d.debt_commitment);
      break;
    }
  }

  return inputs;
}
