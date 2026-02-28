import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Eye, Zap, Target,
  Link2, TrendingUp, Database, Cpu, Layers, Fingerprint, ScanLine,
  Activity, ArrowRight, Binary, FileCode, GitBranch, Boxes,
  ChevronDown, Hexagon, CircuitBoard, Terminal,
  Key, BookOpen, Server, Workflow, AlertTriangle, CheckCircle2,
  Network, Cog, Wallet,
  ArrowLeft, Menu, X, ExternalLink, Copy, Check
} from "lucide-react";

// ─── PARTICLE SYSTEM ───
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

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 1.5 + 0.3, opacity: Math.random() * 0.3 + 0.05,
        pulse: Math.random() * Math.PI * 2, hue: 205 + Math.random() * 30,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        const dx2 = p.x - mouse.x, dy2 = p.y - mouse.y;
        const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 < 100) { p.vx += (dx2 / d2) * 0.08; p.vy += (dy2 / d2) * 0.08; }
        p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy; p.pulse += 0.012;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        const g = Math.sin(p.pulse) * 0.3 + 0.7;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * g, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,65%,${p.opacity * g})`; ctx.fill();
        particles.slice(i + 1).forEach((p2) => {
          const dx = p.x - p2.x, dy = p.y - p2.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(215,100%,60%,${0.03 * (1 - dist / 80)})`; ctx.lineWidth = 0.5; ctx.stroke();
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

// ─── DATA STREAM ───
const DataStream = ({ side = "left" }: { side?: "left" | "right" }) => {
  const chars = "01▓▒░█┃┣┫╋╬◆◇⬡⎔".split("");
  const [lines] = useState(() =>
    Array.from({ length: 18 }, () => ({
      text: Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
      speed: 4 + Math.random() * 6, opacity: 0.02 + Math.random() * 0.05,
    }))
  );
  return (
    <div style={{ position: "fixed", [side]: 0, top: 0, width: "24px", height: "100%", overflow: "hidden", pointerEvents: "none", zIndex: 2, fontFamily: "'Fira Code',monospace", fontSize: "7px" }}>
      {lines.map((l, i) => (
        <div key={i} className="data-stream-line" style={{ position: "absolute", [side]: "2px", color: "#3b82f6", opacity: l.opacity, animationDuration: `${l.speed}s`, animationDelay: `${i * 0.3}s`, whiteSpace: "nowrap", writingMode: "vertical-rl" }}>{l.text}</div>
      ))}
    </div>
  );
};

// ─── GLITCH TEXT ───
const GlitchText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const [g, setG] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => { setG(true); setTimeout(() => setG(false), 150); }, 5000 + Math.random() * 6000);
    return () => clearInterval(iv);
  }, []);
  return <div className={`${className} ${g ? "glitch-active" : ""}`}>{children}</div>;
};

// ─── CODE BLOCK ───
const CodeBlock = ({ code, language = "cairo", title }: { code: string; language?: string; title?: string }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      {title && (
        <div className="code-header">
          <div className="code-title">
            <FileCode size={12} />
            <span>{title}</span>
          </div>
          <div className="code-lang">{language}</div>
        </div>
      )}
      <div className="code-content">
        <pre><code>{code}</code></pre>
        <button className="copy-btn" onClick={copyToClipboard}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};

// ─── INFO BOX ───
const InfoBox = ({ type = "info", title, children }: { type?: "info" | "warning" | "success" | "danger"; title?: string; children: React.ReactNode }) => {
  const icons = { info: Zap, warning: AlertTriangle, success: CheckCircle2, danger: ShieldAlert };
  const colors = { info: "#3b82f6", warning: "#f59e0b", success: "#10b981", danger: "#ef4444" };
  const Icon = icons[type];
  const color = colors[type];

  return (
    <div className="info-box" style={{ borderColor: `${color}30`, background: `${color}08` }}>
      <div className="info-header" style={{ color }}>
        <Icon size={16} />
        {title && <span>{title}</span>}
      </div>
      <div className="info-content">{children}</div>
    </div>
  );
};

// ─── SECTION REVEAL ───
function SectionReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => { const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: 0.05 }); if (ref.current) o.observe(ref.current); return () => o.disconnect(); }, []);
  return <div ref={ref} className={`sr ${v ? "vis" : ""}`}>{children}</div>;
}

// ─── TABLE OF CONTENTS DATA ───
const tocSections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Boxes },
  { id: "smart-contracts", label: "Smart Contracts", icon: FileCode },
  { id: "zk-circuits", label: "ZK Circuits", icon: CircuitBoard },
  { id: "encryption", label: "Encryption", icon: Key },
  { id: "user-flows", label: "User Flows", icon: Workflow },
  { id: "tokens", label: "Tokens", icon: Hexagon },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "integration", label: "Integrations", icon: Link2 },
  { id: "deployment", label: "Deployment", icon: Server },
];

