/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1976d2',
          light: '#4791db',
          dark: '#115293',
        },
        secondary: '#03a9f4',
        success: '#4caf50',
        warning: '#ff9800',
        danger: '#f44336',
        light: {
          bg: '#f5f8fa',
          text: '#ffffff',
        },
        dark: {
          bg: '#263238',
          text: '#333333',
        },
        border: '#e0e0e0',
        black: {
          DEFAULT: '#000000',
          '80': 'rgba(0, 0, 0, 0.8)',
        }
      },
      boxShadow: {
        card: '0 2px 10px rgba(0, 0, 0, 0.1)',
      },
      width: {
        sidebar: '220px',
      },
      height: {
        chart: '400px',
      },
      transitionProperty: {
        common: 'all',
      },
      transitionDuration: {
        common: '300ms',
      }
    },
  },
  plugins: [],
} 