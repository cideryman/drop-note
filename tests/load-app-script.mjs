import fs from "node:fs";

export const APP_SCRIPT_FILES = [
  "recipes.js",
  "calculator.js",
  "storage.js",
  "timer.js",
  "app.js"
];

export function loadAppScript() {
  return APP_SCRIPT_FILES
    .map(filename => fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"))
    .join("\n");
}
