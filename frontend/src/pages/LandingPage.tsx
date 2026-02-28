import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Eye, Zap, Target,
  Link2, TrendingUp, Database, Cpu, Layers, Fingerprint, ScanLine,
  Activity, ArrowRight, Binary, FileCode,
  ChevronDown, ChevronUp, Hexagon, CircuitBoard, Waypoints,
  Bot, Wallet, BarChart3, Settings, Terminal, Radio,
  RefreshCw, Send, Sparkles, Search, X, Gauge, AlertTriangle, Play,
  LucideIcon
} from "lucide-react";

// ─── PARTICLE SYSTEM (mouse-reactive) ───
const ParticleField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const mouse = { x: -999, y: -999 };
    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; pulse: number; hue: number;
    }[] = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const onMouse = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMouse);

    for (let i = 0; i < 140; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.4, opacity: Math.random() * 0.4 + 0.08,
        pulse: Math.random() * Math.PI * 2, hue: 205 + Math.random() * 30,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        const dx2 = p.x - mouse.x, dy2 = p.y - mouse.y;
        const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 < 140) { p.vx += (dx2 / d2) * 0.12; p.vy += (dy2 / d2) * 0.12; }
        p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy; p.pulse += 0.015;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        const g = Math.sin(p.pulse) * 0.3 + 0.7;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * g, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,65%,${p.opacity * g})`; ctx.fill();
        particles.slice(i + 1).forEach((p2) => {
          const dx = p.x - p2.x, dy = p.y - p2.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(215,100%,60%,${0.05 * (1 - dist / 100)})`; ctx.lineWidth = 0.5; ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMouse); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }} />;
};

// ─── GLITCH TEXT ───
const GlitchText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const [g, setG] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => { setG(true); setTimeout(() => setG(false), 180); }, 4500 + Math.random() * 5000);
    return () => clearInterval(iv);
  }, []);
  return <div className={`${className} ${g ? "glitch-active" : ""}`}>{children}</div>;
};

// ─── TYPEWRITER ───
const TypeWriter = ({ text, speed = 30, delay = 0 }: { text: string; speed?: number; delay?: number }) => {
  const [d, setD] = useState("");
  const [s, setS] = useState(false);
  useEffect(() => { setD(""); setS(false); const t = setTimeout(() => setS(true), delay); return () => clearTimeout(t); }, [text, delay]);
  useEffect(() => { if (!s) return; if (d.length < text.length) { const t = setTimeout(() => setD(text.slice(0, d.length + 1)), speed); return () => clearTimeout(t); } }, [d, s, text, speed]);
  return <span>{d}{d.length < text.length && s && <span className="cursor-blink">▊</span>}</span>;
};

// ─── ANIMATED COUNTER ───
const AnimCounter = ({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) => {
  const [c, setC] = useState(0);
  const [v, setV] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: 0.5 }); if (ref.current) o.observe(ref.current); return () => o.disconnect(); }, []);
  useEffect(() => { if (!v) return; let s = 0; const step = end / (duration / 16); const iv = setInterval(() => { s += step; if (s >= end) { setC(end); clearInterval(iv); } else setC(Math.floor(s)); }, 16); return () => clearInterval(iv); }, [v, end, duration]);
  return <span ref={ref}>{c}{suffix}</span>;
};

// ─── ICON CARD with orbital animation ───
interface IconCardProps {
  icon: LucideIcon;
  label: string;
  desc: string;
  color?: string;
  delay?: number;
  index?: number;
}

const IconCard = ({ icon: Icon, label, desc, color = "#3b82f6", delay = 0, index = 0 }: IconCardProps) => {
  const [vis, setVis] = useState(false);
  const [hover, setHover] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.15 });
      if (ref.current) o.observe(ref.current);
      return () => o.disconnect();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`icon-card ${vis ? "ic-visible" : ""} ${hover ? "ic-hover" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }}
      style={{
        "--mx": mousePos.x, "--my": mousePos.y,
        "--card-color": color, "--card-delay": `${delay}ms`,
        transitionDelay: `${delay}ms`,
      } as React.CSSProperties}
    >
      {/* Spotlight follow */}
      <div className="ic-spotlight" />

      {/* Animated border */}
      <div className="ic-border-glow" />

      {/* Corner brackets */}
      <div className="corner c-tl" style={{ borderColor: `${color}25` }} />
      <div className="corner c-br" style={{ borderColor: `${color}25` }} />

      {/* Icon container with orbital ring */}
      <div className="ic-icon-wrap">
        <div className="ic-orbital" style={{ borderColor: `${color}20` }}>
          <div className="ic-orbital-dot" style={{ background: color }} />
        </div>
        <div className="ic-icon-bg" style={{
          background: `${color}10`,
          boxShadow: hover ? `0 0 30px ${color}20, inset 0 0 20px ${color}08` : `0 0 15px ${color}08`,
        }}>
          <Icon size={22} color={color} strokeWidth={1.5} />
        </div>
      </div>

      {/* Content */}
      <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.7, fontWeight: 300 }}>
        {desc}
      </div>

      {/* Bottom energy line */}
      <div className="ic-energy" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)`, animationDelay: `${index * 0.6}s` }} />

      {/* Data flow dots */}
      <div className="ic-data-flow">
        {[0, 1, 2].map(i => (
          <div key={i} className="ic-flow-dot" style={{
            background: color, animationDelay: `${i * 0.8}s`, left: `${20 + i * 30}%`,
          }} />
        ))}
      </div>
    </div>
  );
};

// ─── DATA STREAM ───
const DataStream = ({ side = "left" }: { side?: "left" | "right" }) => {
  const chars = "01▓▒░█┃┣┫╋╬◆◇⬡⎔".split("");
  const [lines] = useState(() =>
    Array.from({ length: 22 }, () => ({
      text: Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
      speed: 3 + Math.random() * 5, opacity: 0.03 + Math.random() * 0.08,
    }))
  );
  return (
    <div style={{ position: "fixed", [side]: 0, top: 0, width: "30px", height: "100%", overflow: "hidden", pointerEvents: "none", zIndex: 2, fontFamily: "'Fira Code',monospace", fontSize: "8px" }}>
      {lines.map((l, i) => (
        <div key={i} className="data-stream-line" style={{ position: "absolute", [side]: "3px", color: "#3b82f6", opacity: l.opacity, animationDuration: `${l.speed}s`, animationDelay: `${i * 0.25}s`, whiteSpace: "nowrap", writingMode: "vertical-rl" }}>{l.text}</div>
      ))}
    </div>
  );
};

// ─── SHIELD ICON SVG ───
const ShieldLogo = ({ size = 40, glow = false }: { size?: number; glow?: boolean }) => (
  <div className={glow ? "shield-glow" : ""}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" strokeWidth="2" />
    </svg>
  </div>
);

