/**
 * Hook for reading and decrypting shielded balances.
 */

import { useState, useCallback } from 'react';
import { useWallet } from './useWallet';
import { getBalanceCiphertext, getTotalDeposited } from '../lib/contracts/vault';
import { getLockedCollateral, getPublicDebt, getSUSDBalance } from '../lib/contracts/cdp';
import { decryptBalanceFromChain } from '../lib/privacy/decrypt';

export interface ShieldedBalances {
  /** Decrypted sxyBTC balance in vault */
  vaultBalance: bigint | null;
  /** Locked collateral in CDP (public) */
  lockedCollateral: bigint | null;
  /** sUSD debt (public) */
  debt: bigint | null;
  /** sUSD balance */
  susdBalance: bigint | null;
  /** Total vault deposits (public aggregate) */
  totalDeposited: bigint | null;
}

interface UseBalanceReturn {
  balances: ShieldedBalances;
  loading: boolean;
  error: string | null;
  refresh: (privateKey?: bigint) => Promise<void>;
}

export function useBalance(): UseBalanceReturn {
  const { account, address } = useWallet();
  const [balances, setBalances] = useState<ShieldedBalances>({
    vaultBalance: null,
    lockedCollateral: null,
    debt: null,
    susdBalance: null,
    totalDeposited: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (privateKey?: bigint) => {
      if (!account || !address) {
        setError('Wallet not connected');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch all balances in parallel
        const [ciphertext, collateral, debt, susd, totalDep] = await Promise.all([
          getBalanceCiphertext(account, address).catch(() => null),
          getLockedCollateral(account, address).catch(() => BigInt(0)),
          getPublicDebt(account, address).catch(() => BigInt(0)),
          getSUSDBalance(account, address).catch(() => BigInt(0)),
          getTotalDeposited(account).catch(() => BigInt(0)),
        ]);

        let vaultBalance: bigint | null = null;
        if (ciphertext && privateKey) {
          // c1 and c2 are single felts in our simplified model
          vaultBalance = decryptBalanceFromChain(
            ciphertext.c1,
            BigInt(0),
            ciphertext.c2,
            BigInt(0),
            privateKey
          );
        }

        setBalances({
          vaultBalance,
          lockedCollateral: collateral,
          debt,
          susdBalance: susd,
          totalDeposited: totalDep,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch balances';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [account, address]
  );

  return { balances, loading, error, refresh };
}
