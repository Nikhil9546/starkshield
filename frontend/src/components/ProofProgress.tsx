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

  return (
    <div className={`card mt-4 ${isDone ? 'border-emerald-500/20' : isError ? 'border-red-500/20' : 'border-shield-500/20'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!isError && !isDone && (
            <span className="w-4 h-4 border-2 border-shield-400/30 border-t-shield-400 rounded-full animate-spin" />
          )}
          {isDone && (
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </span>
          )}
          {isError && (
            <span className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[10px] text-red-400">!</span>
          )}
          <span className="text-sm font-medium text-gray-200">
            {isError ? 'Proof Error' : STAGE_LABELS[stage]}
          </span>
        </div>
        {!isError && (
          <span className={`text-xs font-mono ${isDone ? 'text-emerald-400' : 'text-shield-400'}`}>
            {percent}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!isError && (
        <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isDone ? 'bg-emerald-400' : 'bg-gradient-to-r from-shield-600 to-shield-400'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Pipeline stages */}
      {showPipeline && visibleStages.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          {visibleStages.map((s, i) => {
            const sIdx = getStageIndex(s);
            const isCompleted = sIdx < currentIdx;
            const isCurrent = sIdx === currentIdx;
            return (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 min-w-0 ${
                  isCompleted ? 'text-emerald-400' : isCurrent ? 'text-shield-300' : 'text-gray-600'
                }`}>
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    isCompleted ? 'bg-emerald-500/15 border border-emerald-500/30' :
                    isCurrent ? 'bg-shield-500/15 border border-shield-500/30' :
                    'bg-white/[0.03] border border-white/[0.06]'
                  }`}>
                    {isCompleted ? (
                      <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : (sIdx + 1)}
                  </span>
                  <span className="text-[10px] truncate">{STAGE_LABELS[s].split(' ')[0]}</span>
                </div>
                {i < visibleStages.length - 1 && (
                  <div className={`flex-shrink-0 w-3 h-px ${isCompleted ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className={`text-xs ${isError ? 'text-red-400' : isDone ? 'text-emerald-400/70' : 'text-gray-500'}`}>
        {message}
      </p>

      {isError && (
        <p className="text-[11px] text-gray-600 mt-2">
          Check browser console for details. Ensure circuits are loaded.
        </p>
      )}
    </div>
  );
}