// ─── AGENT ARENA FLOATING DOCK ───
const AgentDock = () => {
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState("idle");

  useEffect(() => {
    const iv = setInterval(() => {
      const states = ["idle", "scanning", "active", "idle", "idle"];
      setAgentStatus(states[Math.floor(Math.random() * states.length)]);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const dockItems = [
    { icon: Bot, label: "Agent", color: "#3b82f6", panel: "agent", badge: agentStatus === "active" ? "LIVE" : null },
    { icon: Shield, label: "Vault", color: "#8b5cf6", panel: "vault" },
    { icon: Wallet, label: "Wallet", color: "#06b6d4", panel: "wallet" },
    { icon: BarChart3, label: "Analytics", color: "#10b981", panel: "analytics" },
    { icon: Terminal, label: "Console", color: "#f59e0b", panel: "console" },
    { icon: Settings, label: "Config", color: "#6b7280", panel: "settings" },
  ];

  const getScale = (idx: number) => {
    if (hoveredIdx === -1) return 1;
    const diff = Math.abs(idx - hoveredIdx);
    if (diff === 0) return 1.45;
    if (diff === 1) return 1.2;
    if (diff === 2) return 1.05;
    return 1;
  };

  const getTranslateY = (idx: number) => {
    if (hoveredIdx === -1) return 0;
    const diff = Math.abs(idx - hoveredIdx);
    if (diff === 0) return -18;
    if (diff === 1) return -8;
    if (diff === 2) return -3;
    return 0;
  };

  return (
    <>
      {/* Expanded Panel */}
      {expandedPanel && (
        <div className="dock-panel-overlay" onClick={() => setExpandedPanel(null)}>
          <div className="dock-panel" onClick={e => e.stopPropagation()}>
            <DockPanel type={expandedPanel} onClose={() => setExpandedPanel(null)} agentStatus={agentStatus} />
          </div>
        </div>
      )}

      {/* The Dock */}
      <div className="agent-dock-container">
        {/* Status indicator line */}
        <div className="dock-status-line" style={{
          background: agentStatus === "active" ? "#10b981" :
            agentStatus === "scanning" ? "#f59e0b" :
            agentStatus === "alert" ? "#ef4444" : "#3b82f6"
        }} />

        <div className="agent-dock">
          {dockItems.map((item, idx) => {
            const scale = getScale(idx);
            const translateY = getTranslateY(idx);
            const isHovered = hoveredIdx === idx;
            const isActive = expandedPanel === item.panel;

            return (
              <div
                key={idx}
                className={`dock-item ${isActive ? "dock-item-active" : ""}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(-1)}
                onClick={() => setExpandedPanel(expandedPanel === item.panel ? null : item.panel)}
                style={{
                  transform: `scale(${scale}) translateY(${translateY}px)`,
                  transition: "all 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
                  zIndex: isHovered ? 10 : 1,
                }}
              >
                {/* Glow ring */}
                <div className="dock-item-glow" style={{
                  background: isHovered || isActive ? `radial-gradient(circle, ${item.color}25 0%, transparent 70%)` : "transparent",
                  boxShadow: isActive ? `0 0 20px ${item.color}30` : "none",
                }} />

                {/* Icon bg */}
                <div className="dock-item-icon" style={{
                  background: isActive ? `${item.color}20` : `rgba(255,255,255,0.04)`,
                  borderColor: isHovered || isActive ? `${item.color}50` : "rgba(255,255,255,0.06)",
                  boxShadow: isHovered ? `0 4px 20px ${item.color}20, inset 0 0 20px ${item.color}08` : "none",
                }}>
                  <item.icon size={18} color={isActive ? item.color : isHovered ? item.color : "rgba(255,255,255,0.5)"} strokeWidth={1.5} />

                  {/* Badge */}
                  {item.badge && (
                    <div className="dock-badge">
                      <span className="dock-badge-dot" />
                      {item.badge}
                    </div>
                  )}
                </div>

                {/* Tooltip */}
                <div className="dock-tooltip" style={{
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(4px)",
                  background: `${item.color}18`,
                  borderColor: `${item.color}30`,
                }}>
                  <span style={{ color: item.color }}>{item.label}</span>
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <div className="dock-active-dot" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                )}
              </div>
            );
          })}

          {/* Separator */}
          <div className="dock-separator" />

          {/* Power / Status button */}
          <div
            className="dock-item"
            onMouseEnter={() => setHoveredIdx(99)}
            onMouseLeave={() => setHoveredIdx(-1)}
            style={{
              transform: `scale(${hoveredIdx === 99 ? 1.3 : 1}) translateY(${hoveredIdx === 99 ? -12 : 0}px)`,
              transition: "all 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            <div className="dock-item-icon dock-power-btn" style={{
              borderColor: agentStatus === "active" ? "#10b98140" :
                agentStatus === "scanning" ? "#f59e0b40" : "rgba(255,255,255,0.06)",
            }}>
              <Radio size={16} color={
                agentStatus === "active" ? "#10b981" :
                agentStatus === "scanning" ? "#f59e0b" :
                agentStatus === "alert" ? "#ef4444" : "rgba(255,255,255,0.35)"
              } strokeWidth={1.5} className={agentStatus === "scanning" ? "spin-slow" : ""} />
            </div>
            <div className="dock-tooltip" style={{
              opacity: hoveredIdx === 99 ? 1 : 0,
              transform: hoveredIdx === 99 ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(4px)",
            }}>
              <span style={{ color: agentStatus === "active" ? "#10b981" : "#6b7280", fontSize: 9 }}>
                {agentStatus.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── DOCK PANEL CONTENT ───
const DockPanel = ({ type, onClose, agentStatus }: { type: string; onClose: () => void; agentStatus: string }) => {
  const panels: Record<string, { title: string; icon: LucideIcon; color: string; content: React.ReactNode }> = {
    agent: {
      title: "SHIELD AGENT",
      icon: Bot,
      color: "#3b82f6",
      content: (
        <div className="panel-content">
          <div className="panel-status-row">
            <div className="panel-status-indicator" style={{ background: agentStatus === "active" ? "#10b981" : "#3b82f6" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'Fira Code'" }}>
              Agent Status: {agentStatus.toUpperCase()}
            </span>
          </div>
          <div className="panel-agent-actions">
            {[
              { label: "Scan Mempool", icon: Search, desc: "Monitor for MEV threats" },
              { label: "Shield Balance", icon: Shield, desc: "Encrypt visible positions" },
              { label: "Auto-Compound", icon: RefreshCw, desc: "Reinvest yield privately" },
              { label: "Risk Assessment", icon: AlertTriangle, desc: "Evaluate collateral health" },
            ].map((action, i) => (
              <button key={i} className="panel-action-btn">
                <action.icon size={14} strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{action.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{action.desc}</div>
                </div>
                <Play size={10} color="rgba(255,255,255,0.2)" style={{ marginLeft: "auto" }} />
              </button>
            ))}
          </div>
        </div>
      ),
    },
    vault: {
      title: "SHIELDED VAULT",
      icon: Shield,
      color: "#8b5cf6",
      content: (
        <div className="panel-content">
          <div className="panel-vault-stats">
            <div className="panel-stat-card">
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'Fira Code'", letterSpacing: 1 }}>SHIELDED BTC</div>
              <div style={{ fontSize: 22, fontFamily: "'Orbitron'", fontWeight: 900, color: "#8b5cf6" }}>▓▓▓.▓▓</div>
              <div style={{ fontSize: 8, color: "rgba(139,92,246,0.5)" }}>ENCRYPTED</div>
            </div>
            <div className="panel-stat-card">
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'Fira Code'", letterSpacing: 1 }}>YIELD (APY)</div>
              <div style={{ fontSize: 22, fontFamily: "'Orbitron'", fontWeight: 900, color: "#10b981" }}>▓.▓▓%</div>
              <div style={{ fontSize: 8, color: "rgba(16,185,129,0.5)" }}>PRIVATE</div>
            </div>
          </div>
          <div className="panel-vault-actions">
            <button className="arena-btn arena-btn-primary" style={{ "--btn-color": "#8b5cf6" } as React.CSSProperties}>
              <Lock size={12} /> DEPOSIT & SHIELD
            </button>
            <button className="arena-btn arena-btn-outline" style={{ "--btn-color": "#8b5cf6" } as React.CSSProperties}>
              <Unlock size={12} /> UNSHIELD
            </button>
          </div>
        </div>
      ),
    },
    wallet: {
      title: "CONNECTED WALLET",
      icon: Wallet,
      color: "#06b6d4",
      content: (
        <div className="panel-content">
          <div className="panel-wallet-addr">
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'Fira Code'", marginBottom: 6 }}>ADDRESS</div>
            <div className="panel-addr-box">
              <code>0x7a3f...8b2e</code>
              <button className="panel-copy-btn">COPY</button>
            </div>
          </div>
          <div className="panel-wallet-tokens">
            {[
              { name: "xyBTC", amount: "—.——", status: "Public" },
              { name: "sxyBTC", amount: "▓▓.▓▓", status: "Shielded" },
              { name: "sUSD", amount: "▓▓▓.▓▓", status: "Shielded" },
            ].map((tok, i) => (
              <div key={i} className="panel-token-row">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="panel-token-dot" style={{ background: tok.status === "Shielded" ? "#8b5cf6" : "#06b6d4" }} />
                  <span style={{ fontSize: 11, fontFamily: "'Orbitron'", fontWeight: 600, color: "#fff" }}>{tok.name}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontFamily: "'Fira Code'", color: "#fff" }}>{tok.amount}</div>
                  <div style={{ fontSize: 8, color: tok.status === "Shielded" ? "#8b5cf6" : "rgba(255,255,255,0.3)" }}>{tok.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    analytics: {
      title: "PRIVACY ANALYTICS",
      icon: BarChart3,
      color: "#10b981",
      content: (
        <div className="panel-content">
          <div className="panel-analytics-grid">
            {[
              { label: "Privacy Score", value: "94", unit: "/100", color: "#10b981" },
              { label: "Shield Rate", value: "87", unit: "%", color: "#8b5cf6" },
              { label: "MEV Blocked", value: "23", unit: "txns", color: "#ef4444" },
              { label: "Gas Saved", value: "0.12", unit: "ETH", color: "#f59e0b" },
            ].map((stat, i) => (
              <div key={i} className="panel-analytics-card">
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", fontFamily: "'Fira Code'", letterSpacing: 1.5, marginBottom: 4 }}>{stat.label.toUpperCase()}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span style={{ fontSize: 20, fontFamily: "'Orbitron'", fontWeight: 900, color: stat.color }}>{stat.value}</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{stat.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    console: {
      title: "ZK CONSOLE",
      icon: Terminal,
      color: "#f59e0b",
      content: (
        <div className="panel-content">
          <div className="panel-console">
            {[
              { time: "12:04:22", msg: "Range proof compiled — 2.4s", type: "success" },
              { time: "12:04:18", msg: "ElGamal ciphertext generated", type: "info" },
              { time: "12:04:15", msg: "Garaga verifier: PASS", type: "success" },
              { time: "12:04:12", msg: "Collateral ratio proof: ≥ 200%", type: "info" },
              { time: "12:04:08", msg: "Noir circuit: balance_sufficiency", type: "info" },
              { time: "12:04:01", msg: "Solvency domain check: VALID", type: "success" },
            ].map((log, i) => (
              <div key={i} className="console-line" style={{ animationDelay: `${i * 0.08}s` }}>
                <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 9, fontFamily: "'Fira Code'" }}>{log.time}</span>
                <span style={{ color: log.type === "success" ? "#10b981" : "#f59e0b", fontSize: 10, fontFamily: "'Fira Code'" }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    settings: {
      title: "CONFIGURATION",
      icon: Settings,
      color: "#6b7280",
      content: (
        <div className="panel-content">
          <div className="panel-settings-list">
            {[
              { label: "Auto-Shield Deposits", enabled: true },
              { label: "MEV Protection", enabled: true },
              { label: "Private Yield Compound", enabled: false },
              { label: "Proof Caching", enabled: true },
            ].map((setting, i) => (
              <div key={i} className="panel-setting-row">
                <span style={{ fontSize: 11, color: "#fff" }}>{setting.label}</span>
                <div className={`panel-toggle ${setting.enabled ? "panel-toggle-on" : ""}`}>
                  <div className="panel-toggle-knob" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  };

  const panel = panels[type];
  if (!panel) return null;

  return (
    <div className="dock-panel-inner">
      <div className="dock-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <panel.icon size={14} color={panel.color} strokeWidth={2} />
          <span style={{ fontFamily: "'Orbitron'", fontSize: 10, fontWeight: 700, color: panel.color, letterSpacing: 2 }}>{panel.title}</span>
        </div>
        <button className="dock-panel-close" onClick={onClose}>
          <X size={14} color="rgba(255,255,255,0.4)" />
        </button>
      </div>
      {panel.content}
    </div>
  );
};

// ─── AGENT ARENA ACTION BUTTONS (floating quick actions) ───
const AgentArenaButtons = () => {
  const [expanded, setExpanded] = useState(false);

  const actions = [
    { icon: Shield, label: "Quick Shield", color: "#3b82f6", hotkey: "⌘S" },
    { icon: Zap, label: "Flash Mint", color: "#8b5cf6", hotkey: "⌘M" },
    { icon: Send, label: "Private Send", color: "#06b6d4", hotkey: "⌘P" },
    { icon: RefreshCw, label: "Compound", color: "#10b981", hotkey: "⌘C" },
    { icon: Gauge, label: "Health Check", color: "#f59e0b", hotkey: "⌘H" },
  ];

  return (
    <div className="arena-buttons-container">
      {/* Expanded actions */}
      <div className={`arena-actions ${expanded ? "arena-actions-visible" : ""}`}>
        {actions.map((action, i) => (
          <button
            key={i}
            className="arena-action-chip"
            style={{
              "--chip-color": action.color,
              transitionDelay: expanded ? `${i * 60}ms` : `${(actions.length - i) * 30}ms`,
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0) scale(1)" : "translateX(20px) scale(0.8)",
            } as React.CSSProperties}
          >
            <action.icon size={13} strokeWidth={1.8} color={action.color} />
            <span className="arena-chip-label">{action.label}</span>
            <span className="arena-chip-hotkey">{action.hotkey}</span>
          </button>
        ))}
      </div>

      {/* Toggle button */}
      <button
        className={`arena-toggle-btn ${expanded ? "arena-toggle-open" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <Sparkles size={18} strokeWidth={1.8} color="#3b82f6" className={expanded ? "" : "sparkle-pulse"} />
        <span className="arena-toggle-label">ACTIONS</span>
        <ChevronUp
          size={12}
          color="rgba(255,255,255,0.3)"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(90deg)",
            transition: "transform 0.3s",
          }}
        />
      </button>
    </div>
  );
};

// ─── SECTIONS DATA ───
const problemCards = [
  { icon: Eye, label: "Transparent Balances", desc: "DeFi positions are fully visible — MEV bots, competitors, and adversaries watch every move you make." },
  { icon: Target, label: "Front-Running Attacks", desc: "Public mempool data enables sandwich attacks and strategic manipulation of your large positions." },
  { icon: Link2, label: "Linkable Identity", desc: "On-chain activity creates permanent, traceable financial profiles tied to your wallet addresses." },
  { icon: Zap, label: "No Private Yield", desc: "BTC holders can't earn yield without fully exposing their entire financial position to the public chain." },
];

const solutionCards = [
  { icon: ShieldCheck, label: "ShieldedVault", desc: "Deposit BTC → stake via Endur → mint sxyBTC with ElGamal encrypted balances stored on-chain." },
  { icon: Lock, label: "ShieldedCDP", desc: "Lock sxyBTC as collateral → mint sUSD stablecoin while amounts stay hidden behind ZK proofs." },
  { icon: Fingerprint, label: "ElGamal + Tongo", desc: "Homomorphic encryption enables operations on encrypted data — no decryption ever happens on-chain." },
  { icon: ScanLine, label: "On-Chain Verification", desc: "Noir circuits compiled to proofs, verified by Garaga verifiers — trustless, deterministic, final." },
];

const archCards = [
  { icon: Activity, label: "Range Proofs", desc: "Verify transaction amounts fall within valid bounds without ever revealing the actual value." },
  { icon: Database, label: "Balance Sufficiency", desc: "Cryptographically prove your encrypted balance covers the spend — no underflow, no reveal." },
  { icon: TrendingUp, label: "Collateral Ratio", desc: "ZK proof that collateral / debt ≥ 200% minimum — without exposing either value to anyone." },
  { icon: Layers, label: "Solvency Proofs", desc: "Per-domain proofs: Vault reserves match deposits, CDP debt stays within computed safety bounds." },
];

const steps = [
  { num: "01", label: "Bridge & Deposit", desc: "Bridge BTC to Starknet. Deposit into ShieldedVault. Receive xyBTC staking tokens via Endur protocol.", icon: ArrowRight },
  { num: "02", label: "Shield", desc: "Wrap xyBTC into sxyBTC — your balance becomes an ElGamal ciphertext. Only your private key can decrypt it.", icon: ShieldCheck },
  { num: "03", label: "Mint sUSD", desc: "Lock sxyBTC in ShieldedCDP. Prove collateral ratio ≥ 200% via zero-knowledge proof. Mint shielded stablecoin.", icon: Cpu },
  { num: "04", label: "Unshield & Exit", desc: "Repay sUSD → unlock collateral → unshield back to xyBTC or wrapped BTC with proof-validated balance changes.", icon: Unlock },
];

const techStack = [
  { name: "Cairo", role: "Smart Contracts", icon: FileCode },
  { name: "Noir", role: "ZK Circuits", icon: Binary },
  { name: "Garaga", role: "Proof Verification", icon: ShieldCheck },
  { name: "Tongo", role: "Encrypted Tokens", icon: Lock },
  { name: "Endur", role: "BTC Liquid Staking", icon: TrendingUp },
  { name: "Starknet", role: "Execution Layer", icon: Hexagon },
];

// ─── MAIN ───
export default function LandingPage() {
  const navigate = useNavigate();
  const [bootDone, setBootDone] = useState(false);
  const [bootLine, setBootLine] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  const bootMsgs = [
    "INITIALIZING OBSCURA SECURE KERNEL...",
    "LOADING ELGAMAL ENCRYPTION MODULE...",
    "COMPILING NOIR ZK CIRCUITS...",
    "GARAGA VERIFIER HANDSHAKE COMPLETE",
    "SHIELDED VAULT ONLINE",
    "PRIVACY LAYER ACTIVE ▊",
  ];

  useEffect(() => {
    if (bootDone) return;
    if (bootLine < bootMsgs.length) {
      const t = setTimeout(() => setBootLine(l => l + 1), 360);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBootDone(true), 450);
    return () => clearTimeout(t);
  }, [bootDone, bootLine, bootMsgs.length]);

  useEffect(() => {
    if (!bootDone) return;
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [bootDone]);

  if (!bootDone) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#04060b", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fira Code',monospace" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;700&family=Orbitron:wght@400;500;700;900&family=Outfit:wght@200;300;400;500;600;700;800;900&display=swap');
          .bl{opacity:0;animation:bi .3s forwards}@keyframes bi{to{opacity:1}}
        `}</style>
        <div style={{ maxWidth: 560, padding: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <Shield size={24} color="#3b82f6" strokeWidth={1.5} />
            <span style={{ color: "#3b82f6", fontSize: 10, letterSpacing: 4, opacity: 0.5 }}>OBSCURA v1.5</span>
          </div>
          {bootMsgs.slice(0, bootLine).map((m, i) => (
            <div key={i} className="bl" style={{ color: i === bootLine - 1 ? "#3b82f6" : "rgba(59,130,246,0.3)", fontSize: 11, marginBottom: 6, letterSpacing: 0.8 }}>
              <span style={{ color: "#151520", marginRight: 8 }}>[{String(i).padStart(3, "0")}]</span>{m}
            </div>
          ))}
          <div style={{ marginTop: 18, height: 2, borderRadius: 1, background: "linear-gradient(90deg,#3b82f6,transparent)", width: `${(bootLine / bootMsgs.length) * 100}%`, transition: "width .4s" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#04060b", overflow: "hidden", position: "relative", fontFamily: "'Outfit',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;700&family=Orbitron:wght@400;500;700;900&family=Outfit:wght@200;300;400;500;600;700;800;900&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}

        .scan-beam{position:fixed;top:0;left:0;width:100%;height:2px;background:linear-gradient(90deg,transparent,rgba(59,130,246,.1),transparent);animation:scanD 5s linear infinite;box-shadow:0 0 25px rgba(59,130,246,.06);pointer-events:none;z-index:998}
        @keyframes scanD{0%{top:-2px}100%{top:100vh}}
        .scanlines{position:fixed;top:0;left:0;width:100%;height:100%;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.015) 2px,rgba(0,0,0,.015) 4px);pointer-events:none;z-index:997}
        .data-stream-line{animation:sf linear infinite}@keyframes sf{0%{top:-100px}100%{top:calc(100% + 100px)}}
        .cursor-blink{animation:bk .65s infinite}@keyframes bk{0%,100%{opacity:1}50%{opacity:0}}

        .glitch-active{animation:gs .18s linear}
        @keyframes gs{0%{transform:translate(0);filter:hue-rotate(0)}20%{transform:translate(-2px,1px);filter:hue-rotate(50deg)}40%{transform:translate(2px,-1px);filter:hue-rotate(-50deg)}60%{transform:translate(-1px,-1px);clip-path:inset(25% 0 35% 0)}80%{transform:translate(1px,1px);clip-path:inset(55% 0 15% 0)}100%{transform:translate(0);filter:hue-rotate(0);clip-path:none}}

        /* ── ICON CARD ── */
        .icon-card{
          position:relative;padding:28px;
          background:linear-gradient(145deg,rgba(59,130,246,.02),rgba(15,23,42,.6));
          border:1px solid rgba(59,130,246,.08);
          overflow:hidden;cursor:default;
          transform:translateY(60px) scale(.92);opacity:0;
          transition:all .7s cubic-bezier(.16,1,.3,1);
          backdrop-filter:blur(4px);
          clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);
        }
        .icon-card.ic-visible{transform:translateY(0) scale(1);opacity:1}
        .icon-card.ic-hover{
          border-color:rgba(59,130,246,.2);
          box-shadow:0 8px 50px rgba(59,130,246,.06),0 0 0 1px rgba(59,130,246,.08);
          transform:translateY(-4px) scale(1.02);
        }

        /* Spotlight */
        .ic-spotlight{
          position:absolute;top:0;left:0;width:100%;height:100%;
          background:radial-gradient(circle at calc(var(--mx,.5)*100%) calc(var(--my,.5)*100%),rgba(59,130,246,.06) 0%,transparent 55%);
          pointer-events:none;transition:background .12s;z-index:0;
        }

        /* Animated border glow */
        .ic-border-glow{
          position:absolute;top:-1px;left:-1px;right:-1px;bottom:-1px;border-radius:17px;
          background:conic-gradient(from 0deg,transparent 0%,transparent 70%,var(--card-color) 85%,transparent 100%);
          opacity:0;transition:opacity .4s;animation:borderSpin 6s linear infinite;z-index:-1;
        }
        .ic-hover .ic-border-glow{opacity:.3}
        @keyframes borderSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}

        /* Icon orbital ring */
        .ic-icon-wrap{position:relative;width:52px;height:52px;margin-bottom:18px;z-index:1}
        .ic-orbital{
          position:absolute;top:-6px;left:-6px;width:64px;height:64px;
          border-radius:50%;border:1px dashed;
          animation:orbSpin 8s linear infinite;opacity:0;transition:opacity .4s;
        }
        .ic-hover .ic-orbital{opacity:1}
        @keyframes orbSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        .ic-orbital-dot{
          position:absolute;top:-3px;left:50%;width:6px;height:6px;border-radius:50%;
          transform:translateX(-50%);box-shadow:0 0 8px currentColor;
        }
        .ic-icon-bg{
          width:52px;height:52px;border-radius:14px;
          display:flex;align-items:center;justify-content:center;
          transition:all .4s;position:relative;z-index:1;
        }

        /* Energy line */
        .ic-energy{
          position:absolute;height:1px;bottom:0;left:0;right:0;opacity:.1;
          animation:ePulse 3s ease-in-out infinite;
        }
        @keyframes ePulse{0%,100%{opacity:.03;transform:scaleX(.6)}50%{opacity:.18;transform:scaleX(1)}}

        /* Data flow dots */
        .ic-data-flow{position:absolute;bottom:12px;left:0;right:0;height:2px;overflow:hidden;opacity:0;transition:opacity .4s}
        .ic-hover .ic-data-flow{opacity:1}
        .ic-flow-dot{
          position:absolute;width:3px;height:3px;border-radius:50%;
          animation:flowMove 2s linear infinite;
        }
        @keyframes flowMove{0%{transform:translateX(-20px);opacity:0}20%{opacity:.6}80%{opacity:.6}100%{transform:translateX(60px);opacity:0}}

        /* Corner */
        .corner{position:absolute;width:14px;height:14px;border-style:solid;border-width:0;transition:border-color .4s}
        .c-tl{top:0;left:0;border-top-width:1.5px;border-left-width:1.5px}
        .c-br{bottom:0;right:0;border-bottom-width:1.5px;border-right-width:1.5px}
        .ic-hover .corner{border-color:var(--card-color) !important}

        /* Tag */
        .tag-flash{position:relative;overflow:hidden;
          clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
        }
        .tag-flash::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);animation:tShine 4s ease-in-out infinite}
        @keyframes tShine{0%{left:-100%}40%,100%{left:100%}}

        /* Shield glow */
        .shield-glow{animation:shPulse 3s ease-in-out infinite}
        @keyframes shPulse{0%,100%{filter:drop-shadow(0 0 12px rgba(59,130,246,.25))}50%{filter:drop-shadow(0 0 30px rgba(59,130,246,.55))}}

        /* Float */
        .float-y{animation:fY 3.5s ease-in-out infinite}
        @keyframes fY{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}

        /* Section reveal */
        .sr{opacity:0;transform:translateY(45px);transition:all .85s cubic-bezier(.16,1,.3,1)}
        .sr.vis{opacity:1;transform:translateY(0)}

        /* Step card */
        .step-card{
          position:relative;padding:24px 24px 24px 28px;
          background:linear-gradient(135deg,rgba(6,182,212,.03),rgba(15,23,42,.5));
          border:1px solid rgba(6,182,212,.08);
          transform:translateX(-30px);opacity:0;
          transition:all .7s cubic-bezier(.16,1,.3,1);
          overflow:hidden;
          clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);
        }
        .step-card.sc-vis{transform:translateX(0);opacity:1}
        .step-card:hover{
          border-color:rgba(6,182,212,.25);
          box-shadow:0 4px 30px rgba(6,182,212,.06);
          transform:translateX(6px);
        }
        .step-card::before{
          content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
          background:linear-gradient(180deg,#06b6d4,transparent);border-radius:0 2px 2px 0;
          opacity:.4;
        }
        .step-card:hover::before{opacity:1}

        /* Tech pill */
        .tech-pill{
          padding:14px 20px;
          background:rgba(59,130,246,.03);border:1px solid rgba(59,130,246,.1);
          transition:all .35s;display:flex;align-items:center;gap:12px;cursor:default;
          position:relative;overflow:hidden;
          clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);
        }
        .tech-pill::before{
          content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;
          background:linear-gradient(90deg,transparent,rgba(59,130,246,.04),transparent);
          animation:nwScan 6s ease-in-out infinite;pointer-events:none;
        }
        .tech-pill:hover{
          background:rgba(59,130,246,.08);border-color:rgba(59,130,246,.25);
          box-shadow:0 0 20px rgba(59,130,246,.06);transform:translateY(-2px);
        }

        /* Scan animation */
        @keyframes nwScan{
          0%{left:-100%;opacity:0}
          10%{opacity:1}
          90%{opacity:1}
          100%{left:100%;opacity:0}
        }
        @keyframes nwGlow{
          0%,100%{box-shadow:0 0 8px rgba(59,130,246,.15),0 0 20px rgba(59,130,246,.05),inset 0 0 8px rgba(59,130,246,.05)}
          50%{box-shadow:0 0 14px rgba(59,130,246,.25),0 0 35px rgba(59,130,246,.1),inset 0 0 14px rgba(59,130,246,.08)}
        }

        /* CTA PRIMARY */
        .cta-btn{
          position:relative;overflow:hidden;
          padding:16px 44px;border:none;cursor:pointer;
          font-family:'Orbitron',sans-serif;font-weight:700;font-size:12px;letter-spacing:3px;
          color:#04060b;text-transform:uppercase;
          background:linear-gradient(135deg,#3b82f6,#3b82f6,#3b82f6);background-size:200% 200%;
          clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);
          transition:all .3s cubic-bezier(.16,1,.3,1);
          animation:nwGlow 3s ease-in-out infinite;
          text-shadow:0 0 4px rgba(59,130,246,.3);
          text-decoration:none;
        }
        .cta-btn::before{
          content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent);
          animation:nwScan 4s ease-in-out infinite;
          pointer-events:none;
        }
        .cta-btn::after{
          content:'';position:absolute;inset:0;
          background:linear-gradient(180deg,rgba(255,255,255,.1) 0%,transparent 50%);
          pointer-events:none;
        }
        .cta-btn:hover{
          transform:translateY(-2px) scale(1.03);
          box-shadow:0 0 25px rgba(59,130,246,.4),0 0 60px rgba(59,130,246,.15),inset 0 0 20px rgba(59,130,246,.1);
          filter:brightness(1.15);
        }
        .cta-btn:active{transform:translateY(0) scale(.98);filter:brightness(.95)}

        /* CTA OUTLINE */
        .cta-out{
          position:relative;overflow:hidden;
          padding:16px 44px;cursor:pointer;
          font-family:'Orbitron',sans-serif;font-weight:600;font-size:11px;letter-spacing:3px;
          color:#3b82f6;text-transform:uppercase;
          background:rgba(59,130,246,.04);
          border:1.5px solid rgba(59,130,246,.25);
          clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);
          transition:all .3s cubic-bezier(.16,1,.3,1);
          text-decoration:none;
        }
        .cta-out::before{
          content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;
          background:linear-gradient(90deg,transparent,rgba(59,130,246,.08),transparent);
          animation:nwScan 5s ease-in-out infinite;
          pointer-events:none;
        }
        .cta-out:hover{
          border-color:#3b82f6;
          background:rgba(59,130,246,.1);
          box-shadow:0 0 20px rgba(59,130,246,.15),0 0 40px rgba(59,130,246,.05);
          transform:translateY(-2px);
          text-shadow:0 0 8px rgba(59,130,246,.5);
        }
        .cta-out:active{transform:translateY(0) scale(.98)}

        /* ═══ AGENT ARENA - FLOATING DOCK ═══ */

        .agent-dock-container{
          position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
          z-index:1000;display:flex;flex-direction:column;align-items:center;gap:0;
          animation:dockSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s both;
        }
        @keyframes dockSlideUp{
          0%{opacity:0;transform:translateX(-50%) translateY(40px)}
          100%{opacity:1;transform:translateX(-50%) translateY(0)}
        }

        .dock-status-line{
          width:40px;height:2px;border-radius:1px;margin-bottom:6px;
          transition:background 0.5s, width 0.5s;
          box-shadow:0 0 10px currentColor;
          animation:statusPulse 2s ease-in-out infinite;
        }
        @keyframes statusPulse{0%,100%{opacity:0.5;width:40px}50%{opacity:1;width:60px}}

        .agent-dock{
          display:flex;align-items:flex-end;gap:4px;
          padding:8px 12px 10px;
          background:rgba(8,10,18,0.85);
          backdrop-filter:blur(24px) saturate(1.5);
          border:1px solid rgba(59,130,246,0.1);
          clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);
          box-shadow:0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.04), inset 0 1px 0 rgba(59,130,246,0.06);
        }

        .dock-item{
          position:relative;cursor:pointer;display:flex;flex-direction:column;align-items:center;
          padding:0 2px;
        }

        .dock-item-glow{
          position:absolute;top:-10px;left:-10px;right:-10px;bottom:-10px;
          border-radius:50%;transition:all 0.3s;pointer-events:none;
        }

        .dock-item-icon{
          position:relative;
          width:42px;height:42px;
          display:flex;align-items:center;justify-content:center;
          border:1px solid;transition:all 0.25s;
          clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
        }

        .dock-item-active .dock-item-icon{
          background:rgba(59,130,246,0.12) !important;
        }

        .dock-badge{
          position:absolute;top:-4px;right:-4px;
          display:flex;align-items:center;gap:3px;
          padding:1px 5px;border-radius:6px;
          background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.3);
          font-size:7px;font-family:'Fira Code';color:#10b981;letter-spacing:0.5px;
          font-weight:600;
        }
        .dock-badge-dot{
          width:4px;height:4px;border-radius:50%;background:#10b981;
          animation:badgePulse 1.5s ease-in-out infinite;
        }
        @keyframes badgePulse{0%,100%{opacity:1}50%{opacity:0.3}}

        .dock-tooltip{
          position:absolute;bottom:100%;left:50%;
          margin-bottom:10px;padding:4px 10px;border-radius:6px;
          background:rgba(15,23,42,0.9);border:1px solid rgba(59,130,246,0.15);
          transition:all 0.2s;pointer-events:none;white-space:nowrap;
          font-family:'Fira Code';font-size:9px;letter-spacing:1px;font-weight:500;
        }

        .dock-active-dot{
          width:4px;height:4px;border-radius:50%;margin-top:4px;
          animation:activeDotPulse 2s ease-in-out infinite;
        }
        @keyframes activeDotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.7)}}

        .dock-separator{
          width:1px;height:24px;margin:0 6px;align-self:center;
          background:linear-gradient(180deg,transparent,rgba(255,255,255,0.08),transparent);
        }

        .dock-power-btn{
          width:36px !important;height:36px !important;border-radius:10px !important;
        }

        .spin-slow{animation:spinSlow 2s linear infinite}
        @keyframes spinSlow{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}

        /* ── DOCK PANEL ── */
        .dock-panel-overlay{
          position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;
          background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);
          animation:panelFadeIn 0.2s ease;
        }
        @keyframes panelFadeIn{0%{opacity:0}100%{opacity:1}}

        .dock-panel{
          position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
          width:min(420px,calc(100vw - 32px));
          animation:panelSlideUp 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes panelSlideUp{
          0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.95)}
          100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}
        }

        .dock-panel-inner{
          background:rgba(8,12,20,0.95);backdrop-filter:blur(24px) saturate(1.4);
          border:1px solid rgba(59,130,246,0.12);
          clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);
          box-shadow:0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.04);
          overflow:hidden;
        }

        .dock-panel-header{
          display:flex;align-items:center;justify-content:space-between;
          padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);
        }

        .dock-panel-close{
          background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;
          transition:background 0.2s;
        }
        .dock-panel-close:hover{background:rgba(255,255,255,0.06)}

        .panel-content{padding:16px 18px 20px}

        .panel-status-row{
          display:flex;align-items:center;gap:8px;margin-bottom:16px;
          padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.04);
        }
        .panel-status-indicator{
          width:6px;height:6px;border-radius:50%;
          animation:statusBlink 2s ease-in-out infinite;
        }
        @keyframes statusBlink{0%,100%{opacity:1}50%{opacity:0.3}}

        .panel-agent-actions{display:flex;flex-direction:column;gap:6px}

        .panel-action-btn{
          display:flex;align-items:center;gap:10px;width:100%;
          padding:10px 12px;cursor:pointer;
          background:rgba(59,130,246,0.03);border:1px solid rgba(59,130,246,0.1);
          color:#3b82f6;transition:all 0.25s;text-align:left;
          position:relative;overflow:hidden;
          clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
          font-family:'Orbitron',sans-serif;
        }
        .panel-action-btn::before{
          content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;
          background:linear-gradient(90deg,transparent,rgba(59,130,246,.06),transparent);
          transition:left 0.4s;pointer-events:none;
        }
        .panel-action-btn:hover::before{left:100%}
        .panel-action-btn:hover{
          background:rgba(59,130,246,0.08);border-color:rgba(59,130,246,0.3);
          box-shadow:0 0 15px rgba(59,130,246,0.06);
        }

        .panel-vault-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
        .panel-stat-card{
          padding:14px;border-radius:10px;
          background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);
        }

        .panel-vault-actions{display:flex;gap:8px}

        .arena-btn{
          flex:1;display:flex;align-items:center;justify-content:center;gap:6px;
          padding:10px;cursor:pointer;position:relative;overflow:hidden;
          font-family:'Orbitron';font-size:9px;font-weight:700;letter-spacing:1.5px;
          transition:all 0.25s;text-transform:uppercase;
          clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
        }
        .arena-btn::before{
          content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);
          animation:nwScan 4s ease-in-out infinite;pointer-events:none;
        }
        .arena-btn-primary{
          background:linear-gradient(135deg,#3b82f6,#3b82f6);
          border:none;color:#04060b;
          box-shadow:0 0 12px rgba(59,130,246,.15);
        }
        .arena-btn-primary:hover{
          box-shadow:0 0 25px rgba(59,130,246,.3);
          filter:brightness(1.15);transform:translateY(-1px);
        }
        .arena-btn-outline{
          background:rgba(59,130,246,.04);
          border:1px solid rgba(59,130,246,.2);
          color:#3b82f6;
        }
        .arena-btn-outline:hover{
          border-color:#3b82f6;background:rgba(59,130,246,.1);
          box-shadow:0 0 15px rgba(59,130,246,.1);
        }

        .panel-wallet-addr{margin-bottom:14px}
        .panel-addr-box{
          display:flex;align-items:center;justify-content:space-between;
          padding:8px 12px;border-radius:8px;
          background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
        }
        .panel-addr-box code{font-family:'Fira Code';font-size:12px;color:rgba(255,255,255,0.6)}
        .panel-copy-btn{
          background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);
          color:#3b82f6;font-family:'Orbitron';font-size:8px;letter-spacing:1.5px;
          padding:3px 10px;cursor:pointer;transition:all 0.2s;
          clip-path:polygon(3px 0,100% 0,100% calc(100% - 3px),calc(100% - 3px) 100%,0 100%,0 3px);
        }
        .panel-copy-btn:hover{background:rgba(59,130,246,0.2);box-shadow:0 0 10px rgba(59,130,246,.1)}

        .panel-wallet-tokens{display:flex;flex-direction:column;gap:6px}
        .panel-token-row{
          display:flex;align-items:center;justify-content:space-between;
          padding:10px 12px;border-radius:8px;
          background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.03);
          transition:background 0.2s;
        }
        .panel-token-row:hover{background:rgba(255,255,255,0.03)}
        .panel-token-dot{width:6px;height:6px;border-radius:50%}

        .panel-analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .panel-analytics-card{
          padding:12px;border-radius:10px;
          background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);
        }

        .panel-console{
          max-height:200px;overflow-y:auto;
          padding:10px;border-radius:8px;
          background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.04);
        }
        .console-line{
          display:flex;gap:10px;padding:4px 0;
          animation:consoleFadeIn 0.3s ease both;
          border-bottom:1px solid rgba(255,255,255,0.02);
        }
        .console-line:last-child{border-bottom:none}
        @keyframes consoleFadeIn{0%{opacity:0;transform:translateX(-8px)}100%{opacity:1;transform:translateX(0)}}

        .panel-settings-list{display:flex;flex-direction:column;gap:6px}
        .panel-setting-row{
          display:flex;align-items:center;justify-content:space-between;
          padding:10px 12px;border-radius:8px;
          background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.03);
        }
        .panel-toggle{
          width:36px;height:20px;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,0.08);position:relative;transition:background 0.3s;
        }
        .panel-toggle-on{background:rgba(59,130,246,0.35)}
        .panel-toggle-knob{
          position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
          background:#fff;transition:transform 0.3s;
        }
        .panel-toggle-on .panel-toggle-knob{transform:translateX(16px)}

        /* ═══ AGENT ARENA - ACTION BUTTONS ═══ */

        .arena-buttons-container{
          position:fixed;right:20px;bottom:90px;z-index:999;
          display:flex;flex-direction:column;align-items:flex-end;gap:6px;
          animation:arenaSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.5s both;
        }
        @keyframes arenaSlideIn{
          0%{opacity:0;transform:translateX(20px)}
          100%{opacity:1;transform:translateX(0)}
        }

        .arena-actions{
          display:flex;flex-direction:column;align-items:flex-end;gap:4px;
          margin-bottom:4px;
        }

        .arena-action-chip{
          display:flex;align-items:center;gap:8px;
          padding:9px 14px;cursor:pointer;
          background:rgba(59,130,246,0.04);backdrop-filter:blur(16px);
          border:1px solid rgba(59,130,246,0.12);
          transition:all 0.3s cubic-bezier(0.16,1,0.3,1);white-space:nowrap;
          position:relative;overflow:hidden;
          clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
        }
        .arena-action-chip::before{
          content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;
          background:linear-gradient(90deg,transparent,rgba(59,130,246,.06),transparent);
          transition:left 0.4s;pointer-events:none;
        }
        .arena-action-chip:hover::before{left:100%}
        .arena-action-chip:hover{
          border-color:rgba(59,130,246,0.4);
          background:rgba(59,130,246,0.1);
          box-shadow:0 0 20px rgba(59,130,246,.1);
          transform:translateX(-4px) scale(1.02) !important;
        }

        .arena-chip-label{
          font-family:'Orbitron';font-size:9px;font-weight:600;color:#3b82f6;letter-spacing:1.5px;
        }
        .arena-chip-hotkey{
          font-family:'Fira Code';font-size:8px;color:rgba(59,130,246,0.3);
          padding:1px 5px;
          background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.1);
          clip-path:polygon(2px 0,100% 0,100% calc(100% - 2px),calc(100% - 2px) 100%,0 100%,0 2px);
        }

        .arena-toggle-btn{
          display:flex;align-items:center;gap:8px;
          padding:10px 18px;cursor:pointer;
          background:rgba(59,130,246,0.04);backdrop-filter:blur(16px);
          border:1px solid rgba(59,130,246,0.15);
          transition:all 0.3s;position:relative;overflow:hidden;
          box-shadow:0 4px 20px rgba(0,0,0,0.3);
          clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);
        }
        .arena-toggle-btn::before{
          content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;
          background:linear-gradient(90deg,transparent,rgba(59,130,246,.06),transparent);
          animation:nwScan 5s ease-in-out infinite;pointer-events:none;
        }
        .arena-toggle-btn:hover{
          border-color:rgba(59,130,246,0.35);
          box-shadow:0 4px 30px rgba(59,130,246,0.08);
        }
        .arena-toggle-open{
          border-color:rgba(59,130,246,0.3);
          background:rgba(59,130,246,0.08);
        }
        .arena-toggle-label{
          font-family:'Orbitron';font-size:9px;font-weight:700;color:#3b82f6;letter-spacing:2px;
        }

        .sparkle-pulse{animation:sparklePulse 2s ease-in-out infinite}
        @keyframes sparklePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}}

        @media(max-width:768px){
          .cards-grid{grid-template-columns:1fr !important}
          .stats-grid{grid-template-columns:repeat(2,1fr) !important}
          .hero-title{font-size:30px !important}
          .cta-row{flex-direction:column !important;align-items:center !important}
          .tech-wrap{grid-template-columns:repeat(2,1fr) !important}
          .agent-dock{padding:6px 8px 8px;gap:2px}
          .dock-item-icon{width:36px !important;height:36px !important}
          .arena-buttons-container{right:12px;bottom:80px}
          .dock-panel{width:calc(100vw - 24px) !important}
        }
      `}</style>

      <ParticleField />
      <div className="scan-beam" />
      <div className="scanlines" />
      <DataStream side="left" />
      <DataStream side="right" />

      {/* ═══ HEADER ═══ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "12px 24px",
        background: scrollY > 40 ? "rgba(4,6,11,.92)" : "transparent",
        backdropFilter: scrollY > 40 ? "blur(16px)" : "none",
        borderBottom: scrollY > 40 ? "1px solid rgba(59,130,246,.06)" : "1px solid transparent",
        transition: "all .4s", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="shield-glow"><Shield size={26} color="#3b82f6" strokeWidth={1.5} /></div>
          <span style={{ fontFamily: "Orbitron", fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: 3 }}>OBSCURA</span>
          <span style={{ fontSize: 9, color: "rgba(59,130,246,.35)", fontFamily: "'Fira Code'", letterSpacing: 1 }}>v1.5</span>
        </div>
        <div className="float-y" style={{
          padding: "3px 10px", borderRadius: 14,
          background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.12)",
          fontSize: 9, fontFamily: "'Fira Code'", color: "#3b82f6", letterSpacing: 1,
        }}>● STARKNET</div>
      </header>

      <main style={{ position: "relative", zIndex: 10, paddingBottom: 100 }}>

        {/* ── HERO ── */}
        <SectionReveal>
          <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px" }}>
            <div className="tag-flash" style={{ display: "inline-block", padding: "5px 14px", marginBottom: 22, background: "rgba(59,130,246,.07)", border: "1px solid rgba(59,130,246,.18)", fontFamily: "Orbitron", fontSize: 9, fontWeight: 700, color: "#3b82f6", letterSpacing: 4 }}>
              PRIVACY-PRESERVING BTC DEFI
            </div>
            <GlitchText>
              <h1 className="hero-title" style={{ fontFamily: "Orbitron", fontSize: "clamp(32px,5.2vw,60px)", fontWeight: 900, color: "#fff", lineHeight: 1.05, marginBottom: 18, maxWidth: 780 }}>
                Shield Your Bitcoin.<br />
                <span style={{ color: "#3b82f6", textShadow: "0 0 40px rgba(59,130,246,.25)" }}>Own Your Privacy.</span>
              </h1>
            </GlitchText>
            <p style={{ fontFamily: "'Fira Code'", fontSize: "clamp(11px,1.3vw,14px)", color: "rgba(255,255,255,.4)", maxWidth: 540, lineHeight: 1.7, marginBottom: 36 }}>
              <TypeWriter text="Stake BTC → encrypt balances with ElGamal → mint stablecoins via ZK proofs → verified on-chain by Garaga." speed={22} />
            </p>
            <div className="cta-row" style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
<<<<<<< HEAD
              <a href="/stake"><button className="cta-btn">LAUNCH APP</button></a>
              <a href="/docs"><button className="cta-out">READ DOCS</button></a>
=======
              <button className="cta-btn" onClick={() => navigate('/stake')}>LAUNCH APP</button>
              <button className="cta-out">READ DOCS</button>
>>>>>>> 5249fea1b54c3c656564e1a4025dc26f2c79dbfa
            </div>
            <div style={{ marginTop: 56, display: "flex", gap: 44, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { val: 7, suf: "", lbl: "ZK Circuits" },
                { val: 256, suf: "-bit", lbl: "Encryption" },
                { val: 200, suf: "%", lbl: "Min CR" },
                { val: 0, suf: "", lbl: "Trusted Parties" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "Orbitron", fontSize: "clamp(20px,2.4vw,30px)", fontWeight: 900, color: "#3b82f6", textShadow: "0 0 18px rgba(59,130,246,.25)" }}>
                    <AnimCounter end={s.val} suffix={s.suf} />
                  </div>
                  <div style={{ fontFamily: "'Fira Code'", fontSize: 8, color: "rgba(255,255,255,.25)", letterSpacing: 1.5, marginTop: 4, textTransform: "uppercase" }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 56, display: "flex", flexDirection: "column", alignItems: "center", animation: "fY 2s ease-in-out infinite", opacity: .25 }}>
              <div style={{ fontSize: 8, fontFamily: "'Fira Code'", color: "#3b82f6", letterSpacing: 2, marginBottom: 6 }}>SCROLL</div>
              <ChevronDown size={16} color="#3b82f6" />
            </div>
          </section>
        </SectionReveal>

        {/* ── PROBLEM ── */}
        <SectionReveal>
          <section style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
            <SectionHeader icon={ShieldAlert} tag="THE PROBLEM" title="BTC DeFi Has a Privacy Crisis" color="#ef4444" subtitle="Every transaction, every balance, every strategy — exposed on-chain for all to see." />
            <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 32 }}>
              {problemCards.map((c, i) => <IconCard key={i} {...c} color="#ef4444" delay={i * 140} index={i} />)}
            </div>
          </section>
        </SectionReveal>

        {/* ── SOLUTION ── */}
        <SectionReveal>
          <section style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
            <SectionHeader icon={ShieldCheck} tag="THE SOLUTION" title="Shield. Stake. Mint. Privately." color="#3b82f6" subtitle="ElGamal encrypted balances + ZK proofs verified on-chain via Garaga." />
            <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 32 }}>
              {solutionCards.map((c, i) => <IconCard key={i} {...c} color="#3b82f6" delay={i * 140} index={i} />)}
            </div>
          </section>
        </SectionReveal>

        {/* ── ARCHITECTURE ── */}
        <SectionReveal>
          <section style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
            <SectionHeader icon={Cpu} tag="ARCHITECTURE" title="Composable Privacy Stack" color="#8b5cf6" subtitle="Seven ZK circuits. Two shielded domains. Per-domain solvency proofs." />
            <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 32 }}>
              {archCards.map((c, i) => <IconCard key={i} {...c} color="#8b5cf6" delay={i * 140} index={i} />)}
            </div>
          </section>
        </SectionReveal>

        {/* ── USER JOURNEY ── */}
        <SectionReveal>
          <section style={{ padding: "80px 24px", maxWidth: 760, margin: "0 auto" }}>
            <SectionHeader icon={Waypoints} tag="USER JOURNEY" title="Four Steps to Private BTC DeFi" color="#06b6d4" subtitle="From public Bitcoin to private yield — cryptographic guarantees at every transition." />
            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
              {steps.map((s, i) => <StepCard key={i} {...s} delay={i * 160} />)}
            </div>
          </section>
        </SectionReveal>

        {/* ── TECH STACK ── */}
        <SectionReveal>
          <section style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
            <SectionHeader icon={CircuitBoard} tag="TECHNOLOGY" title="Built on Proven Cryptography" color="#3b82f6" subtitle="Not a wrapper. Not a mixer. A full privacy-preserving financial protocol." />
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 32 }}>
              {[
                { val: 7, suf: "", lbl: "Noir ZK Circuits" },
                { val: 256, suf: "-bit", lbl: "ElGamal Encryption" },
                { val: 200, suf: "%", lbl: "Min Collateral Ratio" },
                { val: 2, suf: "", lbl: "Solvency Domains" },
                { val: 0, suf: "", lbl: "Trusted Third Parties" },
                { val: 100, suf: "%", lbl: "On-Chain Verified" },
              ].map((s, i) => (
                <div key={i} className="icon-card ic-visible" style={{ transform: "none", opacity: 1, padding: 24, textAlign: "center" }}>
                  <div style={{ fontFamily: "Orbitron", fontSize: 26, fontWeight: 900, color: "#3b82f6", textShadow: "0 0 18px rgba(59,130,246,.25)" }}>
                    <AnimCounter end={s.val} suffix={s.suf} />
                  </div>
                  <div style={{ fontFamily: "'Fira Code'", fontSize: 8, color: "rgba(255,255,255,.3)", letterSpacing: 1.5, marginTop: 6, textTransform: "uppercase" }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            <div className="tech-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 24 }}>
              {techStack.map((t, i) => (
                <div key={i} className="tech-pill">
                  <t.icon size={16} color="#3b82f6" strokeWidth={1.5} />
                  <div>
                    <div style={{ fontFamily: "Orbitron", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: .5 }}>{t.name}</div>
                    <div style={{ fontSize: 9, color: "rgba(59,130,246,.45)", fontFamily: "'Fira Code'" }}>{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </SectionReveal>

        {/* ── CTA ── */}
        <SectionReveal>
          <section style={{ padding: "100px 24px 120px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <ShieldLogo size={52} glow />
            <div style={{ height: 20 }} />
            <GlitchText>
              <h2 style={{ fontFamily: "Orbitron", fontSize: "clamp(22px,3.2vw,38px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 14 }}>
                The Future of BTC DeFi<br /><span style={{ color: "#3b82f6" }}>is Private</span>
              </h2>
            </GlitchText>
            <p style={{ fontFamily: "'Fira Code'", fontSize: 12, color: "rgba(255,255,255,.35)", maxWidth: 460, lineHeight: 1.7, marginBottom: 36 }}>
              Privacy is not a feature. It is a prerequisite for adoption at scale.
            </p>
            <div className="cta-row" style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
<<<<<<< HEAD
              <a href="/stake"><button className="cta-btn">START BUILDING</button></a>
              <a href="/docs"><button className="cta-out">VIEW DOCS</button></a>
=======
              <button className="cta-btn" onClick={() => navigate('/stake')}>START BUILDING</button>
              <button className="cta-out">VIEW PRD</button>
>>>>>>> 5249fea1b54c3c656564e1a4025dc26f2c79dbfa
            </div>
            <div style={{ marginTop: 56, fontFamily: "'Fira Code'", fontSize: 9, color: "rgba(255,255,255,.12)", letterSpacing: 2 }}>
              OBSCURA v1.5 — STARKNET — CAIRO — NOIR — GARAGA
            </div>
          </section>
        </SectionReveal>
      </main>

      {/* ═══ AGENT ARENA ELEMENTS ═══ */}
      <AgentArenaButtons />
      <AgentDock />
    </div>
  );
}

// ─── HELPERS ───
function SectionReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => { const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: 0.06 }); if (ref.current) o.observe(ref.current); return () => o.disconnect(); }, []);
  return <div ref={ref} className={`sr ${v ? "vis" : ""}`}>{children}</div>;
}

interface SectionHeaderProps {
  icon: LucideIcon;
  tag: string;
  title: string;
  color: string;
  subtitle?: string;
}

function SectionHeader({ icon: Icon, tag, title, color, subtitle }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div className="tag-flash" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", background: `${color}0d`, border: `1px solid ${color}28`, fontFamily: "Orbitron", fontSize: 9, fontWeight: 700, color, letterSpacing: 3 }}>
          {Icon && <Icon size={12} strokeWidth={2} />}
          {tag}
        </div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${color}20,transparent)` }} />
      </div>
      <h2 style={{ fontFamily: "Orbitron", fontSize: "clamp(20px,2.8vw,34px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 8 }}>{title}</h2>
      {subtitle && <p style={{ fontFamily: "'Fira Code'", fontSize: 11, color: "rgba(255,255,255,.35)", maxWidth: 520, lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}

interface StepCardProps {
  num: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  delay?: number;
}

function StepCard({ num, label, desc, icon: Icon, delay = 0 }: StepCardProps) {
  const [v, setV] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: 0.2 });
      if (ref.current) o.observe(ref.current);
      return () => o.disconnect();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div ref={ref} className={`step-card ${v ? "sc-vis" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 44 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(6,182,212,.08)", border: "1px solid rgba(6,182,212,.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={18} color="#06b6d4" strokeWidth={1.5} />
          </div>
          <span style={{ fontFamily: "Orbitron", fontSize: 10, fontWeight: 900, color: "rgba(6,182,212,.25)" }}>{num}</span>
        </div>
        <div>
          <div style={{ fontFamily: "Orbitron", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 5, letterSpacing: .8 }}>{label}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", lineHeight: 1.7, fontWeight: 300 }}>{desc}</div>
        </div>
      </div>
    </div>
  );
}
