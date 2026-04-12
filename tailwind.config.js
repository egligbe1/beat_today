/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
    colors: {
        'bg-primary': '#030303',
        'bg-surface': '#0a0a0a',
        'bg-elevated': '#111111',
        'accent-orange': '#FF5500',
        'accent-gold': '#FFB000',
        'accent-green': '#00E676',
        'text-primary': '#FFFFFF',
        'text-muted': '#888888',
        'border-subtle': '#1F1F1F',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
