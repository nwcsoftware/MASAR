import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Maps design/tokens.css → Tailwind theme. See docs/DESIGN.md §3.
// Colours are ONLY ever referenced through these tokens — no hex in components.
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          DEFAULT: 'var(--brand-500)',
        },
        cat: {
          routine: 'var(--cat-routine)',
          airport: 'var(--cat-airport)',
          delivery: 'var(--cat-delivery)',
          escort: 'var(--cat-escort)',
        },
        status: {
          draft: 'var(--status-draft)',
          scheduled: 'var(--status-scheduled)',
          assigned: 'var(--status-assigned)',
          acknowledged: 'var(--status-acknowledged)',
          'en-route': 'var(--status-en-route)',
          'in-progress': 'var(--status-in-progress)',
          delayed: 'var(--status-delayed)',
          completed: 'var(--status-completed)',
          cancelled: 'var(--status-cancelled)',
          'no-show': 'var(--status-no-show)',
        },
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        fg: {
          DEFAULT: 'var(--text)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          'on-brand': 'var(--text-on-brand)',
        },
        overlay: 'var(--overlay)',
        ring: 'var(--ring)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        // Text-safe variants: amber/green/orange on white fall below 4.5:1, so text mixes
        // the token toward --text (darker in light mode, lighter in dark). DESIGN.md §8.
        'warning-fg': 'color-mix(in srgb, var(--warning) 62%, var(--text))',
        'success-fg': 'color-mix(in srgb, var(--success) 72%, var(--text))',
        'delayed-fg': 'color-mix(in srgb, var(--status-delayed) 70%, var(--text))',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        arabic: ['var(--font-arabic)'],
        mono: ['var(--font-mono)'],
      },
      // docs/DESIGN.md §2.2 — 12 / 14 / 16 / 18 / 22 / 28 / 36
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: 'var(--leading-normal)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-normal)' }],
        base: ['var(--text-md)', { lineHeight: 'var(--leading-normal)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-normal)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-tight)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      // docs/DESIGN.md §4 layout shells
      spacing: {
        sidebar: 'var(--sidebar-w)',
        'sidebar-collapsed': 'var(--sidebar-w-collapsed)',
        topbar: 'var(--topbar-h)',
        touch: 'var(--touch-target)',
      },
      maxWidth: {
        content: 'var(--content-max)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease)',
        ease: 'var(--ease)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        DEFAULT: 'var(--dur-base)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.6s var(--ease) infinite',
      },
    },
  },
  // NOTE: docs/DESIGN.md §3 originally listed `tailwindcss-rtl`. It is
  // deliberately omitted: Tailwind 3.4 emits every logical utility natively
  // (ms/me/ps/pe → margin|padding-inline-*, start/end → inset-inline-*,
  // rounded-s/e → border-*-*-radius, float-start/end, border-s/e, text-start/end)
  // plus the rtl:/ltr: variants. The plugin overrode those with weaker
  // :lang()/[dir] duplicates keyed off <html lang>, tripling the CSS.
  plugins: [animate],
} satisfies Config;
