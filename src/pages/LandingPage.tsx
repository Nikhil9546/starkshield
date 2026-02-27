import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldOff, Zap, Link2, TrendingDown, Lock, Landmark, KeyRound, BadgeCheck, Ruler, Coins, BarChart3, Search, Globe, Layers, Cpu, Eye, FileText, Fingerprint, Binary, Scan, CircuitBoard, Blocks, Network, Radio, ArrowRight, ChevronDown, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

/* ================================================================
   HOOKS
   ================================================================ */

function useBootSequence() {
  const [lines, setLines] = useState<{ text: string; ok?: boolean }[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const bl = [
      { text: '> starkshield init v1.5.0', delay: 0 },
      { text: '  Loading Cairo contracts...', delay: 120 },
      { text: '  [OK] ShieldedVault.cairo compiled', delay: 260, ok: true },
      { text: '  [OK] ShieldedCDP.cairo compiled', delay: 380, ok: true },
      { text: '  [OK] ProofVerifiers.cairo linked', delay: 490, ok: true },
      { text: '  [OK] SolvencyProver.cairo linked', delay: 600, ok: true },
      { text: '  Initializing Noir circuits...', delay: 740 },
      { text: '  [OK] 7 circuits verified via Garaga', delay: 880, ok: true },
      { text: '  Connecting Tongo encryption layer...', delay: 1020 },
      { text: '  [OK] ElGamal 256-bit keypair ready', delay: 1160, ok: true },
      { text: '  Binding Endur xyBTC staking...', delay: 1300 },
      { text: '  [OK] All integrations nominal', delay: 1440, ok: true },
      { text: '', delay: 1560 },
      { text: '  ## STARKSHIELD v1.5 ONLINE ##', delay: 1650, ok: true },
    ];
    const ts = bl.map((l) => setTimeout(() => setLines(p => [...p, { text: l.text, ok: l.ok }]), l.delay));
    const f = setTimeout(() => setDone(true), 2300);
    return () => { ts.forEach(clearTimeout); clearTimeout(f); };
  }, []);
  return { lines, done };
}

function useParticleCanvas(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const mouse = useRef({ x: -9e3, y: -9e3 });
  const parts = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([]);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    resize(); window.addEventListener('resize', resize);
    parts.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * cv.width, y: Math.random() * cv.height,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.4 + 0.4,
    }));
    const onM = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    window.addEventListener('mousemove', onM);
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const ps = parts.current, m = mouse.current;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i], dx = p.x - m.x, dy = p.y - m.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) { const f = (110 - d) / 110 * 0.6; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
        p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = cv.width; if (p.x > cv.width) p.x = 0;
        if (p.y < 0) p.y = cv.height; if (p.y > cv.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(59,130,246,0.3)'; ctx.fill();
        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j], cx = p.x - q.x, cy = p.y - q.y, cd = Math.sqrt(cx * cx + cy * cy);
          if (cd < 90) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = `rgba(59,130,246,${0.055 * (1 - cd / 90)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
        }
      }
      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onM); };
  }, [canvasRef]);
}

function useGlitch(ref: React.RefObject<HTMLElement>, iv = 4500) {
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const t = () => { el.classList.add('ss-ga'); setTimeout(() => el.classList.remove('ss-ga'), 180); };
    const id = setInterval(t, iv + Math.random() * 2500);
    return () => clearInterval(id);
  }, [ref, iv]);
}

function useTypewriter(text: string, speed = 28, startDelay = 2500) {
  const [display, setDisplay] = useState('');
  const [isDone, setIsDone] = useState(false);
  useEffect(() => {
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => { if (i < text.length) { setDisplay(text.slice(0, i + 1)); i++; } else { setIsDone(true); clearInterval(iv); } }, speed);
    }, startDelay);
    return () => clearTimeout(t);
  }, [text, speed, startDelay]);
  return { display, isDone };
}

function useScrollReveal() {
  const refs = useRef<HTMLElement[]>([]);
  const add = useCallback((el: HTMLElement | null) => { if (el && !refs.current.includes(el)) refs.current.push(el); }, []);
  useEffect(() => {
    const obs = new IntersectionObserver((es) => { es.forEach(e => { if (e.isIntersecting) e.target.classList.add('ss-vis'); }); }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    refs.current.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return add;
}

/* ================================================================
   CARD
   ================================================================ */

function HoloCard({ children, className = '', accentColor = '#3b82f6', delay = 0 }: { children: React.ReactNode; className?: string; accentColor?: string; delay?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current || !spotRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    spotRef.current.style.left = `${e.clientX - r.left}px`;
    spotRef.current.style.top = `${e.clientY - r.top}px`;
  };
  const dots = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    delay: i * 0.7 + Math.random() * 0.4,
    duration: 2.5 + Math.random() * 1.5,
    startX: Math.random() * 100,
  })), []);

  return (
    <div ref={cardRef} className={`ss-card ${className}`} style={{ '--ac': accentColor, '--del': `${delay}s` } as React.CSSProperties}
      onMouseMove={onMouseMove} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="ss-card-border" />
      <div ref={spotRef} className="ss-card-spot" />
      <div className={`ss-card-orbit ${hovered ? 'active' : ''}`}>
        <div className="ss-orbit-ring" /><div className="ss-orbit-dot" />
      </div>
      <div className="ss-card-flow">
        {dots.map((d, i) => <div key={i} className="ss-flow-dot" style={{ animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s`, left: `${d.startX}%` }} />)}
      </div>
      <div className="ss-corner ss-tl" /><div className="ss-corner ss-br" />
      <div className="ss-energy" />
      <div className="ss-card-inner">{children}</div>
    </div>
  );
}

