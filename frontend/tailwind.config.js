/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens driven by CSS variables so the same utility
        // classes work in both themes. navy-* names kept for backward compat.
        navy: {
          950: "var(--surface-0)",
          900: "var(--surface-1)",
          800: "var(--surface-2)",
          700: "var(--surface-3)",
          600: "var(--surface-4)",
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
