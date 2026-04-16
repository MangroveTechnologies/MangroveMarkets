/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        charcoal: '#0C0F12',
        slate: '#10161B',
        teal: {
          300: '#74C3D5',
          500: '#42A7C6',
        },
        orange: {
          400: '#FF9E18',
          600: '#FF4713',
        },
        glass: 'rgba(255, 255, 255, 0.06)',
        'glass-border': 'rgba(255, 255, 255, 0.12)',
      },
      fontFamily: {
        display: [
          'Outfit Variable',
          'Outfit',
          'system-ui',
          'sans-serif',
        ],
        body: [
          'Source Sans 3 Variable',
          'Source Sans 3',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        glow: '0 12px 30px rgba(66, 167, 198, 0.35)',
        'glow-orange': '0 12px 30px rgba(255, 158, 24, 0.25)',
        panel: '0 20px 60px rgba(0, 0, 0, 0.35)',
        card: '0 30px 60px rgba(0, 0, 0, 0.35)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(1200px 600px at 10% 10%, rgba(116, 195, 213, 0.18), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(255, 158, 24, 0.16), transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'fade-up-delay-1': 'fade-up 0.6s ease-out 0.1s forwards',
        'fade-up-delay-2': 'fade-up 0.6s ease-out 0.2s forwards',
        'fade-up-delay-3': 'fade-up 0.6s ease-out 0.3s forwards',
        'fade-up-delay-4': 'fade-up 0.6s ease-out 0.4s forwards',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
