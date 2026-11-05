/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212f",
        muted: "#778394",
        canvas: "#f7f8fa",
        brand: "#246b5e",
        "brand-dark": "#1a5147",
      },
      boxShadow: {
        card: "0 8px 30px rgba(27, 44, 60, 0.06)",
      },
    },
  },
  plugins: [],
};
