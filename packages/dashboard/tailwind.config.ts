import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF7EB",
        cream2: "#F9F0E0",
        olive: "#A2AB73",
        berry: "#CC3A63",
        ink: "#31291B",
        "ink-muted": "#6B6151",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 4px 14px rgba(49, 41, 27, 0.05)",
        softLg: "0 24px 60px rgba(49, 41, 27, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
