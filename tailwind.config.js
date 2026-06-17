/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#101542',
        secondary: '#2E6DA4',
        background: '#F0F4F8',
        // Paleta oficial de marca PropHero (brand guidelines v1.0)
        space: '#121644',  // Space Blue (navy)
        ocean: '#009CDF',  // Ocean Blue (azul líder de marca)
        sky: '#A5D7FC',    // Sky Blue
        sand: '#E8E2DC',   // Sand (neutro cálido)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

