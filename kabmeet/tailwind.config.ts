/**
 * Kabmeet shared Tailwind CSS configuration.
 *
 * Color palette sourced from the IndabaX / KAB AI design system.
 * Theme-aware semantic tokens reference CSS custom properties in
 * `apps/web/src/styles/tokens.css` so light and dark modes switch cleanly.
 */
const config = {
  darkMode: 'class',
  content: [
    './apps/web/src/**/*.{ts,tsx,mdx}',
    './packages/shared/src/**/*.{ts,tsx}',
    './packages/video/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand & palette tokens (Kabmeet Design System)
        'indaba-deep-green': '#065A4B',
        'signal-green': '#00E676',
        'kab-blue': '#0072BB',
        'sun-yellow': '#F5EC1E',
        'amber-gold': '#F6A623',
        'live-red': '#E5484D',
        'night-forest': '#0A1F1A',
        mist: '#F2F7F5',
        'line-green-gray': '#D5E3DE',

        // Semantic theme tokens backed by CSS variables
        background: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        'surface-elevated': 'var(--bg-surface-elevated)',
        foreground: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        border: 'var(--border-subtle)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-secondary-foreground)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          foreground: 'var(--color-info-foreground)',
        },
        highlight: {
          DEFAULT: 'var(--color-highlight)',
          foreground: 'var(--color-highlight-foreground)',
        },
        warning: 'var(--color-warning)',
        live: 'var(--color-live)',
      },
      fontFamily: {
        display: ['var(--font-oswald)', 'Oswald', 'sans-serif'],
        sans: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(10, 31, 26, 0.08)',
        'card-dark': '0 8px 28px -4px rgba(0, 0, 0, 0.45)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '250ms',
      },
    },
  },
  plugins: [],
};

export default config;
