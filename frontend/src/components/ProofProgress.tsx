import type { ProofProgress as ProofProgressType } from '../lib/proofs/prover';

interface Props {
  progress: ProofProgressType | null;
  error?: string | null;
}

const STAGE_LABELS: Record<ProofProgressType['stage'], string> = {
  loading: 'Loading Circuit',
  witnessing: 'Generating Witness',
  proving: 'Proving',
  done: 'Complete',
  error: 'Error',
};

export default function ProofProgress({ progress, error }: Props) {
  if (!progress && !error) return null;

  const stage = progress?.stage || 'error';
  const percent = progress?.percent || 0;
  const message = error || progress?.message || '';
  const isError = stage === 'error' || !!error;
  const isDone = stage === 'done';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-200">
          {isError ? 'Proof Error' : STAGE_LABELS[stage]}
        </span>
        {!isError && (
          <span className="text-xs text-gray-400">{percent}%</span>
        )}
      </div>

      {!isError && (
        <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isDone ? 'bg-green-500' : 'bg-shield-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <p className={`text-xs ${isError ? 'text-red-400' : 'text-gray-400'}`}>
        {message}
      </p>

      {isError && (
        <p className="text-xs text-gray-500 mt-1">
          Check browser console for details. Ensure circuits are loaded.
        </p>
      )}
    </div>
  );
}
