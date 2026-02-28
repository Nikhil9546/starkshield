import { useState, useEffect, useRef } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Eye, Zap, Target,
  Link2, TrendingUp, Database, Cpu, Layers, Fingerprint, ScanLine,
  Activity, ArrowRight, Binary, FileCode,
  ChevronDown, Hexagon, CircuitBoard, Waypoints,
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
          position:relative;border-radius:16px;padding:28px;
          background:linear-gradient(145deg,rgba(59,130,246,.03),rgba(15,23,42,.6));
          border:1px solid rgba(59,130,246,.08);
          overflow:hidden;cursor:default;
          transform:translateY(60px) scale(.92);opacity:0;
          transition:all .7s cubic-bezier(.16,1,.3,1);
          backdrop-filter:blur(4px);
        }
        .icon-card.ic-visible{transform:translateY(0) scale(1);opacity:1}
        .icon-card.ic-hover{
          border-color:rgba(59,130,246,.25);
          box-shadow:0 8px 50px rgba(59,130,246,.08),0 0 0 1px rgba(59,130,246,.1);
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
        .tag-flash{position:relative;overflow:hidden}
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
          position:relative;border-radius:14px;padding:24px 24px 24px 28px;
          background:linear-gradient(135deg,rgba(6,182,212,.03),rgba(15,23,42,.5));
          border:1px solid rgba(6,182,212,.08);
          transform:translateX(-30px);opacity:0;
          transition:all .7s cubic-bezier(.16,1,.3,1);
          overflow:hidden;
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
          padding:14px 20px;border-radius:10px;
          background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.1);
          transition:all .35s;display:flex;align-items:center;gap:12px;cursor:default;
        }
        .tech-pill:hover{
          background:rgba(59,130,246,.1);border-color:rgba(59,130,246,.25);
          box-shadow:0 0 25px rgba(59,130,246,.08);transform:translateY(-2px);
        }

        /* CTA */
        .cta-btn{
          padding:16px 42px;border-radius:10px;border:none;cursor:pointer;
          font-family:'Orbitron',sans-serif;font-weight:700;font-size:13px;letter-spacing:2px;color:#04060b;
          background:linear-gradient(135deg,#3b82f6,#60a5fa,#3b82f6);background-size:200% 200%;
          animation:gShift 3s ease infinite;
          box-shadow:0 0 30px rgba(59,130,246,.3),0 0 60px rgba(59,130,246,.08);transition:all .3s;
        }
        .cta-btn:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 0 50px rgba(59,130,246,.45),0 0 100px rgba(59,130,246,.15)}
        @keyframes gShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .cta-out{
          padding:16px 42px;border-radius:10px;cursor:pointer;
          font-family:'Orbitron',sans-serif;font-weight:600;font-size:12px;letter-spacing:2px;color:#3b82f6;
          background:transparent;border:1.5px solid rgba(59,130,246,.25);transition:all .3s;
        }
        .cta-out:hover{border-color:#3b82f6;background:rgba(59,130,246,.06);box-shadow:0 0 25px rgba(59,130,246,.12)}

        @media(max-width:768px){
          .cards-grid{grid-template-columns:1fr !important}
          .stats-grid{grid-template-columns:repeat(2,1fr) !important}
          .hero-title{font-size:30px !important}
          .cta-row{flex-direction:column !important;align-items:center !important}
          .tech-wrap{grid-template-columns:repeat(2,1fr) !important}
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

      <main style={{ position: "relative", zIndex: 10 }}>

        {/* ── HERO ── */}
        <SectionReveal>
          <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px" }}>
            <div className="tag-flash" style={{ display: "inline-block", padding: "5px 14px", borderRadius: 6, marginBottom: 22, background: "rgba(59,130,246,.07)", border: "1px solid rgba(59,130,246,.18)", fontFamily: "Orbitron", fontSize: 9, fontWeight: 700, color: "#3b82f6", letterSpacing: 4 }}>
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
              <a href="/stake"><button className="cta-btn">LAUNCH APP</button></a>
              <button className="cta-out">READ DOCS</button>
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
              <a href="/stake"><button className="cta-btn">START BUILDING</button></a>
              <button className="cta-out">VIEW PRD</button>
            </div>
            <div style={{ marginTop: 56, fontFamily: "'Fira Code'", fontSize: 9, color: "rgba(255,255,255,.12)", letterSpacing: 2 }}>
              OBSCURA v1.5 — STARKNET — CAIRO — NOIR — GARAGA
            </div>
          </section>
        </SectionReveal>
      </main>
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
        <div className="tag-flash" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 6, background: `${color}0d`, border: `1px solid ${color}28`, fontFamily: "Orbitron", fontSize: 9, fontWeight: 700, color, letterSpacing: 3 }}>
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
