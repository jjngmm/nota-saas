/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nota-ink': '#0D1117',
        'nota-cream': '#F7F5F0',
        'nota-forest': '#1B3A2A',
        'nota-forest-mid': '#2D5A3D',
        'nota-light': '#BFBCB4',
        'nota-warm': '#E8E3D8',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}