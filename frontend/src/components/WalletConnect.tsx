import { useWallet } from '../hooks/useWallet';

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletConnect() {
  const { address, isConnecting, error, isDevnet, connect, disconnect } = useWallet();

  if (address) {
    return (
      <div className="flex items-center gap-3">
        {isDevnet && (
          <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800/50 px-2 py-0.5 rounded">
            Devnet
          </span>
        )}
        <span className="text-sm text-gray-300 bg-gray-800 px-3 py-1.5 rounded font-mono">
          {truncateAddress(address)}
        </span>
        <button
          onClick={disconnect}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        onClick={connect}
        disabled={isConnecting}
        className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
      >
        {isConnecting ? 'Connecting...' : isDevnet ? 'Connect to Devnet' : 'Connect Wallet'}
      </button>
    </div>
  );
}
