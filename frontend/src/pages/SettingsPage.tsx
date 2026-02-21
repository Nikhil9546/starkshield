import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { generateKeyPair } from '../lib/privacy/keygen';
import {
  storeKeyPair,
  loadKeyPair,
  hasStoredKeyPair,
  deleteKeyPair,
  exportKeyBackup,
  importKeyBackup,
} from '../lib/privacy/storage';

export default function SettingsPage() {
  const { address } = useWallet();
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
      setStatus('Key generated and stored securely.');
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
        setStatus('Key loaded successfully.');
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
    a.download = `starkshield-key-${address.slice(0, 8)}.json`;
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
    setStatus('Key deleted.');
  };

  if (!address) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        <p className="text-gray-400">Connect your wallet to manage settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>
      <p className="text-gray-400">
        Manage your ElGamal encryption keys for shielded balances.
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Encryption Key</h3>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Status:</span>
          {hasKey === null ? (
            <button
              onClick={checkKey}
              className="text-sm text-shield-400 hover:text-shield-300"
            >
              Check
            </button>
          ) : hasKey ? (
            <span className="text-sm text-green-400">Key stored</span>
          ) : (
            <span className="text-sm text-yellow-400">No key found</span>
          )}
          {publicKeyDisplay && (
            <span className="text-xs text-gray-500 font-mono">{publicKeyDisplay}</span>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Password (encrypts your key in browser storage)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password (min 8 chars)"
            className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-shield-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasKey && (
            <button
              onClick={handleGenerate}
              disabled={!password}
              className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
            >
              Generate New Key
            </button>
          )}
          {hasKey && (
            <button
              onClick={handleLoad}
              disabled={!password}
              className="bg-shield-600 hover:bg-shield-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
            >
              Unlock Key
            </button>
          )}
          {hasKey && (
            <button
              onClick={handleExport}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium px-4 py-2 rounded transition-colors"
            >
              Export Backup
            </button>
          )}
          <button
            onClick={handleImport}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            Import Backup
          </button>
          {hasKey && (
            <button
              onClick={handleDelete}
              className="bg-red-900/50 hover:bg-red-800/50 text-red-400 text-sm font-medium px-4 py-2 rounded transition-colors"
            >
              Delete Key
            </button>
          )}
        </div>

        {status && (
          <div className="p-3 bg-green-900/20 border border-green-800/50 rounded text-sm text-green-400">
            {status}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800/50 rounded text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">About Privacy Keys</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <p>
            Your ElGamal encryption key is used to encrypt and decrypt your shielded balances.
            Only you can see your actual balance — on-chain, it appears as an encrypted ciphertext.
          </p>
          <p>
            The key is encrypted with your password using AES-256-GCM (PBKDF2 with 100,000 iterations)
            before being stored in your browser.
          </p>
          <p className="text-yellow-400/80">
            Always keep a backup of your key. If you lose it, your shielded funds cannot be recovered.
          </p>
        </div>
      </div>
    </div>
  );
}
