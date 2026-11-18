/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07070a',
        panel: '#101018',
        edge: '#1f1f2b',
        brand: '#e11d48',
        gold: '#f5b301',
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(225, 29, 72, 0.55)',
      },
    },
  },
  plugins: [],
};
