import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f7f8',
          100: '#e3ebef',
          200: '#c5d5dd',
          700: '#334155',
          900: '#0f1c24',
          950: '#0a1419',
        },
        accent: {
          600: '#0f6b5c',
          700: '#0b5448',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
