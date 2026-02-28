import { CSSProperties } from 'react';

interface ObscuraLogoProps {
  size?: number;
  glow?: boolean;
  animated?: boolean;
  color?: string;
}

// Logo styles - include these in the component or parent
export const logoStyles = `
  .logo-glow {
    animation: logoPulse 3s ease-in-out infinite;
  }
  @keyframes logoPulse {
    0%, 100% { filter: drop-shadow(0 0 12px rgba(59,130,246,.25)); }
    50% { filter: drop-shadow(0 0 30px rgba(59,130,246,.55)); }
  }
  .logo-ring-outer {
    animation: ringSpin 20s linear infinite;
    transform-origin: 50px 50px;
  }
  .logo-ring-mid {
    animation: ringSpinR 14s linear infinite;
    transform-origin: 50px 50px;
  }
  .logo-ring-inner {
    animation: ringSpinSlow 10s linear infinite;
    transform-origin: 50px 50px;
  }
  @keyframes ringSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes ringSpinR {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-360deg); }
  }
  @keyframes ringSpinSlow {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export default function ObscuraLogo({
  size = 40,
  glow = false,
  animated = true,
  color = "#3b82f6"
}: ObscuraLogoProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className={glow ? "logo-glow" : ""} style={style}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <defs>
          <filter id="liGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Outer ring with notches */}
        <g className={animated ? "logo-ring-outer" : ""}>
          <circle
            cx="50" cy="50" r="38"
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity="0.3"
            strokeDasharray="8 4"
          />
        </g>

        {/* Middle ring */}
        <g className={animated ? "logo-ring-mid" : ""}>
          <circle
            cx="50" cy="50" r="28"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            opacity="0.5"
            strokeDasharray="12 6"
          />
          {/* Tick marks */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
            <line
              key={i}
              x1={50 + 24 * Math.cos(a * Math.PI / 180)}
              y1={50 + 24 * Math.sin(a * Math.PI / 180)}
              x2={50 + 28 * Math.cos(a * Math.PI / 180)}
              y2={50 + 28 * Math.sin(a * Math.PI / 180)}
              stroke={color}
              strokeWidth="1.5"
              opacity="0.4"
            />
          ))}
        </g>

        {/* Inner ring */}
        <g className={animated ? "logo-ring-inner" : ""}>
          <circle
            cx="50" cy="50" r="18"
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity="0.6"
          />
        </g>

        {/* Lock keyhole center */}
        <circle
          cx="50" cy="47" r="5"
          fill={color}
          opacity="0.8"
          filter="url(#liGlow)"
        />
        <rect
          x="48" y="49"
          width="4" height="8"
          rx="1"
          fill={color}
          opacity="0.8"
        />
      </svg>
    </div>
  );
}
