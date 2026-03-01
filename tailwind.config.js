/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--color-primary)",
          secondary: "var(--color-secondary)",
          accent: "var(--color-accent)",
          complementary: "var(--color-complementary)",
          dark: "var(--color-dark)",
          light: "var(--color-light)",
          white: "var(--color-white)",
          line: "var(--color-line)",
          danger: "var(--color-danger)",
          warning: "var(--color-warning)",
          cool: "var(--color-cool)",
          success: "var(--color-success)",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
