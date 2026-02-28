import { useWallet } from '../hooks/useWallet';

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const walletStyles = `
  .wallet-btn {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 18px;
    background: linear-gradient(135deg, #3b82f6, #3b82f6);
    box-shadow: 0 0 20px -4px rgba(59,130,246,0.4);
    clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
    font-family: 'Orbitron', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #fff;
    cursor: pointer;
    border: none;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .wallet-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    animation: walletScan 4s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes walletScan {
    0% { left: -100%; }
    50%, 100% { left: 100%; }
  }
  .wallet-btn:hover:not(:disabled) {
    box-shadow: 0 0 30px -4px rgba(59,130,246,0.6);
    transform: translateY(-1px);
    filter: brightness(1.1);
  }
  .wallet-btn:disabled {
    background: rgba(59,130,246,0.3);
    box-shadow: none;
    cursor: not-allowed;
  }
  .wallet-connected {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(59,130,246,0.04);
    border: 1px solid rgba(59,130,246,0.12);
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  }
  .wallet-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
    animation: pulse-indicator 2s ease-in-out infinite;
  }
  @keyframes pulse-indicator {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(0.85); }
  }
  .wallet-address {
    font-family: 'Fira Code', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    letter-spacing: 0.5px;
  }
  .wallet-disconnect {
    font-family: 'Orbitron', sans-serif;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    transition: all 0.2s;
    background: none;
    border: none;
    padding: 4px 8px;
  }
  .wallet-disconnect:hover {
    color: #ef4444;
  }
  .devnet-badge {
    padding: 4px 10px;
    background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.2);
    clip-path: polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px);
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #f59e0b;
  }
`;

export default function WalletConnect() {
  const { address, isConnecting, error, isDevnet, connect, disconnect } = useWallet();

  if (address) {
    return (
      <>
        <style>{walletStyles}</style>
        <div className="flex items-center gap-3">
          {isDevnet && (
            <span className="devnet-badge">Devnet</span>
          )}
          <div className="wallet-connected">
            <div className="wallet-indicator" />
            <span className="wallet-address">
              {truncateAddress(address)}
            </span>
          </div>
          <button
            onClick={disconnect}
            className="wallet-disconnect"
          >
            Disconnect
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{walletStyles}</style>
      <div className="flex items-center gap-3">
        {error && <span style={{ fontSize: 10, color: '#ef4444', fontFamily: "'Fira Code', monospace" }}>{error}</span>}
        <button
          onClick={connect}
          disabled={isConnecting}
          className="wallet-btn"
        >
          {isConnecting ? (
            <span className="flex items-center gap-2">
              <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Connecting...
            </span>
          ) : isDevnet ? 'Connect to Devnet' : 'Connect Wallet'}
        </button>
      </div>
    </>
  );
}
