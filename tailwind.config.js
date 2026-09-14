/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bgBase: '#0a0f18',
        cardBg: 'rgba(18, 26, 43, 0.75)',
        cardBorder: 'rgba(255, 255, 255, 0.12)',
        terminalBg: '#070c14',
        accentEmerald: '#10b981',
        accentCyan: '#06b6d4',
        accentBlue: '#3b82f6',
        accentRose: '#f43f5e',
        accentAmber: '#f59e0b',
        accentPurple: '#a855f7',
      },
      boxShadow: {
        'glow-emerald': '0 0 50px -10px rgba(16, 185, 129, 0.25)',
        'glow-hover': '0 28px 50px -12px rgba(0, 0, 0, 0.6), 0 0 65px -8px rgba(16, 185, 129, 0.35)',
      },
      animation: {
        'aurora-float': 'floatMotion 20s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        floatMotion: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(35px, -30px) scale(1.06)' },
          '100%': { transform: 'translate(-30px, 35px) scale(0.96)' },
        },
      },
    },
  },
  plugins: [],
}