/* ================================================================
   SMALL COMPONENTS
   ================================================================ */

function AnimatedCounter({ target, suffix = '', duration = 1800 }: { target: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true; const s = performance.now();
        const step = (n: number) => { const p = Math.min((n - s) / duration, 1); setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

function MatrixStream({ side }: { side: 'left' | 'right' }) {
  const chars = useMemo(() => {
    const g = '01001011010011100101110100111001';
    return Array.from({ length: 25 }, () => ({ char: g[Math.floor(Math.random() * g.length)], left: Math.random() * 14, dur: 4 + Math.random() * 6, delay: Math.random() * 10, op: 0.3 + Math.random() * 0.7 }));
  }, []);
  return (
    <div className="ss-mx" style={{ position: 'fixed', top: 0, bottom: 0, width: 18, zIndex: 1, pointerEvents: 'none', overflow: 'hidden', opacity: 0.1, ...(side === 'left' ? { left: 10 } : { right: 10 }) }}>
      {chars.map((c, i) => <span key={i} style={{ position: 'absolute', fontFamily: 'var(--fm)', fontSize: 10, color: '#3b82f6', left: c.left, animation: `ssMF ${c.dur}s linear ${c.delay}s infinite`, opacity: c.op, textShadow: '0 0 5px rgba(59,130,246,0.3)' }}>{c.char}</span>)}
    </div>
  );
}

const GlowDiv = () => <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.4),rgba(139,92,246,0.4),transparent)', opacity: 0.35 }} />;
const SH = ({ label, lc, title, desc }: { label: string; lc: string; title: string; desc: string }) => (
  <>
    <div style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12, color: lc }}>{label}</div>
    <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(26px,3.8vw,38px)', fontWeight: 700, letterSpacing: '-0.3px', textAlign: 'center', color: '#e2e8f0', marginBottom: 14 }}>{title}</h2>
    <p style={{ fontFamily: 'var(--fb)', fontSize: 15, color: 'rgba(226,232,240,0.3)', textAlign: 'center', maxWidth: 500, margin: '0 auto 52px', lineHeight: 1.6 }}>{desc}</p>
  </>
);

/* ================================================================
   DATA
   ================================================================ */
