interface Props {
  domain: 'vault' | 'cdp';
  isSolvent: boolean | null;
  lastVerified: number | null;
  numAccounts?: number | null;
  commitment?: string | null;
  proverAddress?: string | null;
}

function formatTimestamp(ts: number): string {
  if (!ts) return 'Never';
  return new Date(ts * 1000).toLocaleString();
}

function truncate(s: string, len: number = 10): string {
  if (s.length <= len) return s;
  return s.slice(0, len) + '...';
}

export default function SolvencyCard({ domain, isSolvent, lastVerified, numAccounts, commitment, proverAddress }: Props) {
  const isVault = domain === 'vault';
  const label = isVault ? 'Vault Solvency' : 'CDP Safety';

  let statusBadge: string;
  let statusText: string;
  let borderClass: string;
  let glowClass: string;

  if (isSolvent === true) {
    statusBadge = 'badge-green';
    statusText = 'Verified';
    borderClass = 'border-emerald-500/20';
    glowClass = 'shadow-glow-green';
  } else if (isSolvent === false) {
    statusBadge = 'badge-red';
    statusText = 'Unverified';
    borderClass = 'border-red-500/20';
    glowClass = '';
  } else {
    statusBadge = 'badge bg-white/5 text-gray-500 border border-white/10';
    statusText = 'Unknown';
    borderClass = '';
    glowClass = '';
  }

  return (
    <div className={`card-hover ${borderClass} ${glowClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
            isSolvent === true ? 'bg-emerald-500/10 text-emerald-400' :
            isSolvent === false ? 'bg-red-500/10 text-red-400' :
            'bg-white/5 text-gray-500'
          }`}>
            {isVault ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M5 6V4a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            )}
          </div>
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        <span className={statusBadge}>{statusText}</span>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] text-gray-600">
          Last verified: {lastVerified ? formatTimestamp(lastVerified) : 'Never'}
        </div>
        {numAccounts != null && numAccounts > 0 && (
          <div className="text-[11px] text-gray-600">
            {isVault ? 'Accounts' : 'CDPs'} verified: <span className="text-gray-400 font-mono">{numAccounts}</span>
          </div>
        )}
        {commitment && (
          <div className="text-[11px] text-gray-600">
            Commitment: <span className="text-gray-400 font-mono">{truncate(commitment, 14)}</span>
          </div>
        )}
        {proverAddress && (
          <div className="text-[11px] text-gray-600">
            Prover: <span className="text-gray-400 font-mono">{truncate(proverAddress, 14)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
