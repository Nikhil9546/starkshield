import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { WalletProvider } from './hooks/useWallet';
import WalletConnect from './components/WalletConnect';
import StakePage from './pages/StakePage';
import CDPPage from './pages/CDPPage';
import WithdrawPage from './pages/WithdrawPage';
import ProofsPage from './pages/ProofsPage';
import SettingsPage from './pages/SettingsPage';

const navItems = [
  { to: '/stake', label: 'Stake' },
  { to: '/cdp', label: 'CDP' },
  { to: '/withdraw', label: 'Withdraw' },
  { to: '/proofs', label: 'Proofs' },
  { to: '/settings', label: 'Settings' },
];

export default function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-shield-400">StarkShield</h1>
              <nav className="flex gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-shield-700/20 text-shield-300'
                          : 'text-gray-400 hover:text-gray-200'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <WalletConnect />
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
          <Routes>
            <Route path="/stake" element={<StakePage />} />
            <Route path="/cdp" element={<CDPPage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/proofs" element={<ProofsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/stake" replace />} />
          </Routes>
        </main>

        <footer className="border-t border-gray-800 px-6 py-4 text-center text-xs text-gray-500">
          StarkShield v1.5 — Privacy-Preserving BTC DeFi on Starknet
        </footer>
      </div>
    </WalletProvider>
  );
}
