/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        forest:    "#1e4a22",
        teal:      "#186878",
        mint:      "#3ec890",
        amber:     "#d4892a",
        gold:      "#f0b840",
        sky:       "#4a8ec8",
        offwhite:  "#fef6e8",
        nearblack: "#1a1008",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        ui: ["Inter", "sans-serif"],
      },
      keyframes: {
        "lake-shimmer": {
          "0%, 100%": { opacity: "0.5",  transform: "scaleY(1)" },
          "50%":       { opacity: "0.85", transform: "scaleY(1.04)" },
        },
        "star-pulse": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%":       { opacity: "1",    transform: "scale(1.3)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "moon-glow": {
          "0%, 100%": { boxShadow: "0 0 18px rgba(180,240,140,0.35), 0 0 40px rgba(100,200,80,0.15)" },
          "50%":       { boxShadow: "0 0 28px rgba(180,240,140,0.55), 0 0 60px rgba(100,200,80,0.25)" },
        },
        "scroll-cue": {
          "0%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "50%":       { opacity: "0.6",  transform: "translateY(4px)" },
        },
        firefly: {
          "0%, 100%": { opacity: "0",   transform: "translate(0, 0)" },
          "20%":       { opacity: "0.9" },
          "50%":       { opacity: "0.4", transform: "translate(5px, -10px)" },
          "80%":       { opacity: "0.7", transform: "translate(-3px, -5px)" },
        },
        "mpesa-ring": {
          "0%":   { transform: "scale(0.5)", opacity: "0.7" },
          "60%":  { opacity: "0.15" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        aurora: {
          "0%, 100%": { opacity: "0.6", transform: "scaleX(1) translateX(0)" },
          "50%":       { opacity: "1",   transform: "scaleX(1.06) translateX(6px)" },
        },
      },
      animation: {
        "lake-shimmer": "lake-shimmer 4s ease-in-out infinite",
        "star-pulse":   "star-pulse 2.5s ease-in-out infinite",
        "fade-up":      "fade-up 0.5s ease-out both",
        "moon-glow":    "moon-glow 3s ease-in-out infinite",
        "scroll-cue":   "scroll-cue 2s ease-in-out infinite",
        firefly:        "firefly 4s ease-in-out infinite",
        "mpesa-ring":   "mpesa-ring 1.2s ease-out infinite",
        aurora:         "aurora 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
