import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          950: "#040611",
          900: "#070A1A",
          800: "#0B1027",
          700: "#0F1735",
        },
        surface: {
          950: "rgba(255,255,255,0.03)",
          900: "rgba(255,255,255,0.05)",
          800: "rgba(255,255,255,0.07)",
          700: "rgba(255,255,255,0.09)",
        },
        brand: {
          500: "#6D5EF7",
          400: "#7E73FF",
          300: "#9B92FF"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(125, 116, 255, 0.25), 0 10px 35px rgba(109, 94, 247, 0.15)"
      }
    },
  },
  plugins: [],
} satisfies Config;