// ─── MAIN DOCS PAGE ───
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Update active section based on scroll position
      const sections = tocSections.map(s => document.getElementById(s.id));
      const scrollPos = window.scrollY + 150;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPos) {
          setActiveSection(tocSections[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({ top: element.offsetTop - 100, behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="docs-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;700&family=Orbitron:wght@400;500;700;900&family=Outfit:wght@200;300;400;500;600;700;800;900&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .docs-page {
          width: 100%; min-height: 100vh;
          background: #04060b;
          font-family: 'Outfit', sans-serif;
          color: rgba(255,255,255,0.85);
          position: relative;
        }

        /* Scan effects */
        .scan-beam { position: fixed; top: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg,transparent,rgba(59,130,246,.08),transparent); animation: scanD 6s linear infinite; pointer-events: none; z-index: 998; }
        @keyframes scanD { 0% { top: -1px } 100% { top: 100vh } }
        .scanlines { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.012) 2px,rgba(0,0,0,.012) 4px); pointer-events: none; z-index: 997; }
        .data-stream-line { animation: sf linear infinite } @keyframes sf { 0% { top: -100px } 100% { top: calc(100% + 100px) } }

        /* Glitch */
        .glitch-active { animation: gs .15s linear }
        @keyframes gs { 0% { transform: translate(0); filter: hue-rotate(0) } 20% { transform: translate(-1px,1px); filter: hue-rotate(40deg) } 40% { transform: translate(1px,-1px); filter: hue-rotate(-40deg) } 60% { transform: translate(-1px,-1px); clip-path: inset(25% 0 35% 0) } 80% { transform: translate(1px,1px); clip-path: inset(55% 0 15% 0) } 100% { transform: translate(0); filter: hue-rotate(0); clip-path: none } }

        /* Section reveal */
        .sr { opacity: 0; transform: translateY(30px); transition: all .7s cubic-bezier(.16,1,.3,1); }
        .sr.vis { opacity: 1; transform: translateY(0); }

        /* Header */
        .docs-header {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 12px 24px;
          background: rgba(4,6,11,.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(59,130,246,.08);
          display: flex; align-items: center; justify-content: space-between;
        }
        .docs-header-left { display: flex; align-items: center; gap: 16px; }
        .back-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px;
          background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.15);
          color: #3b82f6; font-size: 12px; font-family: 'Fira Code', monospace;
          cursor: pointer; transition: all .2s;
          text-decoration: none;
        }
        .back-btn:hover { background: rgba(59,130,246,.15); border-color: rgba(59,130,246,.3); }
        .docs-logo { display: flex; align-items: center; gap: 8px; }
        .docs-logo-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg, #3b82f6, #60a5fa);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(59,130,246,.3);
        }
        .docs-logo-text { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; color: #fff; letter-spacing: 2px; }
        .docs-logo-version { font-size: 9px; color: rgba(59,130,246,.5); font-family: 'Fira Code', monospace; }
        .docs-badge {
          padding: 4px 10px; border-radius: 12px;
          background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.2);
          font-size: 9px; font-family: 'Fira Code', monospace; color: #10b981;
          letter-spacing: 1px;
        }

        /* Mobile menu toggle */
        .mobile-menu-btn {
          display: none; padding: 8px; border-radius: 8px;
          background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.15);
          color: #3b82f6; cursor: pointer;
        }
        @media (max-width: 1024px) {
          .mobile-menu-btn { display: flex; }
        }

        /* Layout */
        .docs-layout { display: flex; padding-top: 60px; min-height: 100vh; }

        /* Sidebar */
        .docs-sidebar {
          position: fixed; top: 60px; left: 0; bottom: 0;
          width: 260px; padding: 24px 16px;
          background: rgba(4,6,11,.9);
          border-right: 1px solid rgba(59,130,246,.06);
          overflow-y: auto; z-index: 50;
        }
        @media (max-width: 1024px) {
          .docs-sidebar {
            transform: translateX(-100%);
            transition: transform .3s ease;
          }
          .docs-sidebar.open {
            transform: translateX(0);
            width: 100%; max-width: 280px;
            background: rgba(4,6,11,.98);
          }
        }
        .sidebar-title {
          font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 700;
          color: rgba(255,255,255,.3); letter-spacing: 2px; margin-bottom: 16px;
          padding: 0 12px;
        }
        .toc-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; margin-bottom: 2px; border-radius: 10px;
          font-size: 13px; color: rgba(255,255,255,.5);
          cursor: pointer; transition: all .2s;
          border: 1px solid transparent;
        }
        .toc-item:hover { background: rgba(59,130,246,.06); color: rgba(255,255,255,.75); }
        .toc-item.active {
          background: rgba(59,130,246,.1); color: #3b82f6;
          border-color: rgba(59,130,246,.2);
        }
        .toc-item svg { opacity: 0.6; }
        .toc-item.active svg { opacity: 1; }

        /* Main content */
        .docs-main {
          flex: 1; margin-left: 260px; padding: 40px 60px 80px;
          max-width: 900px;
        }
        @media (max-width: 1024px) {
          .docs-main { margin-left: 0; padding: 32px 24px 80px; max-width: 100%; }
        }

        /* Section styling */
        .doc-section { margin-bottom: 80px; scroll-margin-top: 100px; }
        .section-tag {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px; border-radius: 6px; margin-bottom: 16px;
          background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.18);
          font-family: 'Orbitron', sans-serif; font-size: 9px; font-weight: 700;
          color: #3b82f6; letter-spacing: 3px;
        }
        .section-title {
          font-family: 'Orbitron', sans-serif; font-size: clamp(24px,3vw,36px);
          font-weight: 900; color: #fff; line-height: 1.15; margin-bottom: 16px;
        }
        .section-subtitle {
          font-family: 'Fira Code', monospace; font-size: 13px;
          color: rgba(255,255,255,.4); line-height: 1.7; margin-bottom: 32px;
          max-width: 600px;
        }
        .section-divider {
          height: 1px; margin: 48px 0;
          background: linear-gradient(90deg, rgba(59,130,246,.2), transparent);
        }

        /* Content typography */
        .doc-content h3 {
          font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 700;
          color: #fff; margin: 32px 0 16px; letter-spacing: 0.5px;
          display: flex; align-items: center; gap: 10px;
        }
        .doc-content h3 svg { color: #3b82f6; }
        .doc-content h4 {
          font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600;
          color: rgba(255,255,255,.9); margin: 24px 0 12px;
        }
        .doc-content p {
          font-size: 14px; line-height: 1.8; color: rgba(255,255,255,.6);
          margin-bottom: 16px;
        }
        .doc-content ul, .doc-content ol {
          margin: 16px 0; padding-left: 24px;
        }
        .doc-content li {
          font-size: 14px; line-height: 1.8; color: rgba(255,255,255,.55);
          margin-bottom: 8px;
        }
        .doc-content li::marker { color: #3b82f6; }
        .doc-content strong { color: rgba(255,255,255,.9); font-weight: 600; }
        .doc-content code {
          background: rgba(59,130,246,.1); padding: 2px 8px; border-radius: 4px;
          font-family: 'Fira Code', monospace; font-size: 12px; color: #60a5fa;
        }
        .doc-content a {
          color: #3b82f6; text-decoration: none;
          border-bottom: 1px solid rgba(59,130,246,.3);
          transition: all .2s;
        }
        .doc-content a:hover { color: #60a5fa; border-color: #60a5fa; }

        /* Code blocks */
        .code-block {
          margin: 20px 0; border-radius: 12px; overflow: hidden;
          background: rgba(15,23,42,.8); border: 1px solid rgba(59,130,246,.1);
        }
        .code-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px;
          background: rgba(59,130,246,.06);
          border-bottom: 1px solid rgba(59,130,246,.08);
        }
        .code-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; color: rgba(255,255,255,.5);
          font-family: 'Fira Code', monospace;
        }
        .code-lang {
          font-size: 9px; color: #3b82f6; font-family: 'Fira Code', monospace;
          padding: 3px 8px; background: rgba(59,130,246,.1); border-radius: 4px;
          letter-spacing: 1px; text-transform: uppercase;
        }
        .code-content {
          position: relative; padding: 16px;
        }
        .code-content pre {
          margin: 0; overflow-x: auto;
        }
        .code-content code {
          background: none; padding: 0; border-radius: 0;
          font-family: 'Fira Code', monospace; font-size: 12px;
          line-height: 1.7; color: rgba(255,255,255,.7);
          white-space: pre;
        }
        .copy-btn {
          position: absolute; top: 12px; right: 12px;
          padding: 6px; border-radius: 6px;
          background: rgba(59,130,246,.1); border: 1px solid rgba(59,130,246,.2);
          color: #3b82f6; cursor: pointer; transition: all .2s;
        }
        .copy-btn:hover { background: rgba(59,130,246,.2); }

        /* Info boxes */
        .info-box {
          margin: 20px 0; padding: 16px 20px; border-radius: 12px;
          border: 1px solid; background: rgba(15,23,42,.5);
        }
        .info-header {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Orbitron', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 1px; margin-bottom: 10px;
        }
        .info-content {
          font-size: 13px; line-height: 1.7; color: rgba(255,255,255,.6);
        }

        /* Feature cards */
        .feature-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px; margin: 24px 0;
        }
        .feature-card {
          padding: 20px; border-radius: 14px;
          background: linear-gradient(145deg, rgba(59,130,246,.04), rgba(15,23,42,.6));
          border: 1px solid rgba(59,130,246,.1);
          transition: all .3s;
        }
        .feature-card:hover {
          border-color: rgba(59,130,246,.25);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(59,130,246,.08);
        }
        .feature-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(59,130,246,.1);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }
        .feature-title {
          font-family: 'Orbitron', sans-serif; font-size: 12px; font-weight: 700;
          color: #fff; margin-bottom: 8px; letter-spacing: 0.5px;
        }
        .feature-desc {
          font-size: 12px; line-height: 1.7; color: rgba(255,255,255,.45);
        }

        /* Contract cards */
        .contract-card {
          padding: 24px; border-radius: 16px; margin: 20px 0;
          background: linear-gradient(145deg, rgba(139,92,246,.04), rgba(15,23,42,.6));
          border: 1px solid rgba(139,92,246,.15);
        }
        .contract-header {
          display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
        }
        .contract-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(139,92,246,.12);
          display: flex; align-items: center; justify-content: center;
        }
        .contract-name {
          font-family: 'Orbitron', sans-serif; font-size: 15px; font-weight: 700;
          color: #fff; letter-spacing: 0.5px;
        }
        .contract-file {
          font-size: 10px; color: rgba(139,92,246,.6);
          font-family: 'Fira Code', monospace;
        }
        .contract-desc {
          font-size: 13px; line-height: 1.7; color: rgba(255,255,255,.5);
          margin-bottom: 16px;
        }
        .contract-methods { margin-top: 16px; }
        .method-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 0; border-bottom: 1px solid rgba(139,92,246,.08);
        }
        .method-item:last-child { border-bottom: none; }
        .method-name {
          font-family: 'Fira Code', monospace; font-size: 12px; color: #a78bfa;
          white-space: nowrap;
        }
        .method-desc {
          font-size: 12px; color: rgba(255,255,255,.4);
        }

        /* Circuit cards */
        .circuit-card {
          padding: 20px; border-radius: 14px; margin: 12px 0;
          background: linear-gradient(145deg, rgba(6,182,212,.04), rgba(15,23,42,.5));
          border: 1px solid rgba(6,182,212,.12);
          display: flex; gap: 16px;
        }
        .circuit-num {
          font-family: 'Orbitron', sans-serif; font-size: 20px; font-weight: 900;
          color: rgba(6,182,212,.25); min-width: 32px;
        }
        .circuit-content { flex: 1; }
        .circuit-name {
          font-family: 'Orbitron', sans-serif; font-size: 13px; font-weight: 700;
          color: #fff; margin-bottom: 8px; letter-spacing: 0.5px;
        }
        .circuit-statement {
          font-size: 12px; color: rgba(255,255,255,.5); line-height: 1.6;
          margin-bottom: 12px;
        }
        .circuit-io {
          display: flex; gap: 24px; flex-wrap: wrap;
        }
        .circuit-io-group { flex: 1; min-width: 180px; }
        .circuit-io-label {
          font-size: 9px; color: rgba(6,182,212,.6);
          font-family: 'Fira Code', monospace; letter-spacing: 1px;
          margin-bottom: 6px; text-transform: uppercase;
        }
        .circuit-io-items {
          font-size: 11px; color: rgba(255,255,255,.4);
          font-family: 'Fira Code', monospace; line-height: 1.8;
        }

        /* Token cards */
        .token-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px; margin: 24px 0;
        }
        .token-card {
          padding: 20px; border-radius: 14px; text-align: center;
          background: linear-gradient(145deg, rgba(16,185,129,.04), rgba(15,23,42,.5));
          border: 1px solid rgba(16,185,129,.12);
        }
        .token-symbol {
          font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 900;
          color: #10b981; margin-bottom: 8px;
        }
        .token-name {
          font-size: 12px; color: rgba(255,255,255,.7); margin-bottom: 6px;
        }
        .token-type {
          font-size: 9px; color: rgba(16,185,129,.6);
          font-family: 'Fira Code', monospace; letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* Flow steps */
        .flow-steps { margin: 24px 0; }
        .flow-step {
          display: flex; gap: 20px; padding: 20px 0;
          border-bottom: 1px solid rgba(59,130,246,.08);
        }
        .flow-step:last-child { border-bottom: none; }
        .flow-step-num {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(59,130,246,.1); border: 1px solid rgba(59,130,246,.2);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Orbitron', sans-serif; font-size: 12px; font-weight: 900;
          color: #3b82f6; flex-shrink: 0;
        }
        .flow-step-content { flex: 1; }
        .flow-step-title {
          font-family: 'Orbitron', sans-serif; font-size: 13px; font-weight: 700;
          color: #fff; margin-bottom: 6px; letter-spacing: 0.5px;
        }
        .flow-step-desc {
          font-size: 13px; color: rgba(255,255,255,.5); line-height: 1.7;
        }
        .flow-step-proof {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; margin-top: 10px; border-radius: 6px;
          background: rgba(6,182,212,.08); border: 1px solid rgba(6,182,212,.15);
          font-size: 10px; color: #06b6d4; font-family: 'Fira Code', monospace;
        }

        /* Stats grid */
        .stats-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px; margin: 24px 0;
        }
        .stat-card {
          padding: 18px; border-radius: 12px; text-align: center;
          background: rgba(59,130,246,.04); border: 1px solid rgba(59,130,246,.1);
        }
        .stat-value {
          font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 900;
          color: #3b82f6;
        }
        .stat-label {
          font-size: 10px; color: rgba(255,255,255,.4);
          font-family: 'Fira Code', monospace; letter-spacing: 1px;
          margin-top: 6px; text-transform: uppercase;
        }

        /* Architecture diagram */
        .arch-diagram {
          padding: 32px; margin: 24px 0; border-radius: 16px;
          background: linear-gradient(145deg, rgba(59,130,246,.03), rgba(15,23,42,.6));
          border: 1px solid rgba(59,130,246,.1);
        }
        .arch-layer {
          padding: 16px; margin-bottom: 12px; border-radius: 10px;
          background: rgba(59,130,246,.06); border: 1px dashed rgba(59,130,246,.15);
        }
        .arch-layer:last-child { margin-bottom: 0; }
        .arch-layer-label {
          font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 700;
          color: rgba(59,130,246,.6); letter-spacing: 2px; margin-bottom: 12px;
        }
        .arch-components {
          display: flex; flex-wrap: wrap; gap: 10px;
        }
        .arch-component {
          padding: 8px 14px; border-radius: 8px;
          background: rgba(59,130,246,.1); border: 1px solid rgba(59,130,246,.15);
          font-size: 11px; color: rgba(255,255,255,.7);
          font-family: 'Fira Code', monospace;
        }
        .arch-arrow {
          display: flex; justify-content: center; padding: 8px 0;
          color: rgba(59,130,246,.3);
        }

        /* Integration logos */
        .integration-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px; margin: 24px 0;
        }
        .integration-card {
          padding: 20px; border-radius: 14px; text-align: center;
          background: rgba(15,23,42,.5); border: 1px solid rgba(59,130,246,.1);
          transition: all .3s;
        }
        .integration-card:hover {
          border-color: rgba(59,130,246,.25);
          transform: translateY(-2px);
        }
        .integration-icon {
          width: 48px; height: 48px; margin: 0 auto 12px;
          border-radius: 12px; background: rgba(59,130,246,.08);
          display: flex; align-items: center; justify-content: center;
        }
        .integration-name {
          font-family: 'Orbitron', sans-serif; font-size: 13px; font-weight: 700;
          color: #fff; margin-bottom: 6px;
        }
        .integration-role {
          font-size: 11px; color: rgba(255,255,255,.4);
        }

        /* Table */
        .doc-table {
          width: 100%; margin: 20px 0; border-collapse: collapse;
          font-size: 13px;
        }
        .doc-table th, .doc-table td {
          padding: 12px 16px; text-align: left;
          border-bottom: 1px solid rgba(59,130,246,.08);
        }
        .doc-table th {
          font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 700;
          color: rgba(59,130,246,.6); letter-spacing: 1px;
          text-transform: uppercase;
        }
        .doc-table td {
          color: rgba(255,255,255,.6);
        }
        .doc-table code {
          background: rgba(59,130,246,.1); padding: 2px 6px; border-radius: 4px;
          font-size: 11px;
        }

        /* Footer */
        .docs-footer {
          padding: 40px 60px; margin-left: 260px;
          border-top: 1px solid rgba(59,130,246,.06);
          text-align: center;
        }
        @media (max-width: 1024px) {
          .docs-footer { margin-left: 0; padding: 40px 24px; }
        }
        .footer-text {
          font-family: 'Fira Code', monospace; font-size: 11px;
          color: rgba(255,255,255,.2); letter-spacing: 2px;
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .feature-grid { grid-template-columns: 1fr; }
          .token-grid { grid-template-columns: 1fr 1fr; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .circuit-card { flex-direction: column; }
          .arch-components { flex-direction: column; }
          .integration-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <ParticleField />
      <div className="scan-beam" />
      <div className="scanlines" />
      <DataStream side="left" />
      <DataStream side="right" />

      {/* Header */}
      <header className="docs-header">
        <div className="docs-header-left">
          <Link to="/" className="back-btn">
            <ArrowLeft size={14} />
            <span>Home</span>
          </Link>
          <div className="docs-logo">
            <div className="docs-logo-icon">
              <Shield size={18} color="#fff" strokeWidth={1.5} />
            </div>
            <div>
              <div className="docs-logo-text">OBSCURA</div>
              <div className="docs-logo-version">Documentation v1.5</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="docs-badge">SEPOLIA TESTNET</div>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className="docs-layout">
        {/* Sidebar */}
        <aside className={`docs-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="sidebar-title">CONTENTS</div>
          {tocSections.map((section) => (
            <div
              key={section.id}
              className={`toc-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => scrollToSection(section.id)}
            >
              <section.icon size={16} />
              <span>{section.label}</span>
            </div>
          ))}
          <div className="section-divider" style={{ margin: "24px 12px" }} />
          <div className="sidebar-title">QUICK LINKS</div>
          <Link to="/stake" className="toc-item" style={{ textDecoration: "none" }}>
            <Wallet size={16} />
            <span>Launch App</span>
          </Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="toc-item" style={{ textDecoration: "none" }}>
            <GitBranch size={16} />
            <span>GitHub</span>
            <ExternalLink size={12} style={{ marginLeft: "auto", opacity: 0.4 }} />
          </a>
        </aside>

        {/* Main Content */}
        <main className="docs-main">

          {/* Overview Section */}
          <SectionReveal>
            <section id="overview" className="doc-section">
              <div className="section-tag">
                <BookOpen size={12} />
                OVERVIEW
              </div>
              <GlitchText>
                <h1 className="section-title">
                  StarkShield Protocol<br />
                  <span style={{ color: "#3b82f6" }}>Technical Documentation</span>
                </h1>
              </GlitchText>
              <p className="section-subtitle">
                Privacy-preserving BTC DeFi on Starknet. Stake, shield, mint — cryptographic guarantees at every step.
              </p>

              <div className="doc-content">
                <p>
                  <strong>StarkShield v1.5</strong> (codenamed Obscura) is a privacy-preserving BTC DeFi protocol built on Starknet.
                  It enables users to stake Bitcoin, earn yield, and access DeFi services while keeping their balances and
                  positions completely private through advanced cryptography.
                </p>

                <InfoBox type="info" title="CORE PRIVACY GUARANTEES">
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>On-chain balances are encrypted using ElGamal encryption</li>
                    <li>State transitions are validated via zero-knowledge proofs</li>
                    <li>No trusted parties — proofs verified on-chain by Garaga</li>
                    <li>Per-domain solvency proofs ensure protocol integrity</li>
                  </ul>
                </InfoBox>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">7</div>
                    <div className="stat-label">ZK Circuits</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">256</div>
                    <div className="stat-label">Bit Encryption</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">200%</div>
                    <div className="stat-label">Min CR</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">0</div>
                    <div className="stat-label">Trusted Parties</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">2</div>
                    <div className="stat-label">Domains</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">100%</div>
                    <div className="stat-label">On-Chain</div>
                  </div>
                </div>

                <h3><Target size={18} /> What Problems Does StarkShield Solve?</h3>

                <div className="feature-grid">
                  <div className="feature-card">
                    <div className="feature-icon" style={{ background: "rgba(239,68,68,.1)" }}>
                      <Eye size={20} color="#ef4444" />
                    </div>
                    <div className="feature-title">Transparent Balances</div>
                    <div className="feature-desc">DeFi positions are fully visible — MEV bots, competitors, and adversaries watch every move.</div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon" style={{ background: "rgba(239,68,68,.1)" }}>
                      <Target size={20} color="#ef4444" />
                    </div>
                    <div className="feature-title">Front-Running</div>
                    <div className="feature-desc">Public mempool data enables sandwich attacks and strategic manipulation of large positions.</div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon" style={{ background: "rgba(239,68,68,.1)" }}>
                      <Link2 size={20} color="#ef4444" />
                    </div>
                    <div className="feature-title">Linkable Identity</div>
                    <div className="feature-desc">On-chain activity creates permanent, traceable financial profiles tied to wallets.</div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon" style={{ background: "rgba(239,68,68,.1)" }}>
                      <Zap size={20} color="#ef4444" />
                    </div>
                    <div className="feature-title">No Private Yield</div>
                    <div className="feature-desc">BTC holders can't earn yield without fully exposing their financial position.</div>
                  </div>
                </div>

                <h3><ShieldCheck size={18} /> The StarkShield Solution</h3>

                <p>
                  StarkShield addresses these challenges through a composable privacy stack built on proven cryptography:
                </p>

                <div className="feature-grid">
                  <div className="feature-card">
                    <div className="feature-icon">
                      <Lock size={20} color="#3b82f6" />
                    </div>
                    <div className="feature-title">ShieldedVault</div>
                    <div className="feature-desc">Deposit BTC → stake via Endur → mint sxyBTC with ElGamal encrypted balances.</div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">
                      <Cpu size={20} color="#3b82f6" />
                    </div>
                    <div className="feature-title">ShieldedCDP</div>
                    <div className="feature-desc">Lock sxyBTC as collateral → mint sUSD while amounts stay hidden behind ZK proofs.</div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">
                      <Fingerprint size={20} color="#3b82f6" />
                    </div>
                    <div className="feature-title">ElGamal + Tongo</div>
                    <div className="feature-desc">Homomorphic encryption enables operations on encrypted data — no on-chain decryption.</div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">
                      <ScanLine size={20} color="#3b82f6" />
                    </div>
                    <div className="feature-title">On-Chain Verification</div>
                    <div className="feature-desc">Noir circuits compiled to proofs, verified by Garaga — trustless and final.</div>
                  </div>
                </div>
              </div>
            </section>
          </SectionReveal>

          {/* Architecture Section */}
          <SectionReveal>
            <section id="architecture" className="doc-section">
              <div className="section-tag">
                <Boxes size={12} />
                ARCHITECTURE
              </div>
              <h2 className="section-title">System Architecture</h2>
              <p className="section-subtitle">
                A multi-layer stack combining client-side privacy, ZK proving, and on-chain verification.
              </p>

              <div className="doc-content">
                <div className="arch-diagram">
                  <div className="arch-layer">
                    <div className="arch-layer-label">FRONTEND LAYER</div>
                    <div className="arch-components">
                      <div className="arch-component">React/TS UI</div>
                      <div className="arch-component">Wallet Connect</div>
                      <div className="arch-component">Proof Orchestration</div>
                    </div>
                  </div>
                  <div className="arch-arrow"><ChevronDown size={20} /></div>
                  <div className="arch-layer">
                    <div className="arch-layer-label">CLIENT PRIVACY ENGINE</div>
                    <div className="arch-components">
                      <div className="arch-component">Key Management</div>
                      <div className="arch-component">Encryption/Decryption</div>
                      <div className="arch-component">Witness Generation</div>
                      <div className="arch-component">Proof Generation</div>
                    </div>
                  </div>
                  <div className="arch-arrow"><ChevronDown size={20} /></div>
                  <div className="arch-layer">
                    <div className="arch-layer-label">ZK STACK</div>
                    <div className="arch-components">
                      <div className="arch-component">Noir Circuits</div>
                      <div className="arch-component">Proof Artifacts</div>
                      <div className="arch-component">Garaga Verifiers</div>
                    </div>
                  </div>
                  <div className="arch-arrow"><ChevronDown size={20} /></div>
                  <div className="arch-layer">
                    <div className="arch-layer-label">SMART CONTRACTS (CAIRO)</div>
                    <div className="arch-components">
                      <div className="arch-component">ShieldedVault</div>
                      <div className="arch-component">ShieldedCDP</div>
                      <div className="arch-component">ProofVerifiers</div>
                      <div className="arch-component">SolvencyProver</div>
                    </div>
                  </div>
                  <div className="arch-arrow"><ChevronDown size={20} /></div>
                  <div className="arch-layer">
                    <div className="arch-layer-label">INTEGRATIONS</div>
                    <div className="arch-components">
                      <div className="arch-component">Endur (xyBTC)</div>
                      <div className="arch-component">Tongo (Encrypted Tokens)</div>
                      <div className="arch-component">Starknet L2</div>
                    </div>
                  </div>
                </div>

                <h3><Network size={18} /> Trust Model</h3>

                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Trust Assumption</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>User Client</td>
                      <td>Trusted for key custody and local proving</td>
                    </tr>
                    <tr>
                      <td>Starknet</td>
                      <td>Trusted for execution correctness</td>
                    </tr>
                    <tr>
                      <td>External Protocols</td>
                      <td>Honest-but-risky; integration minimized</td>
                    </tr>
                    <tr>
                      <td>Protocol Operator</td>
                      <td>No access to user encryption keys</td>
                    </tr>
                  </tbody>
                </table>

                <h3><Database size={18} /> Data Model</h3>

                <h4>Encrypted Balance Representation</h4>
                <p>
                  Balances are stored as ElGamal ciphertexts on the Stark curve. Each account maps to a
                  ciphertext pair <code>C = (c1, c2)</code>:
                </p>

                <CodeBlock
                  title="Ciphertext Storage"
                  language="cairo"
                  code={`// Cairo contract storage
@storage_var
func balance_cipher(account: ContractAddress) -> (ciphertext: Ciphertext):
end

struct Ciphertext:
    c1: EcPoint  // First curve point
    c2: EcPoint  // Second curve point
end`}
                />

                <h4>State Domains</h4>
                <p>StarkShield maintains two independent solvency domains:</p>
                <ul>
                  <li><strong>Vault Domain:</strong> Tracks <code>total_deposits_cipher</code>, <code>vault_reserves</code>, and <code>exchange_rate</code></li>
                  <li><strong>CDP Domain:</strong> Tracks <code>collateral_cipher</code>, <code>debt_cipher</code>, and <code>position_status</code> per CDP</li>
                </ul>
              </div>
            </section>
          </SectionReveal>

          {/* Smart Contracts Section */}
          <SectionReveal>
            <section id="smart-contracts" className="doc-section">
              <div className="section-tag">
                <FileCode size={12} />
                SMART CONTRACTS
              </div>
              <h2 className="section-title">Cairo Smart Contracts</h2>
              <p className="section-subtitle">
                Core protocol logic deployed on Starknet. All state transitions require valid ZK proofs.
              </p>

              <div className="doc-content">
                {/* ShieldedVault */}
                <div className="contract-card">
                  <div className="contract-header">
                    <div className="contract-icon">
                      <Shield size={22} color="#8b5cf6" />
                    </div>
                    <div>
                      <div className="contract-name">ShieldedVault</div>
                      <div className="contract-file">contracts/src/ShieldedVault.cairo</div>
                    </div>
                  </div>
                  <div className="contract-desc">
                    The primary entry point for users. Accepts BTC deposits, stakes via Endur to mint xyBTC,
                    then wraps into sxyBTC with encrypted balances. All balance operations require proof validation.
                  </div>

                  <h4 style={{ color: "rgba(255,255,255,.7)", marginBottom: 12 }}>Public Interface</h4>
                  <div className="contract-methods">
                    <div className="method-item">
                      <code className="method-name">deposit()</code>
                      <span className="method-desc">Accept wrapped BTC, stake via Endur, mint sxyBTC with encrypted balance</span>
                    </div>
                    <div className="method-item">
                      <code className="method-name">withdraw()</code>
                      <span className="method-desc">Reduce encrypted balance, unstake proportional xyBTC, return to user</span>
                    </div>
                    <div className="method-item">
                      <code className="method-name">unshield()</code>
                      <span className="method-desc">Convert sxyBTC back to public xyBTC with balance sufficiency proof</span>
                    </div>
                  </div>

                  <CodeBlock
                    title="deposit() signature"
                    language="cairo"
                    code={`@external
func deposit(
    pubkey: PubKey,
    amount: u256,
    proof_range: Proof,
    recipient: ContractAddress
) -> ():
    # Verify range proof: amount in (0, MAX_DEPOSIT]
    # Stake via Endur → xyBTC
    # Encrypt balance, store ciphertext
    # Emit DepositCommitted event
end`}
                  />

                  <InfoBox type="warning" title="INVARIANTS">
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      <li>Encrypted balance never underflows</li>
                      <li>Only valid proofs can change ciphertext state</li>
                      <li>Any unshield must reduce sxyBTC ciphertext accordingly</li>
                    </ul>
                  </InfoBox>
                </div>

                {/* ShieldedCDP */}
                <div className="contract-card">
                  <div className="contract-header">
                    <div className="contract-icon">
                      <Lock size={22} color="#8b5cf6" />
                    </div>
                    <div>
                      <div className="contract-name">ShieldedCDP</div>
                      <div className="contract-file">contracts/src/ShieldedCDP.cairo</div>
                    </div>
                  </div>
                  <div className="contract-desc">
                    Collateralized Debt Position management with encrypted amounts. Users lock sxyBTC to mint
                    sUSD stablecoin. Collateral ratio enforced via ZK proofs — values never revealed on-chain.
                  </div>

                  <div className="stats-grid" style={{ marginBottom: 20 }}>
                    <div className="stat-card">
                      <div className="stat-value">200%</div>
                      <div className="stat-label">MIN_CR</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">Mode A</div>
                      <div className="stat-label">Liquidation</div>
                    </div>
                  </div>

                  <h4 style={{ color: "rgba(255,255,255,.7)", marginBottom: 12 }}>Public Interface</h4>
                  <div className="contract-methods">
                    <div className="method-item">
                      <code className="method-name">open_position()</code>
                      <span className="method-desc">Create new CDP for owner, returns position_id</span>
                    </div>
                    <div className="method-item">
                      <code className="method-name">lock_collateral()</code>
                      <span className="method-desc">Add sxyBTC collateral to position with sufficiency proof</span>
                    </div>
                    <div className="method-item">
                      <code className="method-name">mint()</code>
                      <span className="method-desc">Mint sUSD against collateral with CR proof (≥200%)</span>
                    </div>
                    <div className="method-item">
                      <code className="method-name">repay()</code>
                      <span className="method-desc">Reduce debt by burning sUSD with validity proof</span>
                    </div>
                    <div className="method-item">
                      <code className="method-name">unlock_collateral()</code>
                      <span className="method-desc">Remove collateral while maintaining CR with proof</span>
                    </div>
                    <div className="method-item">
                      <code className="method-name">close_position()</code>
                      <span className="method-desc">Close CDP with zero_debt proof, unlock all collateral</span>
                    </div>
                  </div>

                  <h4 style={{ color: "rgba(255,255,255,.7)", marginTop: 24, marginBottom: 12 }}>Liquidation Model (Mode A)</h4>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.7 }}>
                    <strong>Disclosure-on-Liquidation:</strong> When oracle price implies potential CR violation,
                    the contract sets <code>status = LIQUIDATION_PENDING</code>. The owner must submit a liquidation
                    settlement tx including minimal disclosure payload + proof binding disclosure to ciphertext.
                    If owner does not respond within <code>LIQUIDATION_WINDOW</code>, liquidation proceeds with
                    conservative seizure bounds.
                  </p>
                </div>

                {/* ProofVerifiers */}
                <div className="contract-card">
                  <div className="contract-header">
                    <div className="contract-icon">
                      <ShieldCheck size={22} color="#8b5cf6" />
                    </div>
                    <div>
                      <div className="contract-name">ProofVerifiers</div>
                      <div className="contract-file">contracts/src/ProofVerifiers.cairo</div>
                    </div>
                  </div>
                  <div className="contract-desc">
                    Garaga-based verification contracts for each Noir circuit. Enforces domain separation
                    through proof type ID + verifying key ID. Deterministic, trustless verification.
                  </div>
                </div>

                {/* SolvencyProver */}
                <div className="contract-card">
                  <div className="contract-header">
                    <div className="contract-icon">
                      <Activity size={22} color="#8b5cf6" />
                    </div>
                    <div>
                      <div className="contract-name">SolvencyProver</div>
                      <div className="contract-file">contracts/src/SolvencyProver.cairo</div>
                    </div>
                  </div>
                  <div className="contract-desc">
                    Per-domain solvency proofs. Vault domain proves <code>Sum(UserDepositsCipher) == VaultReserveCipher</code>.
                    CDP domain proves <code>TotalDebt ≤ f(TotalCollateral, MIN_CR, Price)</code> conservatively.
                  </div>
                </div>
              </div>
            </section>
          </SectionReveal>

          {/* ZK Circuits Section */}
          <SectionReveal>
            <section id="zk-circuits" className="doc-section">
              <div className="section-tag">
                <CircuitBoard size={12} />
                ZK CIRCUITS
              </div>
              <h2 className="section-title">Noir ZK Circuits</h2>
              <p className="section-subtitle">
                Seven circuits provide cryptographic guarantees for all encrypted state transitions.
              </p>

              <div className="doc-content">
                <InfoBox type="info" title="CIRCUIT TOOLCHAIN">
                  Circuits are written in Noir, compiled to proof artifacts, and verified on-chain via Garaga verifiers.
                  All circuits use a pinned Noir toolchain version for reproducible builds.
                </InfoBox>

                <div className="circuit-card">
                  <div className="circuit-num">01</div>
                  <div className="circuit-content">
                    <div className="circuit-name">range_proof.nr</div>
                    <div className="circuit-statement">
                      <strong>Statement:</strong> Proves that an amount falls within valid bounds <code>(0, MAX_DEPOSIT]</code> without revealing the actual value.
                    </div>
                    <div className="circuit-io">
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Public Inputs</div>
                        <div className="circuit-io-items">commitment</div>
                      </div>
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Private Inputs</div>
                        <div className="circuit-io-items">amount, randomness</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="circuit-card">
                  <div className="circuit-num">02</div>
                  <div className="circuit-content">
                    <div className="circuit-name">balance_sufficiency.nr</div>
                    <div className="circuit-statement">
                      <strong>Statement:</strong> Proves that sender ciphertext balance minus spend_delta is valid (no underflow) without revealing balances.
                    </div>
                    <div className="circuit-io">
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Public Inputs</div>
                        <div className="circuit-io-items">old_cipher, new_cipher, delta_cipher, pk</div>
                      </div>
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Private Inputs</div>
                        <div className="circuit-io-items">plaintext_balance, randomness</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="circuit-card">
                  <div className="circuit-num">03</div>
                  <div className="circuit-content">
                    <div className="circuit-name">collateral_ratio.nr</div>
                    <div className="circuit-statement">
                      <strong>Statement:</strong> Proves that <code>(collateral_value / debt_value) ≥ MIN_CR</code> without exposing either value.
                    </div>
                    <div className="circuit-io">
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Public Inputs</div>
                        <div className="circuit-io-items">collateral_cipher, debt_cipher, price, MIN_CR, commitment</div>
                      </div>
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Private Inputs</div>
                        <div className="circuit-io-items">plaintext_collateral, plaintext_debt, randomness</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="circuit-card">
                  <div className="circuit-num">04</div>
                  <div className="circuit-content">
                    <div className="circuit-name">debt_update_validity.nr</div>
                    <div className="circuit-statement">
                      <strong>Statement:</strong> Proves that debt_cipher transitions are consistent with mint/repay deltas.
                    </div>
                    <div className="circuit-io">
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Public Inputs</div>
                        <div className="circuit-io-items">old_debt_cipher, delta_cipher, new_debt_cipher</div>
                      </div>
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Private Inputs</div>
                        <div className="circuit-io-items">plaintext_debt, randomness</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="circuit-card">
                  <div className="circuit-num">05</div>
                  <div className="circuit-content">
                    <div className="circuit-name">zero_debt.nr</div>
                    <div className="circuit-statement">
                      <strong>Statement:</strong> Proves that debt plaintext equals 0 (required to close CDP).
                    </div>
                    <div className="circuit-io">
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Public Inputs</div>
                        <div className="circuit-io-items">debt_cipher</div>
                      </div>
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Private Inputs</div>
                        <div className="circuit-io-items">plaintext=0, randomness</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="circuit-card">
                  <div className="circuit-num">06</div>
                  <div className="circuit-content">
                    <div className="circuit-name">vault_solvency.nr</div>
                    <div className="circuit-statement">
                      <strong>Statement:</strong> Proves sum of user deposit ciphertexts equals reserve ciphertext (Vault domain solvency).
                    </div>
                    <div className="circuit-io">
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Public Inputs</div>
                        <div className="circuit-io-items">accumulator_before, accumulator_after, reserve_cipher</div>
                      </div>
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Private Inputs</div>
                        <div className="circuit-io-items">user_ciphers[], batch_commitments</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="circuit-card">
                  <div className="circuit-num">07</div>
                  <div className="circuit-content">
                    <div className="circuit-name">cdp_safety_bound.nr</div>
                    <div className="circuit-statement">
                      <strong>Statement:</strong> Proves <code>total_debt ≤ total_collateral_value / MIN_CR</code> (CDP domain solvency).
                    </div>
                    <div className="circuit-io">
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Public Inputs</div>
                        <div className="circuit-io-items">total_collateral_cipher, total_debt_cipher, price, MIN_CR</div>
                      </div>
                      <div className="circuit-io-group">
                        <div className="circuit-io-label">Private Inputs</div>
                        <div className="circuit-io-items">plaintext_totals, randomness</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </SectionReveal>

          {/* Encryption Section */}
          <SectionReveal>
            <section id="encryption" className="doc-section">
              <div className="section-tag">
                <Key size={12} />
                ENCRYPTION
              </div>
              <h2 className="section-title">ElGamal Encryption</h2>
              <p className="section-subtitle">
                Homomorphic encryption enables operations on encrypted data without decryption.
              </p>

              <div className="doc-content">
                <h3><Fingerprint size={18} /> How It Works</h3>

                <p>
                  StarkShield uses ElGamal encryption over the Stark elliptic curve. This provides:
                </p>

                <ul>
                  <li><strong>Semantic Security:</strong> Ciphertexts reveal nothing about plaintexts</li>
                  <li><strong>Additive Homomorphism:</strong> <code>Enc(a) + Enc(b) = Enc(a + b)</code></li>
                  <li><strong>Re-randomization:</strong> Ciphertexts can be refreshed without changing plaintext</li>
                </ul>

                <CodeBlock
                  title="ElGamal Operations"
                  language="typescript"
                  code={`// Key Generation
const sk = randomScalar()      // Private key (random scalar)
const pk = G.multiply(sk)       // Public key (curve point)

// Encryption
function encrypt(message: bigint, pk: Point): Ciphertext {
  const r = randomScalar()      // Fresh randomness
  const c1 = G.multiply(r)      // First component
  const c2 = pk.multiply(r).add(G.multiply(message))  // Second component
  return { c1, c2 }
}

// Decryption
function decrypt(cipher: Ciphertext, sk: bigint): bigint {
  const shared = cipher.c1.multiply(sk)
  const encoded = cipher.c2.subtract(shared)
  return discreteLog(encoded)   // Recover plaintext
}

// Homomorphic Addition (on ciphertexts)
function add(a: Ciphertext, b: Ciphertext): Ciphertext {
  return {
    c1: a.c1.add(b.c1),
    c2: a.c2.add(b.c2)
  }
}`}
                />

                <h3><Lock size={18} /> Client Key Management</h3>

                <p>
                  User encryption keys are managed entirely client-side. The protocol operator never
                  has access to private keys. Keys are stored encrypted in browser localStorage:
                </p>

                <ul>
                  <li>Master key derived via PBKDF2 from user password</li>
                  <li>ElGamal private key encrypted with AES-256-GCM</li>
                  <li>Optional export to encrypted JSON backup file</li>
                </ul>

                <InfoBox type="danger" title="KEY SECURITY">
                  If you lose your encryption key, you lose access to your shielded balances forever.
                  There is no recovery mechanism — the protocol cannot decrypt your funds.
                </InfoBox>
              </div>
            </section>
          </SectionReveal>

          {/* User Flows Section */}
          <SectionReveal>
            <section id="user-flows" className="doc-section">
              <div className="section-tag">
                <Workflow size={12} />
                USER FLOWS
              </div>
              <h2 className="section-title">User Journeys</h2>
              <p className="section-subtitle">
                Step-by-step flows for each core action with required proofs.
              </p>

              <div className="doc-content">
                <h3><ArrowRight size={18} /> Journey A: Stake BTC Privately</h3>

                <div className="flow-steps">
                  <div className="flow-step">
                    <div className="flow-step-num">1</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Bridge BTC to Starknet</div>
                      <div className="flow-step-desc">
                        Use a BTC bridge to bring your Bitcoin to Starknet as wrapped BTC.
                        This step is public on the Bitcoin blockchain.
                      </div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">2</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Deposit into ShieldedVault</div>
                      <div className="flow-step-desc">
                        Deposit wrapped BTC into the vault. The protocol stakes via Endur and mints xyBTC.
                      </div>
                      <div className="flow-step-proof"><CircuitBoard size={12} /> RANGE_PROOF required</div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">3</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Shield to sxyBTC</div>
                      <div className="flow-step-desc">
                        Wrap xyBTC into sxyBTC. Your balance becomes an encrypted ciphertext on-chain.
                        Only your private key can decrypt it — the UI shows your decrypted balance locally.
                      </div>
                      <div className="flow-step-proof"><CircuitBoard size={12} /> DEBT_UPDATE_VALIDITY required</div>
                    </div>
                  </div>
                </div>

                <div className="section-divider" />

                <h3><Lock size={18} /> Journey B: Mint Private Stablecoin</h3>

                <div className="flow-steps">
                  <div className="flow-step">
                    <div className="flow-step-num">1</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Open CDP Position</div>
                      <div className="flow-step-desc">
                        Create a new Collateralized Debt Position. This generates a unique position ID.
                      </div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">2</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Lock sxyBTC as Collateral</div>
                      <div className="flow-step-desc">
                        Transfer sxyBTC from your shielded balance to the CDP as collateral. The amount stays encrypted.
                      </div>
                      <div className="flow-step-proof"><CircuitBoard size={12} /> BALANCE_SUFFICIENCY required</div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">3</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Mint sUSD</div>
                      <div className="flow-step-desc">
                        Mint shielded stablecoin against your collateral. You must prove CR ≥ 200% without revealing
                        either the collateral or debt amounts.
                      </div>
                      <div className="flow-step-proof"><CircuitBoard size={12} /> COLLATERAL_RATIO required</div>
                    </div>
                  </div>
                </div>

                <div className="section-divider" />

                <h3><Unlock size={18} /> Journey C: Repay and Close</h3>

                <div className="flow-steps">
                  <div className="flow-step">
                    <div className="flow-step-num">1</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Repay sUSD Debt</div>
                      <div className="flow-step-desc">
                        Burn sUSD to reduce your CDP debt. Each repayment requires a validity proof.
                      </div>
                      <div className="flow-step-proof"><CircuitBoard size={12} /> DEBT_UPDATE_VALIDITY required</div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">2</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Close Position</div>
                      <div className="flow-step-desc">
                        When debt reaches 0, prove it and close the CDP to unlock all collateral.
                      </div>
                      <div className="flow-step-proof"><CircuitBoard size={12} /> ZERO_DEBT required</div>
                    </div>
                  </div>
                </div>

                <div className="section-divider" />

                <h3><ArrowRight size={18} /> Journey D: Withdraw/Unshield</h3>

                <div className="flow-steps">
                  <div className="flow-step">
                    <div className="flow-step-num">1</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Unshield sxyBTC</div>
                      <div className="flow-step-desc">
                        Convert shielded sxyBTC back to public xyBTC. Requires proving your encrypted balance
                        covers the unshield amount.
                      </div>
                      <div className="flow-step-proof"><CircuitBoard size={12} /> BALANCE_SUFFICIENCY required</div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">2</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Withdraw</div>
                      <div className="flow-step-desc">
                        Withdraw public xyBTC from the vault. No proof required for public balance operations.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </SectionReveal>

          {/* Tokens Section */}
          <SectionReveal>
            <section id="tokens" className="doc-section">
              <div className="section-tag">
                <Hexagon size={12} />
                TOKENS
              </div>
              <h2 className="section-title">Token Types</h2>
              <p className="section-subtitle">
                Three token types with distinct privacy properties.
              </p>

              <div className="doc-content">
                <div className="token-grid">
                  <div className="token-card">
                    <div className="token-symbol">xyBTC</div>
                    <div className="token-name">Liquid Staking Token</div>
                    <div className="token-type">Public • Endur</div>
                  </div>
                  <div className="token-card">
                    <div className="token-symbol">sxyBTC</div>
                    <div className="token-name">Shielded xyBTC</div>
                    <div className="token-type">Encrypted • Tongo</div>
                  </div>
                  <div className="token-card">
                    <div className="token-symbol">sUSD</div>
                    <div className="token-name">Shielded Stablecoin</div>
                    <div className="token-type">Encrypted • CDP</div>
                  </div>
                </div>

                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Balance Type</th>
                      <th>Source</th>
                      <th>Use Case</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>xyBTC</code></td>
                      <td>Public (on-chain visible)</td>
                      <td>Endur liquid staking</td>
                      <td>BTC yield via staking</td>
                    </tr>
                    <tr>
                      <td><code>sxyBTC</code></td>
                      <td>Encrypted (ElGamal ciphertext)</td>
                      <td>Tongo wrapper</td>
                      <td>Private BTC holdings, CDP collateral</td>
                    </tr>
                    <tr>
                      <td><code>sUSD</code></td>
                      <td>Encrypted (ElGamal ciphertext)</td>
                      <td>ShieldedCDP mint</td>
                      <td>Private stablecoin, DeFi payments</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </SectionReveal>

          {/* Security Section */}
          <SectionReveal>
            <section id="security" className="doc-section">
              <div className="section-tag">
                <ShieldCheck size={12} />
                SECURITY
              </div>
              <h2 className="section-title">Security Model</h2>
              <p className="section-subtitle">
                Threat analysis and mitigation strategies for the protocol.
              </p>

              <div className="doc-content">
                <h3><AlertTriangle size={18} /> Threat Model</h3>

                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Threat</th>
                      <th>Mitigation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Forged Proofs</td>
                      <td>Strict on-chain verification via Garaga; invalid proofs always revert</td>
                    </tr>
                    <tr>
                      <td>Ciphertext Malleability</td>
                      <td>Commitment schemes bind ciphertexts to proofs; re-randomization tracked</td>
                    </tr>
                    <tr>
                      <td>Oracle Manipulation</td>
                      <td>Conservative MIN_CR=200%; mint pauses on stale/invalid oracle data</td>
                    </tr>
                    <tr>
                      <td>Insolvency</td>
                      <td>Per-domain solvency proofs; no global coupling between domains</td>
                    </tr>
                    <tr>
                      <td>Key Compromise</td>
                      <td>User keys never leave client; password-encrypted local storage</td>
                    </tr>
                    <tr>
                      <td>Replay Attacks</td>
                      <td>Nonce tracking; proof domain separation via type IDs</td>
                    </tr>
                  </tbody>
                </table>

                <h3><Layers size={18} /> Solvency Proofs</h3>

                <p>
                  StarkShield maintains two independent solvency domains. This isolation prevents
                  issues in one domain from affecting the other:
                </p>

                <div className="feature-grid">
                  <div className="feature-card">
                    <div className="feature-icon" style={{ background: "rgba(16,185,129,.1)" }}>
                      <Database size={20} color="#10b981" />
                    </div>
                    <div className="feature-title">Vault Solvency</div>
                    <div className="feature-desc">
                      Proves: <code>Sum(UserDepositsCipher) == VaultReserveCipher</code><br />
                      Ensures all user deposits are backed by actual reserves.
                    </div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon" style={{ background: "rgba(16,185,129,.1)" }}>
                      <TrendingUp size={20} color="#10b981" />
                    </div>
                    <div className="feature-title">CDP Solvency</div>
                    <div className="feature-desc">
                      Proves: <code>TotalDebt ≤ TotalCollateral / MIN_CR</code><br />
                      Ensures all minted sUSD is over-collateralized.
                    </div>
                  </div>
                </div>

                <InfoBox type="success" title="DELIBERATE EXCLUSIONS (v1.5)">
                  <p style={{ margin: 0 }}>
                    To minimize attack surface, v1.5 explicitly excludes: multi-strategy routers,
                    leverage loops, dark pools, and global cross-protocol solvency proofs.
                  </p>
                </InfoBox>
              </div>
            </section>
          </SectionReveal>

          {/* Integrations Section */}
          <SectionReveal>
            <section id="integration" className="doc-section">
              <div className="section-tag">
                <Link2 size={12} />
                INTEGRATIONS
              </div>
              <h2 className="section-title">External Integrations</h2>
              <p className="section-subtitle">
                Third-party protocols integrated into the StarkShield stack.
              </p>

              <div className="doc-content">
                <div className="integration-grid">
                  <div className="integration-card">
                    <div className="integration-icon">
                      <TrendingUp size={24} color="#3b82f6" />
                    </div>
                    <div className="integration-name">Endur</div>
                    <div className="integration-role">BTC Liquid Staking</div>
                  </div>
                  <div className="integration-card">
                    <div className="integration-icon">
                      <Lock size={24} color="#3b82f6" />
                    </div>
                    <div className="integration-name">Tongo</div>
                    <div className="integration-role">Encrypted Token Wrapper</div>
                  </div>
                  <div className="integration-card">
                    <div className="integration-icon">
                      <ShieldCheck size={24} color="#3b82f6" />
                    </div>
                    <div className="integration-name">Garaga</div>
                    <div className="integration-role">On-Chain Proof Verification</div>
                  </div>
                  <div className="integration-card">
                    <div className="integration-icon">
                      <Binary size={24} color="#3b82f6" />
                    </div>
                    <div className="integration-name">Noir</div>
                    <div className="integration-role">ZK Circuit Language</div>
                  </div>
                  <div className="integration-card">
                    <div className="integration-icon">
                      <Hexagon size={24} color="#3b82f6" />
                    </div>
                    <div className="integration-name">Starknet</div>
                    <div className="integration-role">Execution Layer (L2)</div>
                  </div>
                  <div className="integration-card">
                    <div className="integration-icon">
                      <FileCode size={24} color="#3b82f6" />
                    </div>
                    <div className="integration-name">Cairo</div>
                    <div className="integration-role">Smart Contract Language</div>
                  </div>
                </div>
              </div>
            </section>
          </SectionReveal>

          {/* Deployment Section */}
          <SectionReveal>
            <section id="deployment" className="doc-section">
              <div className="section-tag">
                <Server size={12} />
                DEPLOYMENT
              </div>
              <h2 className="section-title">Deployment Guide</h2>
              <p className="section-subtitle">
                Step-by-step deployment sequence for Starknet Sepolia testnet.
              </p>

              <div className="doc-content">
                <h3><Terminal size={18} /> Prerequisites</h3>

                <ul>
                  <li>Node.js 18+ and npm/yarn</li>
                  <li>Scarb (Cairo package manager)</li>
                  <li>Nargo (Noir toolchain) — pinned version</li>
                  <li>Starknet CLI (<code>starkli</code>)</li>
                  <li>Deployment wallet with Sepolia ETH</li>
                </ul>

                <h3><Cog size={18} /> Deployment Sequence</h3>

                <div className="flow-steps">
                  <div className="flow-step">
                    <div className="flow-step-num">1</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Compile Circuits & Generate VKs</div>
                      <div className="flow-step-desc">
                        Compile all Noir circuits and generate verifying keys for on-chain deployment.
                      </div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">2</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Deploy Verifiers</div>
                      <div className="flow-step-desc">
                        Deploy Garaga verifier contracts with embedded verifying keys.
                      </div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">3</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Deploy Core Contracts</div>
                      <div className="flow-step-desc">
                        Deploy ShieldedVault and ShieldedCDP with verifier addresses.
                      </div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">4</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Configure Integrations</div>
                      <div className="flow-step-desc">
                        Set Endur integration endpoints and oracle feed addresses.
                      </div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">5</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Initialize Parameters</div>
                      <div className="flow-step-desc">
                        Set MIN_CR=200%, MAX_DEPOSIT, and other protocol parameters.
                      </div>
                    </div>
                  </div>
                  <div className="flow-step">
                    <div className="flow-step-num">6</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">Deploy Frontend</div>
                      <div className="flow-step-desc">
                        Build and deploy frontend with contract addresses configured.
                      </div>
                    </div>
                  </div>
                </div>

                <CodeBlock
                  title="Quick Start Commands"
                  language="bash"
                  code={`# Clone and install
git clone https://github.com/starkshield/protocol
cd protocol && npm install

# Compile circuits
cd circuits && nargo compile && nargo prove

# Build contracts
cd ../contracts && scarb build

# Deploy (set DEPLOYER_PRIVATE_KEY in .env)
cd ../scripts && npx ts-node deploy.ts --network sepolia

# Start frontend
cd ../frontend && npm run dev`}
                />

                <InfoBox type="info" title="ENVIRONMENT VARIABLES">
                  <p style={{ margin: 0 }}>
                    Required: <code>DEPLOYER_PRIVATE_KEY</code>, <code>STARKNET_RPC_URL</code><br />
                    Optional: <code>ORACLE_FEED_ADDRESS</code>, <code>ENDUR_ROUTER_ADDRESS</code>
                  </p>
                </InfoBox>
              </div>
            </section>
          </SectionReveal>

          {/* Footer */}
          <div style={{ marginTop: 80, paddingTop: 40, borderTop: "1px solid rgba(59,130,246,.08)", textAlign: "center" }}>
            <div style={{ marginBottom: 24 }}>
              <Shield size={32} color="#3b82f6" style={{ opacity: 0.3 }} />
            </div>
            <div className="footer-text">
              OBSCURA v1.5 — STARKNET — CAIRO — NOIR — GARAGA
            </div>
            <div style={{ marginTop: 16 }}>
              <Link to="/stake" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: 10,
                background: "linear-gradient(135deg, #3b82f6, #60a5fa)",
                color: "#04060b", fontFamily: "'Orbitron', sans-serif",
                fontSize: 12, fontWeight: 700, letterSpacing: 2,
                textDecoration: "none", transition: "all .3s",
                boxShadow: "0 0 30px rgba(59,130,246,.3)"
              }}>
                LAUNCH APP
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
