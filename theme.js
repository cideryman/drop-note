"use strict";

// Theme preference, runtime application, and system color-scheme synchronization.
const THEME_STORAGE_KEY = "DRIP_NOTE_THEME";
const THEME_PREFERENCES = Object.freeze(["system", "light", "dark"]);
const THEME_COLORS = Object.freeze({
  dark: "#111315",
  light: "#F7F2E8"
});

let currentThemePreference = "system";
let themeMediaQuery = null;

function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : "system";
}

function loadThemePreference(storage = localStorage) {
  try {
    return normalizeThemePreference(storage.getItem(THEME_STORAGE_KEY));
  } catch (error) {
    console.warn("테마 설정을 불러오지 못해 시스템 설정을 사용합니다:", error);
    return "system";
  }
}

function saveThemePreference(preference, storage = localStorage) {
  try {
    storage.setItem(THEME_STORAGE_KEY, normalizeThemePreference(preference));
    return true;
  } catch (error) {
    console.warn("테마 설정을 저장하지 못했습니다:", error);
    return false;
  }
}

function resolveTheme(preference, systemPrefersDark = false) {
  const normalized = normalizeThemePreference(preference);
  if (normalized === "system") return systemPrefersDark ? "dark" : "light";
  return normalized;
}

function getThemeMediaQuery() {
  if (themeMediaQuery) return themeMediaQuery;
  if (typeof window.matchMedia !== "function") return null;
  themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  return themeMediaQuery;
}

function updateThemeControls(preference) {
  for (const button of document.querySelectorAll?.("[data-theme-preference]") || []) {
    const isSelected = button.dataset.themePreference === preference;
    button.setAttribute("aria-pressed", String(isSelected));
    button.classList.toggle("theme-option-active", isSelected);
  }
}

function applyResolvedTheme(resolvedTheme) {
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColorMeta = document.querySelector?.('meta[name="theme-color"]');
  themeColorMeta?.setAttribute("content", THEME_COLORS[theme]);

  const statusBarMeta = document.querySelector?.('meta[name="apple-mobile-web-app-status-bar-style"]');
  statusBarMeta?.setAttribute("content", theme === "dark" ? "black-translucent" : "default");
  return theme;
}

function applyThemePreference(preference, options = {}) {
  const normalized = normalizeThemePreference(preference);
  currentThemePreference = normalized;
  if (options.persist) saveThemePreference(normalized);

  const mediaQuery = getThemeMediaQuery();
  const resolved = resolveTheme(normalized, Boolean(mediaQuery?.matches));
  applyResolvedTheme(resolved);
  updateThemeControls(normalized);
  return resolved;
}

function handleSystemThemeChange(event) {
  if (currentThemePreference !== "system") return false;
  applyResolvedTheme(event.matches ? "dark" : "light");
  return true;
}

function bindThemeEvents() {
  for (const button of document.querySelectorAll?.("[data-theme-preference]") || []) {
    button.addEventListener("click", () => {
      applyThemePreference(button.dataset.themePreference, { persist: true });
    });
  }

  const mediaQuery = getThemeMediaQuery();
  if (typeof mediaQuery?.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleSystemThemeChange);
  } else if (typeof mediaQuery?.addListener === "function") {
    mediaQuery.addListener(handleSystemThemeChange);
  }
}

function initializeTheme() {
  currentThemePreference = loadThemePreference();
  applyThemePreference(currentThemePreference);
  bindThemeEvents();
}
