/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          500: '#1e3a5f',
          600: '#162d4a',
          700: '#0f2035',
        },
      },
    },
  },
  plugins: [],
};
