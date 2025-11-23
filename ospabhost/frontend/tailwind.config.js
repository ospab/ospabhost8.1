/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ospab-primary': '#2563EB', // Более тёмный синий (blue-600) для лучшего контраста
        'ospab-accent': '#DB2777',  // Более тёмный розовый (pink-600) для лучшего контраста
      },
      fontFamily: {
        mono: ['Share Tech Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}