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
    extend: {
      gridTemplateColumns: {
        downloads: "minmax(0px, 50px) 3fr 1fr 2fr 1fr",
      },
    },
  },
  plugins: [require("daisyui")],
};
