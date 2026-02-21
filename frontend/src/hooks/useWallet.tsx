/**
 * Wallet connection hook and provider.
 * Manages Starknet wallet state via get-starknet (browser wallets)
 * or directly via starknet.js Account for devnet mode.
 * Also manages the ElGamal privacy key for decrypting shielded balances.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { Account, RpcProvider, constants, type AccountInterface } from 'starknet';
import { getRpcUrl, IS_DEVNET, DEVNET_ACCOUNT } from '../lib/contracts/config';

interface WalletState {
  account: AccountInterface | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  isDevnet: boolean;
  /** ElGamal private key for decrypting shielded balances (null = locked) */
  privacyKey: bigint | null;
  /** Whether privacy key is unlocked */
  isKeyUnlocked: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Set the ElGamal private key after unlocking from Settings */
  setPrivacyKey: (key: bigint | null) => void;
}

const WalletContext = createContext<WalletState>({
  account: null,
  address: null,
  isConnecting: false,
  error: null,
  isDevnet: false,
  privacyKey: null,
  isKeyUnlocked: false,
  connect: async () => {},
  disconnect: () => {},
  setPrivacyKey: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountInterface | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyKey, setPrivacyKey] = useState<bigint | null>(null);

  const connectDevnet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const provider = new RpcProvider({ nodeUrl: getRpcUrl() });
      // Devnet doesn't support "pending" block ID — must use "latest"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (provider as any).channel.blockIdentifier = 'latest';
      const devnetAccount = new Account(
        provider,
        DEVNET_ACCOUNT.address,
        DEVNET_ACCOUNT.privateKey,
        '1',
        constants.TRANSACTION_VERSION.V3,
      );
      setAccount(devnetAccount);
      setAddress(DEVNET_ACCOUNT.address);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to devnet';
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectBrowserWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const gsModule = await import('get-starknet-core');
      const starknet = gsModule.getStarknet();
      const availableWallets = await starknet.getAvailableWallets();

      if (availableWallets.length === 0) {
        throw new Error('No Starknet wallet found. Please install ArgentX or Braavos.');
      }

      const wallet = availableWallets[0];
      const connectedWallet = await starknet.enable(wallet);

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

  const connect = useCallback(async () => {
    if (IS_DEVNET) {
      await connectDevnet();
    } else {
      await connectBrowserWallet();
    }
  }, [connectDevnet, connectBrowserWallet]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setAddress(null);
    setError(null);
    setPrivacyKey(null);
  }, []);

  // Auto-connect on devnet
  useEffect(() => {
    if (IS_DEVNET && !account) {
      connectDevnet();
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider
      value={{
        account,
        address,
        isConnecting,
        error,
        isDevnet: IS_DEVNET,
        privacyKey,
        isKeyUnlocked: privacyKey !== null,
        connect,
        disconnect,
        setPrivacyKey,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  return useContext(WalletContext);
}
