/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["2.5rem", { lineHeight: "1.1", fontWeight: "700" }],
        "display-md": ["2rem", { lineHeight: "1.15", fontWeight: "600" }],
        "display-sm": ["1.5rem", { lineHeight: "1.2", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
}
