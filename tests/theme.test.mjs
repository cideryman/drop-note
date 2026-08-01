import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const themeSource = fs.readFileSync(new URL("../theme.js", import.meta.url), "utf8");
const sourceCss = fs.readFileSync(new URL("../styles.input.css", import.meta.url), "utf8");

function createButton(preference) {
  const listeners = new Map();
  const button = {
    dataset: { themePreference: preference },
    attributes: {},
    active: false,
    addEventListener(type, listener) { listeners.set(type, listener); },
    click() { listeners.get("click")?.(); },
    setAttribute(name, value) { this.attributes[name] = value; },
    classList: { toggle(_name, enabled) { button.active = enabled; } }
  };
  return button;
}

const buttons = ["system", "light", "dark"].map(createButton);
const themeColorMeta = { content: "", setAttribute(_name, value) { this.content = value; } };
const statusBarMeta = { content: "", setAttribute(_name, value) { this.content = value; } };
const documentElement = { dataset: {}, style: {} };
const mediaListeners = new Map();
const mediaQuery = {
  matches: false,
  addEventListener(type, listener) { mediaListeners.set(type, listener); }
};
const stored = new Map();
const localStorage = {
  getItem(key) { return stored.get(key) ?? null; },
  setItem(key, value) { stored.set(key, value); }
};
const document = {
  documentElement,
  querySelector(selector) {
    if (selector === 'meta[name="theme-color"]') return themeColorMeta;
    if (selector === 'meta[name="apple-mobile-web-app-status-bar-style"]') return statusBarMeta;
    return null;
  },
  querySelectorAll(selector) {
    return selector === "[data-theme-preference]" ? buttons : [];
  }
};
const context = vm.createContext({
  window: { matchMedia() { return mediaQuery; } },
  document,
  localStorage,
  console: { ...console, warn() {} }
});

vm.runInContext(themeSource, context);

assert.equal(vm.runInContext('normalizeThemePreference("sepia")', context), "system");
assert.equal(vm.runInContext('resolveTheme("system", false)', context), "light");
assert.equal(vm.runInContext('resolveTheme("system", true)', context), "dark");
assert.equal(vm.runInContext('resolveTheme("dark", false)', context), "dark");

vm.runInContext("initializeTheme()", context);
assert.equal(documentElement.dataset.theme, "light");
assert.equal(documentElement.style.colorScheme, "light");
assert.equal(themeColorMeta.content, "#F7F2E8");
assert.equal(statusBarMeta.content, "default");
assert.equal(buttons[0].attributes["aria-pressed"], "true");

buttons[2].click();
assert.equal(stored.get("DRIP_NOTE_THEME"), "dark");
assert.equal(documentElement.dataset.theme, "dark");
assert.equal(themeColorMeta.content, "#111315");
assert.equal(statusBarMeta.content, "black-translucent");
assert.equal(buttons[2].active, true);

mediaListeners.get("change")({ matches: false });
assert.equal(documentElement.dataset.theme, "dark", "수동 선택 중에는 시스템 변경을 무시해야 합니다.");

buttons[0].click();
mediaListeners.get("change")({ matches: true });
assert.equal(documentElement.dataset.theme, "dark", "시스템 선택 중에는 운영체제 변경을 반영해야 합니다.");

context.brokenStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); }
};
assert.equal(vm.runInContext("loadThemePreference(brokenStorage)", context), "system");
assert.equal(vm.runInContext('saveThemePreference("light", brokenStorage)', context), false);

function getLightThemeBlock() {
  const marker = 'html[data-theme="light"] {';
  const start = sourceCss.indexOf(marker);
  const end = sourceCss.indexOf("\n  }", start);
  assert.ok(start >= 0 && end > start, "라이트 테마 색상 블록이 필요합니다.");
  return sourceCss.slice(start, end);
}

function parseRgbVariable(block, name) {
  const value = block.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`));
  assert.ok(value, `--${name} 색상 토큰이 필요합니다.`);
  return value.slice(1).map(Number);
}

function relativeLuminance(rgb) {
  const channels = rgb.map(value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
  const firstLum = relativeLuminance(first);
  const secondLum = relativeLuminance(second);
  return (Math.max(firstLum, secondLum) + 0.05) / (Math.min(firstLum, secondLum) + 0.05);
}

const lightBlock = getLightThemeBlock();
const lightBackground = parseRgbVariable(lightBlock, "color-app-background");
for (const token of [
  "color-on-surface",
  "color-on-surface-variant",
  "color-primary",
  "color-tertiary",
  "color-error",
  "color-brew-green",
  "color-temperature-low",
  "color-temperature-medium",
  "color-temperature-warm",
  "color-temperature-high"
]) {
  assert.ok(
    contrastRatio(parseRgbVariable(lightBlock, token), lightBackground) >= 4.5,
    `${token}은 라이트 배경에서 WCAG AA 대비를 만족해야 합니다.`
  );
}

console.log("시스템·라이트·다크 테마 저장·동기화·대비 검증 완료");