const PROBLEMS = [
  { Icon: Eye, title: 'Transparent Balances', desc: 'Every staking position, every yield claim, every portfolio size publicly visible. Whales become targets for social engineering and MEV.', tag: 'EXPOSURE' },
  { Icon: Zap, title: 'Front-Running Risk', desc: 'Visible large deposits and withdrawals invite MEV extraction. Transactions exploited before they settle on-chain.', tag: 'MEV' },
  { Icon: Link2, title: 'Linkable Identity', desc: 'On-chain activity patterns create identity graphs. Deposit amounts, timing, and interactions reveal who you are.', tag: 'DEANON' },
  { Icon: TrendingDown, title: 'No Private Yield', desc: '$160M+ BTC staked on Starknet with zero privacy options. Institutional capital stays sidelined without position confidentiality.', tag: 'GAP' },
];
const SOLUTIONS = [
  { Icon: Lock, title: 'ShieldedVault', desc: 'Deposit wrapped BTC, stake via Endur, receive sxyBTC with ElGamal encrypted balances. Position invisible on-chain, decrypted locally.', tag: 'ShieldedVault.cairo' },
  { Icon: Landmark, title: 'ShieldedCDP', desc: 'Lock sxyBTC as collateral, mint shielded sUSD. CR >= 200% verified by ZK proof without revealing amounts. Disclosure-on-liquidation.', tag: 'ShieldedCDP.cairo' },
  { Icon: KeyRound, title: 'ElGamal + Tongo', desc: 'All balances stored as ciphertext pairs C=(c1,c2) on Stark curve. Homomorphic accumulation enables solvency proofs over encrypted state.', tag: 'Tongo / ElGamal' },
  { Icon: BadgeCheck, title: 'On-Chain Verification', desc: 'Every state transition verified by Garaga. Domain-separated verifying keys, replay protection, strict proof type enforcement.', tag: 'ProofVerifiers.cairo / Garaga' },
];
const ARCH = [
  { Icon: Ruler, title: 'Range Proofs', desc: 'Proves deposit amount is within (0, MAX_DEPOSIT] without revealing value. Guards against zero-value and overflow attacks.', tag: 'range_proof.nr' },
  { Icon: Coins, title: 'Balance Sufficiency', desc: 'Proves sender ciphertext balance minus spend delta is valid. No underflow. Prevents invisible overdraft attacks.', tag: 'balance_sufficiency.nr' },
  { Icon: BarChart3, title: 'Collateral Ratio', desc: 'Proves (collateral_value / debt_value) >= MIN_CR. Oracle price is public; actual amounts stay private.', tag: 'collateral_ratio.nr' },
  { Icon: Search, title: 'Solvency Proofs', desc: 'Per-domain: Vault reserves match deposit sums, CDP total debt within collateral bounds. No global cross-protocol coupling.', tag: 'vault_solvency.nr + cdp_safety_bound.nr' },
];
const JOURNEY = [
  { num: '01', Icon: Globe, title: 'Bridge', desc: 'Bring wrapped BTC (WBTC, tBTC, LBTC) onto Starknet. Public on Bitcoin side. Privacy begins after shielding.', label: 'BTC / STARKNET' },
  { num: '02', Icon: ShieldCheck, title: 'Shield', desc: 'Deposit into ShieldedVault, stake via Endur, mint xyBTC, encrypt into sxyBTC via Tongo. Balance becomes ciphertext.', label: 'WBTC / sxyBTC' },
  { num: '03', Icon: Layers, title: 'Mint', desc: 'Lock sxyBTC in ShieldedCDP, mint sUSD. ZK proof verifies collateral ratio >= 200% without revealing position size.', label: 'sxyBTC / sUSD' },
  { num: '04', Icon: ExternalLink, title: 'Exit', desc: 'Repay sUSD, prove zero debt, unlock collateral, unshield back to public xyBTC. Proof-validated at every step.', label: 'UNSHIELD / EXIT' },
];
const TS = [{ val: 7, label: 'Noir Circuits' }, { val: 256, suffix: '-bit', label: 'Encryption' }, { val: 200, suffix: '%', label: 'Min CR' }, { val: 2, label: 'Solvency Domains' }, { val: 0, label: 'Trusted Parties' }, { val: 100, suffix: '%', label: 'Verified On-Chain' }];
const STACK_ITEMS = [{ name: 'Cairo', Icon: CircuitBoard }, { name: 'Noir', Icon: Binary }, { name: 'Garaga', Icon: Scan }, { name: 'Tongo', Icon: Fingerprint }, { name: 'Endur', Icon: Blocks }, { name: 'Starknet', Icon: Network }, { name: 'ElGamal', Icon: KeyRound }, { name: 'Semaphore', Icon: Radio }];

/* ================================================================
   MAIN
   ================================================================ */
