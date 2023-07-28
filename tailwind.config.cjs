/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./src/tab/index.html",
    "./src/tab/**/*.tsx",
    "./src/content/**/*.ts",
    "./src/popup/index.html",
    "./src/popup/**/*.tsx",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
};
