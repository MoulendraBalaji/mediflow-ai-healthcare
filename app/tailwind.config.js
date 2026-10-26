/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx}', './src/components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F4EE',
        surface: '#FFFFFF',
        ink: '#191E25',
        'ink-soft': '#58616D',
        'ink-faint': '#7C848E',
        rule: '#DDD7CA',
        'rule-strong': '#C4BCAB',
        pine: {
          DEFAULT: '#1E5A47',
          dark: '#154234',
          light: '#E6EEE8',
        },
        clay: {
          DEFAULT: '#A9502B',
          light: '#F6E8E0',
        },
        ochre: {
          DEFAULT: '#96701B',
          light: '#F5EEDC',
        },
        crimson: {
          DEFAULT: '#9B2C2C',
          light: '#F7E3E1',
        },
        sky: {
          DEFAULT: '#2A5A7A',
          light: '#E4EDF3',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
        display: ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-sm': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
      },
      borderRadius: {
        none: '0px',
        xs: '2px',
        sm: '3px',
        DEFAULT: '4px',
      },
      maxWidth: {
        prose: '68ch',
        shell: '76rem',
      },
      spacing: {
        section: '5.5rem',
      },
      boxShadow: {
        none: 'none',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
