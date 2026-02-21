/**
 * Wallet connection hook and provider.
 * Manages Starknet wallet state via get-starknet.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { RpcProvider, type AccountInterface } from 'starknet';
import { getRpcUrl } from '../lib/contracts/config';

interface WalletState {
  account: AccountInterface | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  account: null,
  address: null,
  isConnecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountInterface | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Dynamic import to avoid SSR issues
      const gsModule = await import('get-starknet-core');
      const starknet = gsModule.getStarknet();
      const availableWallets = await starknet.getAvailableWallets();

      if (availableWallets.length === 0) {
        throw new Error('No Starknet wallet found. Please install ArgentX or Braavos.');
      }

      const wallet = availableWallets[0];
      const connectedWallet = await starknet.enable(wallet);

      // The connected wallet object exposes account and address via the window object API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const walletAny = connectedWallet as any;
      if (walletAny.account && walletAny.selectedAddress) {
        setAccount(walletAny.account as AccountInterface);
        setAddress(walletAny.selectedAddress as string);
      } else {
        throw new Error('Wallet connected but no account available.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setAddress(null);
    setError(null);
  }, []);

  // Provide a read-only provider even when wallet is not connected
  useEffect(() => {
    // Pre-initialize the RPC provider
    new RpcProvider({ nodeUrl: getRpcUrl() });
  }, []);

  return (
    <WalletContext.Provider
      value={{ account, address, isConnecting, error, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  return useContext(WalletContext);
}
