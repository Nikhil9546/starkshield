import { Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { WalletProvider } from './hooks/useWallet';
import WalletConnect from './components/WalletConnect';
import LandingPage from './pages/LandingPage';
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

function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <NavLink to="/" className="text-xl font-bold text-shield-400 hover:text-shield-300 transition-colors">
              StarkShield
            </NavLink>
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
        <Outlet />
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center text-xs text-gray-500">
        StarkShield v1.5 — Privacy-Preserving BTC DeFi on Starknet
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <Routes>
        {/* Landing page - full screen, no app layout */}
        <Route path="/" element={<LandingPage />} />

        {/* App pages - with navigation header and footer */}
        <Route element={<AppLayout />}>
          <Route path="/stake" element={<StakePage />} />
          <Route path="/cdp" element={<CDPPage />} />
          <Route path="/withdraw" element={<WithdrawPage />} />
          <Route path="/proofs" element={<ProofsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/stake" replace />} />
      </Routes>
    </WalletProvider>
  );
}
