module.exports = {
  content: [
    "./index.html",
    "./recipes.js",
    "./calculator.js",
    "./storage.js",
    "./history.js",
    "./timer.js",
    "./theme.js",
    "./app.js"
  ],
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--color-surface-dim) / <alpha-value>)",
        "surface-container": "rgb(var(--color-surface-container) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--color-surface-container-lowest) / <alpha-value>)",
        "surface-container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--color-surface-container-highest) / <alpha-value>)",
        "surface-variant": "rgb(var(--color-surface-variant) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--color-primary-container) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
        tertiary: "rgb(var(--color-tertiary) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
        "brew-green": "rgb(var(--color-brew-green) / <alpha-value>)",
        "brew-amber": "rgb(var(--color-brew-amber) / <alpha-value>)",
        outline: "rgb(var(--color-outline) / <alpha-value>)",
        scrim: "rgb(var(--color-scrim) / <alpha-value>)"
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
