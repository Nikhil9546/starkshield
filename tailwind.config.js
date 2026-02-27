/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary background
        stark: {
          bg: '#04060b',
          900: '#080c14',
          800: '#0d1320',
          700: '#131b2e',
          600: '#1a253d',
        },
        // Deep blue accent
        cyber: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Shield blue (original)
        shield: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        // Problem cards - red
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        // Architecture - purple
        matrix: {
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
        },
        // User Journey - cyan
        flow: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
        fira: ['Fira Code', 'monospace'],
        outfit: ['Outfit', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 8s linear infinite',
        'gradient': 'gradient 8s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scanline': 'scanline 8s linear infinite',
        'glitch': 'glitch 0.3s ease-in-out',
        'typewriter': 'typewriter 4s steps(40) 1s forwards',
        'blink': 'blink 1s step-end infinite',
        'float': 'float 6s ease-in-out infinite',
        'shine': 'shine 3s linear infinite',
        'energy-pulse': 'energyPulse 2s ease-in-out infinite',
        'border-flow': 'borderFlow 3s linear infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'counter-tick': 'counterTick 0.1s ease-out',
        'matrix-fall': 'matrixFall 10s linear infinite',
        'shield-pulse': 'shieldPulse 3s ease-in-out infinite',
        'gradient-x': 'gradientX 3s ease infinite',
        'particle-drift': 'particleDrift 20s linear infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%': { opacity: '0.5', transform: 'scale(1)' },
          '100%': { opacity: '1', transform: 'scale(1.05)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        glitch: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' },
        },
        typewriter: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        blink: {
          '50%': { opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)', opacity: '0.3' },
          '25%': { transform: 'translateY(-20px) translateX(10px)', opacity: '0.6' },
          '50%': { transform: 'translateY(-10px) translateX(-5px)', opacity: '0.4' },
          '75%': { transform: 'translateY(-30px) translateX(15px)', opacity: '0.5' },
        },
        shine: {
          '0%': { left: '-100%' },
          '50%, 100%': { left: '100%' },
        },
        energyPulse: {
          '0%, 100%': { opacity: '0.3', transform: 'scaleX(0.8)' },
          '50%': { opacity: '1', transform: 'scaleX(1)' },
        },
        borderFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        counterTick: {
          '0%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        matrixFall: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' },
        },
        shieldPulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' },
          '50%': { filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.9))' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        particleDrift: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(10px, -10px) rotate(90deg)' },
          '50%': { transform: 'translate(0, -20px) rotate(180deg)' },
          '75%': { transform: 'translate(-10px, -10px) rotate(270deg)' },
          '100%': { transform: 'translate(0, 0) rotate(360deg)' },
        },
      },
      backgroundSize: {
        '300%': '300% 300%',
        '200%': '200% 200%',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
};
