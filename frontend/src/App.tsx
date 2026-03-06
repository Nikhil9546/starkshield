import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { WalletProvider } from './hooks/useWallet';
import { ToastProvider } from './components/Toast';
import WalletConnect from './components/WalletConnect';
import ObscuraLogo, { logoStyles } from './components/ObscuraLogo';
import AIChat from './components/AIChat';
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

const appStyles = `
  @keyframes scanD { 0% { top: -1px } 100% { top: 100vh } }
  .scan-beam {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(59,130,246,.06), transparent);
    animation: scanD 8s linear infinite;
    pointer-events: none;
    z-index: 998;
  }
  .nav-item {
    position: relative;
    overflow: hidden;
    padding: 8px 16px;
    font-family: 'Orbitron', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
  }
  .nav-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(59,130,246,.08), transparent);
    transition: left 0.4s;
    pointer-events: none;
  }
  .nav-item:hover::before {
    left: 100%;
  }
  .nav-item-active {
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.25);
    color: #3b82f6;
    box-shadow: 0 0 12px rgba(59,130,246,0.1);
  }
  .nav-item-inactive {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.45);
  }
  .nav-item-inactive:hover {
    background: rgba(59,130,246,0.05);
    border-color: rgba(59,130,246,0.15);
    color: rgba(255,255,255,0.75);
  }
`;

function AppLayout() {
  return (
    <div className="relative min-h-screen flex flex-col z-10">
      <style>{appStyles}{logoStyles}</style>

      {/* Scan beam effect */}
      <div className="scan-beam" />

      {/* Top ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] pointer-events-none z-0"
           style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />

      <header className="relative z-20 backdrop-blur-xl" style={{
        background: 'rgba(4,6,11,0.92)',
        borderBottom: '1px solid rgba(59,130,246,0.08)',
      }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="group-hover:scale-105 transition-transform duration-300">
                <ObscuraLogo size={32} glow animated />
              </div>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: 3 }}>OBSCURA</span>
              <span style={{ fontSize: 9, color: 'rgba(59,130,246,0.4)', fontFamily: "'Fira Code', monospace", letterSpacing: 1 }}>v1.5</span>
            </NavLink>

            {/* Navigation */}
            <nav className="flex items-center gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
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

      <footer className="relative z-10 px-6 py-5" style={{ borderTop: '1px solid rgba(59,130,246,0.06)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>
            OBSCURA v1.5 — PRIVACY-PRESERVING BTC DEFI ON STARKNET
          </span>
          <div className="flex items-center gap-4">
            <span className="badge-shield">Sepolia Testnet</span>
            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>NOIR + GARAGA</span>
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
      <ToastProvider>
        <AppLayout />
        <AIChat />
      </ToastProvider>
    </WalletProvider>
  );
}
