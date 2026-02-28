import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { generateKeyPair } from '../lib/privacy/keygen';
import ObscuraLogo, { logoStyles } from '../components/ObscuraLogo';
import {
  storeKeyPair,
  loadKeyPair,
  hasStoredKeyPair,
  deleteKeyPair,
  exportKeyBackup,
  importKeyBackup,
} from '../lib/privacy/storage';

// Page-specific styles
const pageStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-10px) rotate(-1deg); }
  }
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.1); opacity: 0.1; }
    100% { transform: scale(1); opacity: 0.3; }
  }
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes key-glow {
    0%, 100% { filter: drop-shadow(0 0 4px rgba(251,191,36,0.3)); }
    50% { filter: drop-shadow(0 0 12px rgba(251,191,36,0.5)); }
  }
  .page-glow {
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(251,191,36,0.05) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .page-glow-secondary {
    position: fixed;
    bottom: -300px;
    right: -200px;
    width: 600px;
    height: 600px;
    background: radial-gradient(ellipse at center, rgba(79,111,255,0.05) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .hero-icon {
    animation: float 6s ease-in-out infinite;
  }
  .hero-ring {
    animation: pulse-ring 3s ease-in-out infinite;
  }
  .gradient-text {
    background: linear-gradient(135deg, #fff 0%, #fde68a 50%, #fbbf24 100%);
    background-size: 200% 200%;
    animation: gradient-shift 8s ease infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .key-icon {
    animation: key-glow 3s ease-in-out infinite;
  }
`;

export default function SettingsPage() {
  const { address, setPrivacyKey } = useWallet();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [publicKeyDisplay, setPublicKeyDisplay] = useState<string | null>(null);

  const checkKey = () => {
    if (!address) return;
    setHasKey(hasStoredKeyPair(address));
  };

  const handleGenerate = async () => {
    if (!address || !password) return;
    setError(null);
    setStatus(null);

    try {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }

      const keyPair = generateKeyPair();
      await storeKeyPair(address, keyPair, password);
      setHasKey(true);
      setPublicKeyDisplay(
        `(${keyPair.publicKey.x.toString(16).slice(0, 16)}...)`
      );
      setPrivacyKey(keyPair.privateKey);
      setStatus('Key generated and unlocked. Shielded balances will now decrypt automatically.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Key generation failed');
    }
  };

  const handleLoad = async () => {
    if (!address || !password) return;
    setError(null);
    setStatus(null);

    try {
      const kp = await loadKeyPair(address, password);
      if (kp) {
        setPublicKeyDisplay(
          `(${kp.publicKey.x.toString(16).slice(0, 16)}...)`
        );
        setPrivacyKey(kp.privateKey);
        setStatus('Key unlocked. Shielded balances will now decrypt automatically.');
      } else {
        setError('Wrong password or no key found.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load key');
    }
  };

  const handleExport = () => {
    if (!address) return;
    setError(null);

    const backup = exportKeyBackup(address);
    if (!backup) {
      setError('No key to export');
      return;
    }

    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obscura-key-${address.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Backup exported.');
  };

  const handleImport = () => {
    setError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        importKeyBackup(text);
        setHasKey(true);
        setStatus('Backup imported successfully.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
      }
    };
    input.click();
  };

  const handleDelete = () => {
    if (!address) return;
    if (!confirm('Are you sure? This will permanently delete your encryption key. Make sure you have a backup.')) {
      return;
    }
    deleteKeyPair(address);
    setHasKey(false);
    setPublicKeyDisplay(null);
    setPrivacyKey(null);
    setStatus('Key deleted. Shielded balances will show as encrypted.');
  };

  if (!address) {
    return (
      <>
        <style>{pageStyles}{logoStyles}</style>
        <div className="page-glow" />
        <div className="page-glow-secondary" />
        <div className="relative z-10 flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-8 hero-icon">
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-amber-500/15 blur-2xl hero-ring" />
            <ObscuraLogo size={80} glow animated color="#f59e0b" />
          </div>
          <h2 className="text-3xl font-bold gradient-text mb-3">Settings</h2>
          <p className="text-gray-400 max-w-md leading-relaxed">Connect your wallet to manage encryption keys and privacy settings.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageStyles}{logoStyles}</style>
      <div className="page-glow" />
      <div className="page-glow-secondary" />
      <div className="relative z-10 space-y-6">
      {/* Hero Header */}
      <div className="mb-8 flex items-start gap-5">
        <div className="relative flex-shrink-0 hero-icon">
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-amber-500/15 blur-xl hero-ring" />
          <ObscuraLogo size={56} glow animated color="#f59e0b" />
        </div>
        <div>
          <h2 className="text-3xl font-bold gradient-text tracking-tight mb-1">Settings</h2>
          <p className="text-gray-400">
            Manage your ElGamal encryption keys for shielded balances.
          </p>
        </div>
      </div>

      {/* Encryption Key Card */}
      <div className="card space-y-5">
        <div className="flex items-center gap-3">
          <h3 className="section-title">Encryption Key</h3>
          {hasKey === true && (
            <span className="badge-green">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              stored
            </span>
          )}
          {hasKey === false && (
            <span className="badge-yellow">no key</span>
          )}
        </div>

        {/* Key Status */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Status:</span>
          {hasKey === null ? (
            <button
              onClick={checkKey}
              className="text-sm text-shield-400 hover:text-shield-300 transition-colors"
            >
              Check
            </button>
          ) : hasKey ? (
            <span className="text-sm text-emerald-400 font-medium">Key stored</span>
          ) : (
            <span className="text-sm text-yellow-400 font-medium">No key found</span>
          )}
          {publicKeyDisplay && (
            <span className="text-xs text-gray-600 font-mono bg-white/[0.03] px-2 py-0.5 rounded">{publicKeyDisplay}</span>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider font-medium block mb-2">
            Password (encrypts your key in browser storage)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password (min 8 chars)"
            className="input-field w-full"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {!hasKey && (
            <button
              onClick={handleGenerate}
              disabled={!password}
              className="btn-primary text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              Generate New Key
            </button>
          )}
          {hasKey && (
            <button
              onClick={handleLoad}
              disabled={!password}
              className="btn-primary text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M5 6V4a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              Unlock Key
            </button>
          )}
          {hasKey && (
            <button onClick={handleExport} className="btn-secondary text-sm">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M8 10l-3-3M8 10l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M3 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              Export Backup
            </button>
          )}
          <button onClick={handleImport} className="btn-secondary text-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 10V2M8 2l-3 3M8 2l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M3 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
            Import Backup
          </button>
          {hasKey && (
            <button onClick={handleDelete} className="btn-danger text-sm">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              Delete Key
            </button>
          )}
        </div>

        {status && (
          <div className="tx-success">{status}</div>
        )}
        {error && (
          <div className="tx-error">{error}</div>
        )}
      </div>

      {/* About Privacy Keys */}
      <div className="card space-y-3">
        <h3 className="section-title">About Privacy Keys</h3>
        <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
          <p>
            Your ElGamal encryption key is used to encrypt and decrypt your shielded balances.
            Only you can see your actual balance — on-chain, it appears as an encrypted ciphertext.
          </p>
          <p>
            The key is encrypted with your password using AES-256-GCM (PBKDF2 with 100,000 iterations)
            before being stored in your browser.
          </p>
        </div>
        <div className="alert-warning">
          Always keep a backup of your key. If you lose it, your shielded funds cannot be recovered.
        </div>
      </div>
      </div>
    </>
  );
}
