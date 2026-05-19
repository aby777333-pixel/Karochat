import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0A0A0A",
          800: "#121214",
          700: "#1A1A1A",
          600: "#222226"
        },
        neon: {
          blue: "#00B4FF",
          red: "#FF2D55",
          mint: "#19E5C1",
          amber: "#FFB020",
          purple: "#A371FF"
        }
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      backdropBlur: {
        glass: "24px"
      },
      boxShadow: {
        "glow-blue": "0 0 32px rgba(0,180,255,0.28)",
        "glow-red": "0 0 32px rgba(255,45,85,0.32)"
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.4)", opacity: "0.6" }
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        pulseDot: "pulseDot 1.8s ease-in-out infinite",
        rise: "rise 220ms ease-out both",
        shimmer: "shimmer 6s linear infinite"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
