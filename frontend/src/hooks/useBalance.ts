/**
 * Hook for reading and decrypting shielded balances.
 */

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from './useWallet';
import { getPublicBalance, getBalanceCiphertext, getTotalDeposited } from '../lib/contracts/vault';
import { getLockedCollateral, getDebtCommitment, hasCDP } from '../lib/contracts/cdp';
import { decryptBalanceFromChain } from '../lib/privacy/decrypt';

export interface ShieldedBalances {
  /** Public (unshielded) balance in vault */
  publicBalance: bigint | null;
  /** Decrypted sxyBTC balance in vault */
  vaultBalance: bigint | null;
  /** Locked collateral in CDP */
  lockedCollateral: bigint | null;
  /** Debt commitment (felt252) -- non-zero means active debt */
  debtCommitment: bigint | null;
  /** Total vault deposits (public aggregate) */
  totalDeposited: bigint | null;
  /** Whether user has an open CDP */
  hasCDP: boolean;
}

interface UseBalanceReturn {
  balances: ShieldedBalances;
  loading: boolean;
  error: string | null;
  refresh: (privateKey?: bigint) => Promise<void>;
}

export function useBalance(): UseBalanceReturn {
  const { account, address, privacyKey } = useWallet();
  const [balances, setBalances] = useState<ShieldedBalances>({
    publicBalance: null,
    vaultBalance: null,
    lockedCollateral: null,
    debtCommitment: null,
    totalDeposited: null,
    hasCDP: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (privateKeyOverride?: bigint) => {
      if (!account || !address) {
        setError('Wallet not connected');
        return;
      }

      setLoading(true);
      setError(null);

      // Use explicit override if provided, otherwise use context privacy key
      const key = privateKeyOverride ?? privacyKey;

      try {
        // Fetch all balances in parallel
        const [pubBal, ciphertext, collateral, debtCommitment, totalDep, cdpExists] = await Promise.all([
          getPublicBalance(account, address).catch((e) => { console.warn('getPublicBalance failed:', e); return BigInt(0); }),
          getBalanceCiphertext(account, address).catch((e) => { console.warn('getBalanceCiphertext failed:', e); return null; }),
          getLockedCollateral(account, address).catch((e) => { console.warn('getLockedCollateral failed:', e); return BigInt(0); }),
          getDebtCommitment(account, address).catch((e) => { console.warn('getDebtCommitment failed:', e); return BigInt(0); }),
          getTotalDeposited(account).catch((e) => { console.warn('getTotalDeposited failed:', e); return BigInt(0); }),
          hasCDP(account, address).catch((e) => { console.warn('hasCDP failed:', e); return false; }),
        ]);

        let vaultBalance: bigint | null = null;
        if (ciphertext && key) {
          vaultBalance = decryptBalanceFromChain(
            ciphertext.c1,
            BigInt(0),
            ciphertext.c2,
            BigInt(0),
            key
          );
        }

        setBalances({
          publicBalance: pubBal,
          vaultBalance,
          lockedCollateral: collateral,
          debtCommitment,
          totalDeposited: totalDep,
          hasCDP: cdpExists,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch balances';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [account, address, privacyKey]
  );

  // Auto-refresh on connect
  useEffect(() => {
    if (account && address) {
      refresh();
    }
  }, [account, address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-refresh when privacy key changes (unlocked/locked)
  useEffect(() => {
    if (account && address && privacyKey !== null) {
      refresh();
    }
  }, [privacyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { balances, loading, error, refresh };
}
