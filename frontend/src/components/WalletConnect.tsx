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
          <span className="badge-yellow text-[10px]">Devnet</span>
        )}
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
          <span className="text-sm text-gray-300 font-mono tracking-tight">
            {truncateAddress(address)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors duration-200"
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
        className="btn-primary text-sm"
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting...
          </span>
        ) : isDevnet ? 'Connect to Devnet' : 'Connect Wallet'}
      </button>
    </div>
  );
}
