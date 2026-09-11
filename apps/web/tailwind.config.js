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
          bg: '#d9d0bf',    // wall — canvas/page backdrop (hearth body #d9d0bf)
          card: '#fbf8f1',  // cream — every card surface (hearth --cream)
          wall: '#d9d0bf',  // wall — mid-tone surface on cream
          dark: '#292820',  // legacy key, synced to ink
          ink: '#292820',   // ink (hearth --ink)
          muted: '#777468', // muted (hearth --muted)
        },
        rust: {
          DEFAULT: '#c96f4c', // hearth --rust
          light: '#d8896a',   // derived tint
          dark: '#a9573b',    // hearth .note.rust
        },
        sage: {
          DEFAULT: '#899b87', // hearth --sage
          light: '#a2b1a0',   // derived tint
          dark: '#6d7d6b',    // derived shade
        },
        blue: {               // renamed from inkblue → hearth --blue
          DEFAULT: '#7893a2',
          light: '#91aab7',   // derived tint
          dark: '#3f606c',    // hearth .note.blue
        },
      },
      fontFamily: {
        serif: ['"LXGW WenKai"', 'KaiTi', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
        hand: ['Caveat', 'cursive'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(45, 38, 28, 0.13)', // hearth .toolbar — resting surfaces
        halo: '0 14px 40px rgba(45, 38, 28, 0.18)', // hearth .compose — floating panels
        deep: '0 22px 50px rgba(35, 28, 20, 0.32)', // hearth drag shadow — hover/drag lift
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
}
