/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0a0e1a",
          900: "#0f1424",
          800: "#161c30",
          700: "#1e2740",
          600: "#2a3556",
        },
        accent: {
          DEFAULT: "#4f8cff",
          soft: "#8bb4ff",
        },
        up: "#1fae63",
        down: "#e5544b",
      },
      fontFamily: {
        sans: ["Geist", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'Geist Mono'", "ui-monospace", "'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
