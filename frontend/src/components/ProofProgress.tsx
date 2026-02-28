import type { ProofProgress as ProofProgressType } from '../lib/proofs/prover';

interface Props {
  progress: ProofProgressType | null;
  error?: string | null;
}

const STAGES: ProofProgressType['stage'][] = [
  'loading',
  'witnessing',
  'proving',
  'encoding',
  'submitting',
  'confirming',
  'verified',
  'done',
];

const STAGE_LABELS: Record<ProofProgressType['stage'], string> = {
  loading: 'Loading Circuit',
  witnessing: 'Generating Witness',
  proving: 'Generating ZK Proof',
  encoding: 'Encoding Garaga Calldata',
  submitting: 'Submitting to Starknet',
  confirming: 'Waiting for Confirmation',
  verified: 'Proof Verified On-Chain',
  done: 'Complete',
  error: 'Error',
};

function getStageIndex(stage: ProofProgressType['stage']): number {
  const idx = STAGES.indexOf(stage);
  return idx >= 0 ? idx : -1;
}

const progressStyles = `
  .proof-progress-card {
    position: relative;
    margin-top: 16px;
    padding: 18px;
    background: linear-gradient(145deg, rgba(59,130,246,0.03), rgba(15,23,42,0.6));
    border-radius: 0;
    clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
    overflow: hidden;
  }
  .proof-progress-active {
    border: 1px solid rgba(59,130,246,0.2);
  }
  .proof-progress-done {
    border: 1px solid rgba(16,185,129,0.2);
    background: linear-gradient(145deg, rgba(16,185,129,0.03), rgba(15,23,42,0.6));
  }
  .proof-progress-error {
    border: 1px solid rgba(239,68,68,0.2);
    background: linear-gradient(145deg, rgba(239,68,68,0.03), rgba(15,23,42,0.6));
  }
  .proof-progress-bar {
    height: 4px;
    background: rgba(255,255,255,0.04);
    clip-path: polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px);
    overflow: hidden;
  }
  .proof-progress-fill {
    height: 100%;
    transition: width 0.5s ease-out;
  }
  .proof-progress-fill-active {
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
  }
  .proof-progress-fill-done {
    background: linear-gradient(90deg, #10b981, #34d399);
  }
  .proof-stage-step {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }
  .proof-stage-dot {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Orbitron', sans-serif;
    font-size: 8px;
    font-weight: 700;
    clip-path: polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px);
  }
  .proof-stage-dot-completed {
    background: rgba(16,185,129,0.15);
    border: 1px solid rgba(16,185,129,0.3);
    color: #10b981;
  }
  .proof-stage-dot-current {
    background: rgba(59,130,246,0.15);
    border: 1px solid rgba(59,130,246,0.3);
    color: #3b82f6;
  }
  .proof-stage-dot-pending {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.25);
  }
  .proof-stage-label {
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    letter-spacing: 0.5px;
  }
  .proof-stage-connector {
    flex-shrink: 0;
    width: 12px;
    height: 1px;
  }
  .proof-stage-connector-completed {
    background: rgba(16,185,129,0.3);
  }
  .proof-stage-connector-pending {
    background: rgba(255,255,255,0.06);
  }
`;

export default function ProofProgress({ progress, error }: Props) {
  if (!progress && !error) return null;

  const stage = progress?.stage || 'error';
  const percent = progress?.percent || 0;
  const message = error || progress?.message || '';
  const isError = stage === 'error' || !!error;
  const isDone = stage === 'done' || stage === 'verified';
  const currentIdx = getStageIndex(stage);

  // Show pipeline steps for non-trivial progress
  const showPipeline = !isError && currentIdx >= 0;

  // Only show the most relevant 4 stages based on current position
  const visibleStages = showPipeline
    ? STAGES.filter((_, i) => {
        if (currentIdx <= 3) return i < 4; // early stages: show first 4
        if (currentIdx >= STAGES.length - 3) return i >= STAGES.length - 4; // late stages: show last 4
        return i >= currentIdx - 1 && i <= currentIdx + 2; // middle: show window
      })
    : [];

  const cardClass = isDone ? 'proof-progress-done' : isError ? 'proof-progress-error' : 'proof-progress-active';

  return (
    <>
      <style>{progressStyles}</style>
      <div className={`proof-progress-card ${cardClass}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {!isError && !isDone && (
              <span style={{ width: 16, height: 16, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            )}
            {isDone && (
              <span style={{ width: 16, height: 16, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)' }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-8" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </span>
            )}
            {isError && (
              <span style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)', color: '#ef4444', fontSize: 10, fontWeight: 700 }}>!</span>
            )}
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}>
              {isError ? 'Proof Error' : STAGE_LABELS[stage]}
            </span>
          </div>
          {!isError && (
            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: isDone ? '#10b981' : '#3b82f6' }}>
              {percent}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!isError && (
          <div className="proof-progress-bar" style={{ marginBottom: 16 }}>
            <div
              className={`proof-progress-fill ${isDone ? 'proof-progress-fill-done' : 'proof-progress-fill-active'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        {/* Pipeline stages */}
        {showPipeline && visibleStages.length > 0 && (
          <div className="flex items-center gap-1 mb-4">
            {visibleStages.map((s, i) => {
              const sIdx = getStageIndex(s);
              const isCompleted = sIdx < currentIdx;
              const isCurrent = sIdx === currentIdx;
              const dotClass = isCompleted ? 'proof-stage-dot-completed' : isCurrent ? 'proof-stage-dot-current' : 'proof-stage-dot-pending';
              const labelColor = isCompleted ? '#10b981' : isCurrent ? '#3b82f6' : 'rgba(255,255,255,0.35)';
              return (
                <div key={s} className="proof-stage-step">
                  <div className={`proof-stage-dot ${dotClass}`}>
                    {isCompleted ? (
                      <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : (sIdx + 1)}
                  </div>
                  <span className="proof-stage-label" style={{ color: labelColor }}>{STAGE_LABELS[s].split(' ')[0]}</span>
                  {i < visibleStages.length - 1 && (
                    <div className={`proof-stage-connector ${isCompleted ? 'proof-stage-connector-completed' : 'proof-stage-connector-pending'}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: isError ? '#ef4444' : isDone ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.4)' }}>
          {message}
        </p>

        {isError && (
          <p style={{ fontFamily: "'Fira Code', monospace", fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
            Check browser console for details. Ensure circuits are loaded.
          </p>
        )}
      </div>
    </>
  );
}
