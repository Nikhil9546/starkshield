interface Props {
  domain: 'vault' | 'cdp';
  isSolvent: boolean | null;
  lastVerified: number | null;
}

function formatTimestamp(ts: number): string {
  if (!ts) return 'Never';
  return new Date(ts * 1000).toLocaleString();
}

export default function SolvencyCard({ domain, isSolvent, lastVerified }: Props) {
  const label = domain === 'vault' ? 'Vault Solvency' : 'CDP Safety';

  let statusColor = 'text-gray-500';
  let statusText = 'Unknown';
  let borderColor = 'border-gray-800';

  if (isSolvent === true) {
    statusColor = 'text-green-400';
    statusText = 'Verified Solvent';
    borderColor = 'border-green-900/50';
  } else if (isSolvent === false) {
    statusColor = 'text-red-400';
    statusText = 'Not Verified';
    borderColor = 'border-red-900/50';
  }

  return (
    <div className={`bg-gray-900 border ${borderColor} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <span className={`text-sm font-medium ${statusColor}`}>
          {statusText}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        Last verified: {lastVerified ? formatTimestamp(lastVerified) : 'Never'}
      </div>
    </div>
  );
}
