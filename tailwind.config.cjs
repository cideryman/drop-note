module.exports = {
  content: [
    "./index.html",
    "./recipes.js",
    "./calculator.js",
    "./storage.js",
    "./timer.js",
    "./app.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "#121416",
        "surface-dim": "#121416",
        "surface-container": "#1e2022",
        "surface-container-lowest": "#0d0f10",
        "surface-container-high": "#282a2c",
        "surface-container-highest": "#333537",
        "surface-variant": "#333537",
        primary: "#ffc664",
        "primary-container": "#e5a93b",
        "on-primary": "#432c00",
        "on-surface": "#e2e2e5",
        "on-surface-variant": "#d4c4af",
        tertiary: "#aed2ff",
        error: "#ffb4ab",
        "brew-green": "#00E676",
        "brew-amber": "#E5A93B"
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms")
  ]
};
