interface Props {
  label: string;
  amount: bigint | string | null;
  decimals?: number;
  symbol?: string;
  shielded?: boolean;
}

/**
 * Format a bigint amount with decimals for display.
 * Default 18 decimals (standard ERC20).
 */
function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4);
  return `${whole.toLocaleString()}.${fracStr}`;
}

const balanceStyles = `
  .balance-card {
    position: relative;
    padding: 18px;
    background: linear-gradient(145deg, rgba(59,130,246,0.03), rgba(15,23,42,0.6));
    border: 1px solid rgba(59,130,246,0.1);
    border-radius: 0;
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  .balance-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(59,130,246,0.04), transparent);
    transition: left 0.5s;
    pointer-events: none;
  }
  .balance-card:hover::before {
    left: 100%;
  }
  .balance-card:hover {
    border-color: rgba(59,130,246,0.25);
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(59,130,246,0.08);
  }
  .balance-card-shielded {
    border-color: rgba(59,130,246,0.2);
    background: linear-gradient(145deg, rgba(59,130,246,0.05), rgba(15,23,42,0.7));
  }
  .balance-card-shielded:hover {
    border-color: rgba(59,130,246,0.35);
    box-shadow: 0 8px 30px rgba(59,130,246,0.12);
  }
  .balance-label {
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin-bottom: 8px;
  }
  .balance-value {
    font-family: 'Orbitron', sans-serif;
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.5px;
  }
  .balance-symbol {
    font-family: 'Fira Code', monospace;
    font-size: 11px;
    font-weight: 400;
    color: rgba(59,130,246,0.5);
    margin-left: 6px;
  }
  .balance-shielded-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.2);
    clip-path: polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px);
    font-family: 'Fira Code', monospace;
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #3b82f6;
    margin-left: 8px;
  }
  /* Corner accent */
  .balance-card::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, transparent 50%, rgba(59,130,246,0.1) 50%);
    pointer-events: none;
  }
`;

export default function BalanceDisplay({
  label,
  amount,
  decimals = 18,
  symbol = '',
  shielded = false,
}: Props) {
  const displayValue = () => {
    if (amount === null) return <span style={{ color: 'rgba(255,255,255,0.2)' }}>--</span>;
    if (typeof amount === 'string') {
      return (
        <>
          {amount}
          {symbol && <span className="balance-symbol">{symbol}</span>}
        </>
      );
    }
    return (
      <>
        {formatAmount(amount, decimals)}
        {symbol && <span className="balance-symbol">{symbol}</span>}
      </>
    );
  };

  return (
    <>
      <style>{balanceStyles}</style>
      <div className={`balance-card ${shielded ? 'balance-card-shielded' : ''}`}>
        <div className="flex items-center mb-2">
          <span className="balance-label">{label}</span>
          {shielded && (
            <span className="balance-shielded-badge">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              shielded
            </span>
          )}
        </div>
        <div className="balance-value">
          {displayValue()}
        </div>
      </div>
    </>
  );
}
