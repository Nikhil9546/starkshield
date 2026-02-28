import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { WalletProvider } from './hooks/useWallet';
import WalletConnect from './components/WalletConnect';
import LandingPage from './pages/LandingPage';
import StakePage from './pages/StakePage';
import CDPPage from './pages/CDPPage';
import WithdrawPage from './pages/WithdrawPage';
import ProofsPage from './pages/ProofsPage';
import SettingsPage from './pages/SettingsPage';

const navItems = [
  { to: '/stake', label: 'Stake', icon: '~' },
  { to: '/cdp', label: 'CDP', icon: '#' },
  { to: '/withdraw', label: 'Withdraw', icon: '<' },
  { to: '/proofs', label: 'Proofs', icon: '*' },
  { to: '/settings', label: 'Settings', icon: '%' },
];

function AppLayout() {
  return (
    <div className="relative min-h-screen flex flex-col z-10">
      {/* Top ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-glow-shield pointer-events-none z-0" />

      <header className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-[#050a18]/80">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-shield-600 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow-md transition-shadow duration-300">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none" />
                  <path d="M8 5L11 6.75V10.25L8 12L5 10.25V6.75L8 5Z" fill="white" fillOpacity="0.9" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-white">Obs</span>
                <span className="text-shield-400">cura</span>
              </span>
            </NavLink>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-shield-600/15 text-shield-300 shadow-inner'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
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

      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <Routes>
          <Route path="/stake" element={<StakePage />} />
          <Route path="/cdp" element={<CDPPage />} />
          <Route path="/withdraw" element={<WithdrawPage />} />
          <Route path="/proofs" element={<ProofsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <footer className="relative z-10 border-t border-white/[0.04] px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Obscura v1.5 -- Privacy-Preserving BTC DeFi on Starknet
          </span>
          <div className="flex items-center gap-4">
            <span className="badge-shield text-[10px]">Sepolia Testnet</span>
            <span className="text-xs text-gray-600">Powered by Noir + Garaga</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  if (isLandingPage) {
    return <LandingPage />;
  }

  return (
    <WalletProvider>
      <AppLayout />
    </WalletProvider>
  );
}
