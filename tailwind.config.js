/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--text)',
        muted: 'var(--muted)',
        hairline: 'var(--border)',
        surface: 'var(--surface)',
        brand: {
          amber: 'var(--amber)',
          violet: 'var(--violet)',
          mint: 'var(--positive)',
          danger: 'var(--danger)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      boxShadow: {
        glow: '0 0 0 1px var(--border), 0 18px 50px -20px var(--glow)',
        'glow-strong': '0 0 0 1px var(--border-strong), 0 24px 70px -18px var(--glow)'
      },
      borderRadius: {
        '2.5xl': '1.25rem',
        '3xl': '1.75rem'
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' }
        },
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' }
        }
      },
      animation: {
        shimmer: 'shimmer 3s infinite',
        'pulse-ring': 'pulseRing 2.4s ease-out infinite'
      }
    }
  },
  plugins: []
}
