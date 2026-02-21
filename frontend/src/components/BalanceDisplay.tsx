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
    if (amount === null) return <span className="text-gray-500">--</span>;
    if (typeof amount === 'string') {
      return (
        <>
          {amount}
          {symbol && <span className="text-sm text-gray-400 ml-1.5">{symbol}</span>}
        </>
      );
    }
    return (
      <>
        {formatAmount(amount, decimals)}
        {symbol && <span className="text-sm text-gray-400 ml-1.5">{symbol}</span>}
      </>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        {shielded && (
          <span className="text-xs bg-shield-700/30 text-shield-300 px-1.5 py-0.5 rounded">
            shielded
          </span>
        )}
      </div>
      <div className="text-xl font-bold text-gray-100">
        {displayValue()}
      </div>
    </div>
  );
}
