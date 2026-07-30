/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  plugins: [
    // RTL Plugin
    function ({ addUtilities }) {
      const newUtilities = {
        ".rtl\\:space-x-reverse > :not([hidden]) ~ :not([hidden])": {
          "--tw-space-x-reverse": "1",
        },
        ".rtl\\:text-right": {
          "text-align": "right",
        },
        ".rtl\\:text-left": {
          "text-align": "left",
        },
        ".rtl\\:float-right": {
          float: "right",
        },
        ".rtl\\:float-left": {
          float: "left",
        },
        ".rtl\\:clear-right": {
          clear: "right",
        },
        ".rtl\\:clear-left": {
          clear: "left",
        },
        '[dir="rtl"] .rtl\\:space-x-reverse > :not([hidden]) ~ :not([hidden])':
          {
            "--tw-space-x-reverse": "1",
          },
        '[dir="rtl"] .rtl\\:text-right': {
          "text-align": "right",
        },
        '[dir="rtl"] .rtl\\:text-left': {
          "text-align": "left",
        },
        '[dir="rtl"] .rtl\\:float-right': {
          float: "right",
        },
        '[dir="rtl"] .rtl\\:float-left': {
          float: "left",
        },
      };
      addUtilities(newUtilities, ["responsive", "hover"]);
    },
  ],
};