export default function StarkShieldLanding() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLHeadingElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const addR = useScrollReveal();
  const { lines, done } = useBootSequence();
  useParticleCanvas(cvRef);
  useGlitch(glRef);
  const sub = useTypewriter('ElGamal encrypted balances  /  Noir ZK proofs  /  Garaga on-chain verification  /  Zero trust assumptions', 28, 2500);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 40); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);

  const renderCards = (items: typeof PROBLEMS, accent: string, tagColor: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
      {items.map((it, i) => {
        const Ic = it.Icon;
        return (
          <HoloCard key={i} className={`ss-${accent}`} accentColor={tagColor} delay={i * 0.1}>
            <div className="ss-card-icon" style={{ color: tagColor }}><Ic size={26} strokeWidth={1.5} /></div>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 9 }}>{it.title}</div>
            <div style={{ fontFamily: 'var(--fb)', fontSize: 13, lineHeight: 1.65, color: 'rgba(226,232,240,0.35)' }}>{it.desc}</div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: tagColor, marginTop: 14, letterSpacing: 0.5, opacity: 0.7 }}>{it.tag}</div>
          </HoloCard>
        );
      })}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#04060b', color: '#e2e8f0', fontFamily: "'Outfit',sans-serif", overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Fira+Code:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
        :root{--fd:'Orbitron',sans-serif;--fm:'Fira Code',monospace;--fb:'Outfit',sans-serif}
        *{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.18);border-radius:4px}
        @keyframes ssMF{0%{transform:translateY(-20px);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(100vh);opacity:0}}
        @keyframes ssCRT{0%{top:-100%}100%{top:200%}}
        @keyframes ssBl{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes ssFl{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes ssSP{0%,100%{filter:drop-shadow(0 0 6px rgba(59,130,246,0.25))}50%{filter:drop-shadow(0 0 18px rgba(59,130,246,0.55))}}
        @keyframes ssSB{0%,100%{transform:translateY(0);opacity:0.4}50%{transform:translateY(8px);opacity:1}}
        @keyframes ssGS{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes ssBL{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}
        @keyframes ssTB{0%,100%{border-right-color:#3b82f6}50%{border-right-color:transparent}}
        @keyframes ssG1{0%{transform:translate(0)}25%{transform:translate(-3px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,2px)}100%{transform:translate(0)}}
        @keyframes ssG2{0%{transform:translate(0)}25%{transform:translate(2px,-2px)}50%{transform:translate(-3px,1px)}75%{transform:translate(1px,-1px)}100%{transform:translate(0)}}
        @keyframes ssConicSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes ssOrbitRing{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes ssOrbitDot{0%{transform:rotate(0deg) translateX(32px) scale(1)}50%{transform:rotate(180deg) translateX(32px) scale(1.3)}100%{transform:rotate(360deg) translateX(32px) scale(1)}}
        @keyframes ssFlowUp{0%{bottom:-4px;opacity:0}15%{opacity:0.7}85%{opacity:0.7}100%{bottom:100%;opacity:0}}
        @keyframes ssEP{0%,100%{opacity:0.25;transform:scaleX(0.3)}50%{opacity:1;transform:scaleX(1)}}
        @keyframes ssTS{0%{left:-100%}50%,100%{left:200%}}
        .ss-sp{animation:ssSP 2s ease-in-out infinite}
        .ss-bo{position:fixed;inset:0;z-index:9999;background:#04060b;display:flex;align-items:center;justify-content:center;transition:opacity 0.5s,visibility 0.5s}
        .ss-bo.done{opacity:0;visibility:hidden;pointer-events:none}
        .ss-bl{opacity:0;animation:ssBL 0.08s ease forwards}
        .ss-cb{display:inline-block;width:8px;height:14px;background:#3b82f6;animation:ssBl 0.6s step-end infinite;vertical-align:middle;margin-left:4px}
        .ss-crt{position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden}
        .ss-crt::before{content:'';position:absolute;top:-100%;left:0;width:100%;height:100%;background:linear-gradient(180deg,transparent 0%,rgba(59,130,246,0.012) 50%,transparent 100%);animation:ssCRT 4s linear infinite}
        .ss-crt::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px)}
        .ss-ga::before,.ss-ga::after{content:attr(data-text);position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden}
        .ss-ga::before{color:#06b6d4;animation:ssG1 0.15s linear;clip-path:polygon(0 0,100% 0,100% 33%,0 33%)}
        .ss-ga::after{color:#ef4444;animation:ssG2 0.15s linear;clip-path:polygon(0 66%,100% 66%,100% 100%,0 100%)}
        .ss-rv{opacity:0;transform:translateY(36px);transition:opacity 0.65s cubic-bezier(0.16,1,0.3,1),transform 0.65s cubic-bezier(0.16,1,0.3,1)}
        .ss-vis{opacity:1;transform:translateY(0)}

        /* === CARD === */
        .ss-card{position:relative;border-radius:18px;overflow:visible;cursor:default;opacity:0;transform:translateY(24px);transition:opacity 0.55s cubic-bezier(0.16,1,0.3,1),transform 0.55s cubic-bezier(0.16,1,0.3,1);transition-delay:var(--del,0s)}
        .ss-vis .ss-card{opacity:1;transform:translateY(0)}
        .ss-card:hover{transform:translateY(-5px)!important}

        /* Conic spinning border */
        .ss-card-border{position:absolute;inset:-1px;z-index:0;border-radius:19px;overflow:hidden;opacity:0;transition:opacity 0.4s}
        .ss-card:hover .ss-card-border{opacity:1}
        .ss-card-border::before{content:'';position:absolute;inset:-50%;background:conic-gradient(from 0deg,transparent 0%,var(--ac) 10%,transparent 20%,transparent 100%);animation:ssConicSpin 3s linear infinite}

        .ss-card-inner{position:relative;z-index:2;background:rgba(6,10,20,0.94);border:1px solid rgba(59,130,246,0.06);border-radius:18px;padding:30px 26px;transition:border-color 0.4s,background 0.4s;overflow:hidden}
        .ss-card:hover .ss-card-inner{border-color:rgba(59,130,246,0.12);background:rgba(8,14,28,0.97)}

        /* Mouse spotlight */
        .ss-card-spot{position:absolute;z-index:1;width:280px;height:280px;border-radius:50%;pointer-events:none;opacity:0;transition:opacity 0.35s;transform:translate(-50%,-50%)}
        .ss-card:hover .ss-card-spot{opacity:1}

        /* Orbital ring */
        .ss-card-orbit{position:absolute;z-index:5;top:24px;right:20px;width:64px;height:64px;pointer-events:none;opacity:0;transition:opacity 0.5s}
        .ss-card-orbit.active{opacity:1}
        .ss-orbit-ring{position:absolute;inset:0;border:1px dashed rgba(255,255,255,0.06);border-radius:50%;animation:ssOrbitRing 8s linear infinite}
        .ss-orbit-dot{position:absolute;top:50%;left:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:var(--ac);box-shadow:0 0 10px var(--ac);animation:ssOrbitDot 3s linear infinite}

        /* Data flow dots */
        .ss-card-flow{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;opacity:0;transition:opacity 0.4s;border-radius:18px}
        .ss-card:hover .ss-card-flow{opacity:1}
        .ss-flow-dot{position:absolute;width:2.5px;height:2.5px;border-radius:50%;background:var(--ac);animation:ssFlowUp 3s linear infinite}

        /* Corners */
        .ss-corner{position:absolute;z-index:6;width:14px;height:14px;border-style:solid;opacity:0;transition:opacity 0.4s;pointer-events:none}
        .ss-tl{top:-1px;left:-1px;border-width:1.5px 0 0 1.5px;border-color:var(--ac);border-radius:18px 0 0 0}
        .ss-br{bottom:-1px;right:-1px;border-width:0 1.5px 1.5px 0;border-color:var(--ac);border-radius:0 0 18px 0}
        .ss-card:hover .ss-corner{opacity:0.5}

        /* Energy pulse */
        .ss-energy{position:absolute;z-index:6;bottom:-1px;left:15%;right:15%;height:2px;background:linear-gradient(90deg,transparent,var(--ac),transparent);opacity:0;transition:opacity 0.4s;pointer-events:none}
        .ss-card:hover .ss-energy{opacity:1;animation:ssEP 2s ease-in-out infinite}

        /* Card icon box */
        .ss-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;transition:all 0.3s;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05)}
        .ss-card:hover .ss-card-icon{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1)}

        /* Tag */
        .ss-tg{position:relative;display:inline-block;font-family:var(--fm);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:4px;overflow:hidden}
        .ss-tg::after{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);animation:ssTS 3s ease-in-out infinite}

        /* Journey number */
        .ss-jnum{font-family:var(--fd);font-size:40px;font-weight:800;position:absolute;top:24px;right:20px;z-index:7;opacity:0.06;pointer-events:none;color:var(--ac)}

        /* CTAs */
        .ss-cp{display:inline-flex;align-items:center;gap:8px;font-family:var(--fd);font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,#3b82f6,#8b5cf6);background-size:200% 200%;padding:13px 28px;border-radius:10px;border:none;cursor:pointer;text-decoration:none;transition:box-shadow 0.3s,transform 0.2s;animation:ssGS 3s ease infinite}
        .ss-cp:hover{box-shadow:0 0 28px rgba(59,130,246,0.2),0 0 56px rgba(139,92,246,0.08);transform:translateY(-2px)}
        .ss-cs{display:inline-flex;align-items:center;gap:8px;font-family:var(--fd);font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:rgba(226,232,240,0.5);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:13px 28px;border-radius:10px;cursor:pointer;text-decoration:none;transition:all 0.3s}
        .ss-cs:hover{color:#e2e8f0;border-color:rgba(59,130,246,0.4);background:rgba(59,130,246,0.05)}
        .ss-tp{display:inline-flex;align-items:center;gap:7px;font-family:var(--fm);font-size:12px;font-weight:500;color:#3b82f6;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.12);padding:8px 16px;border-radius:100px;transition:all 0.3s;cursor:default}
        .ss-tp:hover{background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.3);box-shadow:0 0 14px rgba(59,130,246,0.12)}
        @media(max-width:768px){.ss-nl{display:none!important}.ss-mx{display:none!important}}
      `}</style>

      {/* Boot */}
      <div className={`ss-bo ${done ? 'done' : ''}`}>
        <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: '#3b82f6', maxWidth: 540, width: '90%', lineHeight: 1.8 }}>
          {lines.map((l, i) => <div key={i} className="ss-bl" style={{ animationDelay: `${i * 0.025}s`, color: l.ok ? '#22c55e' : '#3b82f6' }}>{l.text}</div>)}
          {!done && <span className="ss-cb" />}
        </div>
      </div>
      <div className="ss-crt" />
      <canvas ref={cvRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 50% at 50% -5%,rgba(59,130,246,0.07) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% 100%,rgba(139,92,246,0.04) 0%,transparent 50%)' }} />
      <MatrixStream side="left" /><MatrixStream side="right" />

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: scrolled ? 'rgba(4,6,11,0.88)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? '1px solid rgba(59,130,246,0.08)' : '1px solid transparent', transition: 'all 0.4s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ss-sp"><Shield size={22} strokeWidth={1.8} color="#3b82f6" /></div>
          <span style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>StarkShield</span>
          <span className="ss-tg" style={{ background: 'rgba(59,130,246,0.08)', color: 'rgba(59,130,246,0.5)', fontSize: 9, padding: '2px 7px' }}>v1.5</span>
        </div>
        <div className="ss-nl" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {['Problem', 'Solution', 'Architecture', 'Journey', 'Tech'].map(s => (
            <a key={s} href={`#${s.toLowerCase()}`} style={{ fontFamily: 'var(--fb)', fontSize: 13, color: 'rgba(226,232,240,0.3)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#3b82f6'} onMouseLeave={e => (e.target as HTMLElement).style.color = 'rgba(226,232,240,0.3)'}>{s}</a>
          ))}
          <Link to="/stake" className="ss-cp" style={{ padding: '7px 18px', fontSize: 10 }}>Launch App <ArrowRight size={12} /></Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 60px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(59,130,246,0.08)', borderRadius: 100, padding: '5px 14px 5px 7px', marginBottom: 28, opacity: done ? 1 : 0, transition: 'opacity 0.5s 0.2s', animation: done ? 'ssFl 3s ease-in-out infinite' : 'none' }}>
          <span className="ss-tg" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff', padding: '2px 9px', borderRadius: 100, fontSize: 9, fontWeight: 700 }}>STARKNET</span>
          <span style={{ fontFamily: 'var(--fb)', fontSize: 12, color: 'rgba(226,232,240,0.3)' }}>Re&#123;define&#125; Hackathon / Privacy x Bitcoin</span>
        </div>
        <h1 ref={glRef} data-text="Shield Your Bitcoin. Own Your Privacy." style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(30px,5.2vw,64px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.5px', color: '#e2e8f0', maxWidth: 800, marginBottom: 22, position: 'relative', display: 'inline-block', opacity: done ? 1 : 0, transform: done ? 'translateY(0)' : 'translateY(18px)', transition: 'opacity 0.6s 0.3s, transform 0.6s 0.3s' }}>
          Shield Your Bitcoin.{' '}
          <span style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Own Your Privacy.</span>
        </h1>
        <p style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(11px,1.3vw,14px)', color: 'rgba(226,232,240,0.3)', maxWidth: 660, marginBottom: 44, minHeight: '1.5em', overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '2px solid #3b82f6', animation: sub.isDone ? 'ssTB 0.7s step-end infinite' : 'none', opacity: done ? 1 : 0, transition: 'opacity 0.4s 0.5s' }}>{sub.display}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, maxWidth: 640, width: '100%', opacity: done ? 1 : 0, transform: done ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s 0.7s, transform 0.6s 0.7s' }}>
          {[{ v: 7, l: 'ZK Circuits', I: Cpu }, { v: 4, l: 'Cairo Contracts', I: FileText }, { v: 200, s: '%', l: 'Min Collateral', I: ShieldAlert }, { v: 0, l: 'Trust Assumptions', I: ShieldOff }].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '18px 10px', background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(59,130,246,0.08)', borderRadius: 12 }}>
              <s.I size={15} color="rgba(59,130,246,0.35)" style={{ marginBottom: 6 }} />
              <div style={{ fontFamily: 'var(--fm)', fontSize: 26, fontWeight: 700, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}><AnimatedCounter target={s.v} suffix={s.s || ''} /></div>
              <div style={{ fontFamily: 'var(--fb)', fontSize: 10.5, color: 'rgba(226,232,240,0.3)', marginTop: 4, letterSpacing: 1.2, textTransform: 'uppercase' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: done ? 0.45 : 0, transition: 'opacity 0.8s 1.2s', animation: done ? 'ssSB 2s ease-in-out infinite' : 'none' }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'rgba(226,232,240,0.3)', letterSpacing: 2 }}>SCROLL</span>
          <ChevronDown size={16} color="rgba(59,130,246,0.5)" />
        </div>
      </section>

      <GlowDiv />

      <section id="problem" style={{ position: 'relative', zIndex: 2, padding: '96px 0' }}>
        <div className="ss-rv" ref={addR} style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <SH label="The Problem" lc="#ef4444" title="BTC DeFi Has a Privacy Crisis" desc="Every position, every yield claim, every transaction is a public broadcast. Institutional capital won't deploy without confidentiality." />
          {renderCards(PROBLEMS, 'red', '#ef4444')}
        </div>
      </section>
      <GlowDiv />

      <section id="solution" style={{ position: 'relative', zIndex: 2, padding: '96px 0' }}>
        <div className="ss-rv" ref={addR} style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <SH label="The Solution" lc="#3b82f6" title="Privacy-Preserving BTC DeFi Stack" desc="Four production contracts making every state transition provable without revealing any user data on-chain." />
          {renderCards(SOLUTIONS, 'blue', '#3b82f6')}
        </div>
      </section>
      <GlowDiv />

      <section id="architecture" style={{ position: 'relative', zIndex: 2, padding: '96px 0' }}>
        <div className="ss-rv" ref={addR} style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <SH label="ZK Architecture" lc="#8b5cf6" title="7 Noir Circuits. Zero Trust." desc="Every encrypted state transition verified by a dedicated Noir circuit compiled and verified on-chain via Garaga." />
          {renderCards(ARCH, 'purple', '#8b5cf6')}
        </div>
      </section>
      <GlowDiv />

      <section id="journey" style={{ position: 'relative', zIndex: 2, padding: '96px 0' }}>
        <div className="ss-rv" ref={addR} style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <SH label="User Journey" lc="#06b6d4" title="Bridge / Shield / Mint / Exit" desc="Four steps from public BTC to fully private DeFi. Every transition cryptographically verified." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 18 }}>
            {JOURNEY.map((j, i) => {
              const Ic = j.Icon;
              return (
                <HoloCard key={i} className="ss-cyan" accentColor="#06b6d4" delay={i * 0.12}>
                  <div className="ss-jnum">{j.num}</div>
                  <div className="ss-card-icon" style={{ color: '#06b6d4' }}><Ic size={24} strokeWidth={1.5} /></div>
                  <span className="ss-tg" style={{ background: 'rgba(6,182,212,0.08)', color: 'rgba(6,182,212,0.6)', marginBottom: 12, display: 'inline-block' }}>{j.label}</span>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 9 }}>{j.title}</div>
                  <div style={{ fontFamily: 'var(--fb)', fontSize: 13, lineHeight: 1.65, color: 'rgba(226,232,240,0.35)' }}>{j.desc}</div>
                </HoloCard>
              );
            })}
          </div>
        </div>
      </section>
      <GlowDiv />

      <section id="tech" style={{ position: 'relative', zIndex: 2, padding: '96px 0' }}>
        <div className="ss-rv" ref={addR} style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <SH label="Technology" lc="#3b82f6" title="Built on Proven Cryptography" desc="Every number is real. Every claim is verifiable. No simulations, no mocks." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 12 }} className="ss-card" >
            {TS.map((t, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '22px 14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(59,130,246,0.08)', borderRadius: 14, transition: 'border-color 0.3s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.2)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.08)'}>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 22, fontWeight: 700, color: '#3b82f6' }}><AnimatedCounter target={t.val} suffix={t.suffix || ''} /></div>
                <div style={{ fontFamily: 'var(--fb)', fontSize: 10.5, color: 'rgba(226,232,240,0.3)', marginTop: 5, textTransform: 'uppercase', letterSpacing: 1 }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 36 }} className="ss-card">
            {STACK_ITEMS.map(({ name, Icon: Ic }) => <span key={name} className="ss-tp"><Ic size={14} strokeWidth={1.5} /> {name}</span>)}
          </div>
        </div>
      </section>
      <GlowDiv />

      <section id="cta" style={{ position: 'relative', zIndex: 2, padding: '110px 24px 72px' }}>
        <div className="ss-rv" ref={addR}>
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '56px 36px', textAlign: 'center', background: 'linear-gradient(135deg,rgba(59,130,246,0.035),rgba(139,92,246,0.035))', border: '1px solid rgba(59,130,246,0.08)', borderRadius: 26, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,#3b82f6,#8b5cf6,transparent)' }} />
            <div className="ss-sp" style={{ marginBottom: 22, display: 'flex', justifyContent: 'center' }}><Shield size={36} strokeWidth={1.5} color="#3b82f6" /></div>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(22px,3.2vw,34px)', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px', marginBottom: 12, lineHeight: 1.15 }}>
              The Future of BTC DeFi{' '}
              <span style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>is Private</span>
            </h2>
            <p style={{ fontFamily: 'var(--fb)', fontSize: 14.5, color: 'rgba(226,232,240,0.3)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 28px' }}>
              StarkShield v1.5 — Privacy-preserving BTC DeFi powered by Starknet's ZK infrastructure. Built for the Re&#123;define&#125; Hackathon.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/stake" className="ss-cp"><Cpu size={14} /> Launch App <ArrowRight size={12} /></Link>
              <a href="#" className="ss-cs"><FileText size={14} /> View PRD</a>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 56, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--fb)', fontSize: 12, color: 'rgba(226,232,240,0.25)' }}>
          <ShieldCheck size={14} color="rgba(59,130,246,0.4)" /> Built for the Starknet Re&#123;define&#125; Hackathon
        </div>
        <div style={{ marginTop: 8, textAlign: 'center', fontFamily: 'var(--fm)', fontSize: 11, color: 'rgba(226,232,240,0.18)' }}>Cairo / Noir / Garaga / Tongo / Endur</div>
      </section>
    </div>
  );
}
