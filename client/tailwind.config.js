/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brandeis: {
          blue: '#003478',
          gold: '#FFB81C'
        }
      }
    },
  },
  plugins: [],
}
