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

export default function BalanceDisplay({
  label,
  amount,
  decimals = 18,
  symbol = '',
  shielded = false,
}: Props) {
  const displayValue = () => {
    if (amount === null) return <span className="text-gray-600">--</span>;
    if (typeof amount === 'string') {
      return (
        <>
          {amount}
          {symbol && <span className="text-sm text-gray-500 ml-1.5 font-normal">{symbol}</span>}
        </>
      );
    }
    return (
      <>
        {formatAmount(amount, decimals)}
        {symbol && <span className="text-sm text-gray-500 ml-1.5 font-normal">{symbol}</span>}
      </>
    );
  };

  return (
    <div className={`card-hover group ${shielded ? 'border-shield-500/20' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
          {label}
        </span>
        {shielded && (
          <span className="badge-shield text-[10px]">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="opacity-70">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            shielded
          </span>
        )}
      </div>
      <div className="text-xl font-bold text-white tracking-tight">
        {displayValue()}
      </div>
    </div>
  );
}
