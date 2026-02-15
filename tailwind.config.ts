import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gg: {
          bg: '#060318',
          surface: '#0f0b2e',
          card: '#1a1548',
          border: '#2a2560',
          accent: '#D4A843',
          'accent-light': '#E5C06E',
          rust: '#C0362C',
          'rust-light': '#D4564C',
          gold: '#D4A843',
          'gold-light': '#E5C06E',
          text: '#e8e5f5',
          secondary: '#9b97b8',
          muted: '#6b6890',
        },
      },
      boxShadow: {
        'gg-glow': '0 0 30px rgba(212, 168, 67, 0.15)',
      },
      borderRadius: {
        gg: '16px',
      },
    },
  },
  plugins: [],
}

export default config
