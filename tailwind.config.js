/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',      // Small phones
        'sm': '640px',      // Large phones
        'md': '768px',      // Tablets (portrait)
        'lg': '1024px',     // Tablets (landscape) / Small laptops
        'xl': '1280px',     // Laptops
        '2xl': '1536px',    // Large laptops / Desktops
        // Custom breakpoints
        'mobile': {'max': '767px'},      // Mobile only
        'tablet': {'min': '768px', 'max': '1023px'},  // Tablet only
        'desktop': {'min': '1024px'},    // Desktop only
      },
      colors: {
        navy: {
          50: '#e0e7ff',
          100: '#c7d2fe',
          200: '#a5b4fc',
          300: '#818cf8',
          400: '#6366f1',
          500: '#4f46e5',
          600: '#1e3a8a',
          700: '#1e40af',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        sea: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
}
