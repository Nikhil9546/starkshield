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

const solvencyStyles = `
  .solvency-card {
    position: relative;
    padding: 20px;
    background: linear-gradient(145deg, rgba(59,130,246,0.03), rgba(15,23,42,0.6));
    border-radius: 0;
    clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  .solvency-card::before {
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
  .solvency-card:hover::before {
    left: 100%;
  }
  .solvency-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(59,130,246,0.08);
  }
  .solvency-verified {
    border: 1px solid rgba(16,185,129,0.2);
    background: linear-gradient(145deg, rgba(16,185,129,0.04), rgba(15,23,42,0.6));
  }
  .solvency-verified:hover {
    border-color: rgba(16,185,129,0.35);
    box-shadow: 0 8px 30px rgba(16,185,129,0.1);
  }
  .solvency-unverified {
    border: 1px solid rgba(239,68,68,0.2);
    background: linear-gradient(145deg, rgba(239,68,68,0.04), rgba(15,23,42,0.6));
  }
  .solvency-unknown {
    border: 1px solid rgba(59,130,246,0.1);
  }
  .solvency-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
  }
  .solvency-icon-verified {
    background: rgba(16,185,129,0.1);
    color: #10b981;
  }
  .solvency-icon-unverified {
    background: rgba(239,68,68,0.1);
    color: #ef4444;
  }
  .solvency-icon-unknown {
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.4);
  }
  .solvency-label {
    font-family: 'Orbitron', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.5px;
  }
  .solvency-meta {
    font-family: 'Fira Code', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.35);
    line-height: 1.8;
  }
  .solvency-meta-value {
    color: rgba(255,255,255,0.55);
  }
`;

export default function SolvencyCard({ domain, isSolvent, lastVerified, numAccounts, commitment, proverAddress }: Props) {
  const isVault = domain === 'vault';
  const label = isVault ? 'Vault Solvency' : 'CDP Safety';

  let statusClass: string;
  let iconClass: string;
  let badgeClass: string;
  let statusText: string;

  if (isSolvent === true) {
    statusClass = 'solvency-verified';
    iconClass = 'solvency-icon-verified';
    badgeClass = 'badge-green';
    statusText = 'VERIFIED';
  } else if (isSolvent === false) {
    statusClass = 'solvency-unverified';
    iconClass = 'solvency-icon-unverified';
    badgeClass = 'badge-red';
    statusText = 'UNVERIFIED';
  } else {
    statusClass = 'solvency-unknown';
    iconClass = 'solvency-icon-unknown';
    badgeClass = 'badge';
    statusText = 'UNKNOWN';
  }

  return (
    <>
      <style>{solvencyStyles}</style>
      <div className={`solvency-card ${statusClass}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`solvency-icon ${iconClass}`}>
              {isVault ? (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M5 6V4a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              )}
            </div>
            <span className="solvency-label">{label}</span>
          </div>
          <span className={badgeClass}>{statusText}</span>
        </div>

        <div className="solvency-meta space-y-1">
          <div>
            Last verified: <span className="solvency-meta-value">{lastVerified ? formatTimestamp(lastVerified) : 'Never'}</span>
          </div>
          {numAccounts != null && numAccounts > 0 && (
            <div>
              {isVault ? 'Accounts' : 'CDPs'} verified: <span className="solvency-meta-value">{numAccounts}</span>
            </div>
          )}
          {commitment && (
            <div>
              Commitment: <span className="solvency-meta-value">{truncate(commitment, 14)}</span>
            </div>
          )}
          {proverAddress && (
            <div>
              Prover: <span className="solvency-meta-value">{truncate(proverAddress, 14)}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
