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
import { Account, WalletAccount, RpcProvider, constants, type AccountInterface } from 'starknet';
import { getRpcUrl, IS_DEVNET, DEVNET_ACCOUNT, DEVNET_RESOURCE_BOUNDS } from '../lib/contracts/config';

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
      const rpcUrl = getRpcUrl();
      const provider = new RpcProvider({ nodeUrl: rpcUrl });
      // Devnet doesn't support "pending" block ID — must use "latest"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (provider as any).channel.blockIdentifier = 'latest';
      const baseAccount = new Account(
        provider,
        DEVNET_ACCOUNT.address,
        DEVNET_ACCOUNT.privateKey,
        '1',
        constants.TRANSACTION_VERSION.V3,
      );

      // Wrap execute to fetch nonce via raw RPC (avoids "pending" block_id issues in devnet)
      const origExecute = baseAccount.execute.bind(baseAccount);
      baseAccount.execute = async function(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transactions: any, arg2?: any, arg3?: any
      ) {
        // Fetch nonce via raw RPC with block_id "latest" (devnet-safe)
        const nonceResp = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', method: 'starknet_getNonce', id: 1,
            params: { block_id: 'latest', contract_address: DEVNET_ACCOUNT.address },
          }),
        });
        const nonceJson = await nonceResp.json();
        const nonce = nonceJson.result;

        // Merge nonce into the details/options (3rd argument)
        const details = arg2 === undefined || Array.isArray(arg2) ? (arg3 || {}) : arg2;
        details.nonce = nonce;

        if (arg2 === undefined || Array.isArray(arg2)) {
          return origExecute(transactions, arg2, { ...DEVNET_RESOURCE_BOUNDS, ...details });
        }
        return origExecute(transactions, { ...DEVNET_RESOURCE_BOUNDS, ...details });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      setAccount(baseAccount);
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

      // get-starknet-core v4: use RPC request to get accounts
      const accounts: string[] = await connectedWallet.request({
        type: 'wallet_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet. Please unlock your wallet and try again.');
      }

      const selectedAddr = accounts[0];
      const rpcUrl = getRpcUrl();
      const provider = new RpcProvider({ nodeUrl: rpcUrl });
      // Cartridge Sepolia RPC doesn't support "pending" block — use "latest"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (provider as any).channel.blockIdentifier = 'latest';

      const walletAccount = new WalletAccount(provider, connectedWallet);

      setAccount(walletAccount);
      setAddress(selectedAddr);
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
