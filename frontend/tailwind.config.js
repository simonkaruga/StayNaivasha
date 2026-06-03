/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        forest: "#0D3D20",
        teal: "#1E8A5A",
        mint: "#3EC890",
        offwhite: "#F5F0E8",
        nearblack: "#0A0F0A",
        gold: "#B8922A",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        ui: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
