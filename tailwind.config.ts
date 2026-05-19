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
        },
        nudgeShake: {
          "0%,100%": { transform: "translate(0,0)" },
          "10%": { transform: "translate(-8px,0)" },
          "20%": { transform: "translate(8px,0)" },
          "30%": { transform: "translate(-6px,0)" },
          "40%": { transform: "translate(4px,0)" },
          "50%": { transform: "translate(-4px,0)" },
          "60%": { transform: "translate(3px,0)" },
          "70%": { transform: "translate(-2px,0)" },
          "80%": { transform: "translate(2px,0)" }
        },
        nudgePulse: {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(8)", opacity: "0" }
        }
      },
      animation: {
        pulseDot: "pulseDot 1.8s ease-in-out infinite",
        rise: "rise 220ms ease-out both",
        shimmer: "shimmer 6s linear infinite",
        nudgeShake: "nudgeShake 480ms ease-in-out 1",
        nudgePulse: "nudgePulse 600ms ease-out 1 forwards"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
