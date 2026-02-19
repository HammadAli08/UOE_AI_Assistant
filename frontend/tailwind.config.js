/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /* ── Colour system: dark cinematic palette ── */
      colors: {
        navy: {
          950: '#070B14',
          900: '#0B1120',
          800: '#0F1623',
          700: '#151D2E',
          600: '#1A2438',
          500: '#243044',
          400: '#2E3C52',
        },
        mustard: {
          50:  '#FEF9E7',
          100: '#FCF0C3',
          200: '#F8E08A',
          300: '#F0CC4E',
          400: '#D6C85C',
          500: '#C8B94A',
          600: '#A89B3D',
          700: '#867B31',
          800: '#655C25',
          900: '#443D19',
        },
        olive: {
          50:  '#F4F5EC',
          100: '#E5E8D0',
          200: '#CDD3A8',
          300: '#B0B97A',
          400: '#9CA356',
          500: '#8B9340',
          600: '#6E7534',
          700: '#535828',
        },
        cream: '#E8E4DC',
        ash:   '#8A95A8',
        mist:  '#556074',
      },
      /* ── Typography ── */
      fontFamily: {
        display: ['Oswald', 'Impact', 'Arial Narrow', 'sans-serif'],
        body:    ['Merriweather', 'Georgia', 'Cambria', 'serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs':  ['0.625rem', { lineHeight: '0.875rem' }],
        'hero': ['clamp(2.8rem, 8vw, 6.5rem)', { lineHeight: '0.92', letterSpacing: '-0.02em' }],
      },
      /* ── Animations ── */
      animation: {
        'fade-in':      'fadeIn 0.4s ease-out both',
        'slide-up':     'slideUp 0.4s ease-out both',
        'slide-down':   'slideDown 0.3s ease-out both',
        'glow-pulse':   'glowPulse 4s ease-in-out infinite',
        'float':        'float 6s ease-in-out infinite',
        'pulse-dot':    'pulseDot 1.4s infinite ease-in-out both',
        'smart-on':     'smartOn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'marquee':      'marquee 30s linear infinite',
        'marquee-reverse': 'marquee 30s linear infinite reverse',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: { '0%,100%': { opacity: '0.4' }, '50%': { opacity: '0.85' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        pulseDot:  { '0%,80%,100%': { transform: 'scale(0)' }, '40%': { transform: 'scale(1)' } },
        smartOn:   { '0%': { transform: 'scale(0.85)' }, '60%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
        marquee:   { '0%': { transform: 'translateX(0%)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      /* ── Shadows ── */
      boxShadow: {
        glass:    '0 4px 30px rgba(0,0,0,0.35)',
        glow:     '0 0 50px rgba(200,185,74,0.18)',
        'glow-sm':'0 0 24px rgba(200,185,74,0.10)',
        elevated: '0 8px 40px rgba(0,0,0,0.45)',
      },
      /* ── Misc ── */
      spacing: { 18: '4.5rem', 88: '22rem' },
      screens: { xs: '475px' },
      borderWidth: { '0.5': '0.5px' },
    },
  },
  plugins: [],
};
