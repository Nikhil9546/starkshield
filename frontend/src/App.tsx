import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { WalletProvider } from './hooks/useWallet';
import WalletConnect from './components/WalletConnect';
import ObscuraLogo, { logoStyles } from './components/ObscuraLogo';
import LandingPage from './pages/LandingPage';
import DocsPage from './pages/DocsPage';
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;800;900&display=swap');
        ${logoStyles}
      `}</style>
      {/* Top ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-glow-shield pointer-events-none z-0" />

      <header className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-[#050a18]/80">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="group-hover:scale-105 transition-transform duration-300">
                <ObscuraLogo size={32} glow animated />
              </div>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: 3 }}>OBSCURA</span>
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
  const isDocsPage = location.pathname === '/docs';

  if (isLandingPage) {
    return <LandingPage />;
  }

  if (isDocsPage) {
    return <DocsPage />;
  }

  return (
    <WalletProvider>
      <AppLayout />
    </WalletProvider>
  );
}
