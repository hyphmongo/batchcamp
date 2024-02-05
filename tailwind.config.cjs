/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./src/tab/index.html",
    "./src/tab/**/*.tsx",
    "./src/popup/index.html",
    "./src/popup/**/*.tsx",
    "./src/content/**/*.ts",
    "./src/shared/**/*.tsx",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        downloads: "minmax(0px, 30px) 4fr 1fr 2fr 1fr",
      },
    },
  },
  plugins: [require("daisyui")],
};
