import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // LoadBench Pro palette — calibrated for a safety-first reloading notebook.
        // Cool slate surfaces with a precise amber accent (caution-coded) and
        // saturated red reserved exclusively for safety alerts.
        bg: {
          DEFAULT: '#0E1116',
          surface: '#151A22',
          alt: '#1B212B',
          inset: '#0B0E13',
        },
        border: {
          DEFAULT: '#262E3B',
          strong: '#384354',
        },
        text: {
          DEFAULT: '#E6E8EC',
          muted: '#9BA3AF',
          faint: '#5E6573',
        },
        accent: {
          // Amber — caution/precision, used sparingly for primary actions.
          DEFAULT: '#D89B2C',
          hover: '#B9831F',
          subtle: '#3A2D14',
        },
        danger: {
          DEFAULT: '#D4423E',
          hover: '#B83633',
          subtle: '#3A1614',
        },
        warning: {
          DEFAULT: '#E0A53B',
          subtle: '#332811',
        },
        success: {
          DEFAULT: '#5BA372',
          subtle: '#15291C',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '10px',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '22px' }],
        xl: ['18px', { lineHeight: '24px' }],
      },
    },
  },
  plugins: [],
};

export default config;
