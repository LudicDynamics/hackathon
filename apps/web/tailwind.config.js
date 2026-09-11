/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: '#d9d0bf',
          card: '#FFFEF6',
          wall: '#F0EADB',
          dark: '#2B2117',
          ink: '#3D2E1E',
          muted: '#8C7E6D',
        },
        rust: {
          DEFAULT: '#A8362B',
          light: '#C74A3D',
          dark: '#872B22',
        },
        sage: {
          DEFAULT: '#5C6B57',
          light: '#72856C',
          dark: '#465342',
        },
        inkblue: {
          DEFAULT: '#49626A',
          light: '#5E7B84',
          dark: '#35484E',
        },
      },
      fontFamily: {
        serif: ['"LXGW WenKai"', 'KaiTi', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
        hand: ['Caveat', 'cursive'],
      },
      boxShadow: {
        soft: '0 10px 30px -5px rgba(43, 33, 23, 0.12), 0 4px 10px -2px rgba(43, 33, 23, 0.06)',
        halo: '0 0 25px rgba(255, 254, 246, 0.8), 0 12px 35px rgba(43, 33, 23, 0.15)',
        deep: '0 20px 45px -10px rgba(43, 33, 23, 0.25)',
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
}
