import assert from "node:assert/strict";
import vm from "node:vm";
import { loadAppScript } from "./load-app-script.mjs";

const elements = new Map();
const storage = new Map();

function createElement() {
  const classes = new Set();
  const element = {
    value: "",
    textContent: "",
    innerHTML: "",
    className: "",
    dataset: {},
    style: { setProperty(name, value) { this[name] = value; } },
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, force) {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
      },
      contains(name) { return classes.has(name); }
    },
    children: [],
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    setAttribute(name, value) { this[name] = String(value); },
    removeAttribute(name) { delete this[name]; },
    querySelector() { return createElement(); },
    focus() {},
    remove() {}
  };
  return element;
}

const documentStub = {
  body: createElement(),
  visibilityState: "visible",
  addEventListener() {},
  createElement,
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  }
};

class AudioContextStub {
  state = "running";
  currentTime = 0;
  destination = {};
  resume() { return Promise.resolve(); }
  createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} } }; }
  createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
}

const context = vm.createContext({
  window: { AudioContext: AudioContextStub },
  document: documentStub,
  navigator: {},
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); }
  },
    console: { ...console, warn() {} },
  alert() {},
  confirm() { return true; },
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() { return 1; },
  clearInterval() {},
  Date,
  Math,
  JSON,
  Intl,
  Set,
  Map
});
vm.runInContext(loadAppScript(), context);

context.baseRecord = {
  id: "brew_a",
  completedAt: "2026-08-02T10:00:00.000Z",
  recipeId: "kasuya_46",
  recipeName: "테츠 카스야 · 4:6",
  equipment: "V60",
  mode: "hot",
  beanWeight: 20,
  hotWater: 300,
  iceWeight: 0,
  plannedTimeSec: 210,
  temperatures: [92]
};

assert.equal(vm.runInContext("sanitizeBrewRecord({})", context), null);
assert.equal(vm.runInContext("sanitizeBrewHistory('broken').length", context), 0);

context.manyRecords = Array.from({ length: 110 }, (_, index) => ({
  ...context.baseRecord,
  id: `brew_${index}`,
  completedAt: new Date(Date.UTC(2026, 7, 2, 10, index)).toISOString()
}));
assert.equal(vm.runInContext("sanitizeBrewHistory(manyRecords).length", context), 100);

assert.match(
  vm.runInContext("getTasteSuggestion({ acidity: 'high', bitterness: 'low', strength: 'light', c40Clicks: 24 }).text", context),
  /22–23클릭/
);
assert.match(
  vm.runInContext("getTasteSuggestion({ acidity: 'low', bitterness: 'high', strength: 'strong', c40Clicks: 24 }).text", context),
  /25–26클릭/
);
assert.match(
  vm.runInContext("getTasteSuggestion({ acidity: 'high', bitterness: 'high', strength: 'balanced' }).text", context),
  /엇갈립니다/
);

context.backupV2 = {
  format: "drop-note-recipes",
  version: 2,
  recipes: [],
  brewHistory: [context.baseRecord],
  recipePreferences: { favoriteRecipeIds: ["kasuya_46"], recentRecipeIds: ["kasuya_46"] }
};
const parsedBundle = vm.runInContext("parseBackupBundle(backupV2)", context);
assert.equal(parsedBundle.recipes.length, 0);
assert.equal(parsedBundle.brewHistory.length, 1);
assert.deepEqual([...parsedBundle.recipePreferences.favoriteRecipeIds], ["kasuya_46"]);

vm.runInContext(`
  allRecipes = DEFAULT_RECIPES.map(normalizeRecipeTimeline);
  currentRecipe = allRecipes[0];
  brewHistory = [];
  favoriteRecipeIds = [];
  recentRecipeIds = [];
  mergeImportedBrewData(backupV2, new Map());
`, context);
assert.equal(vm.runInContext("brewHistory.length", context), 1);
assert.deepEqual(JSON.parse(storage.get("DRIP_NOTE_FAVORITES")), ["kasuya_46"]);

vm.runInContext(`
  currentBeanWeight = 20;
  isIceMode = false;
  scaledTotalWater = 300;
  scaledIceWeight = 0;
  scaledStages = currentRecipe.stages.map((stage, index) => ({ ...stage, scaledWater: stage.water, cumulativeTarget: (index + 1) * 60 }));
  createBrewHistoryRecord();
`, context);
assert.equal(vm.runInContext("brewHistory.length", context), 2);
assert.equal(JSON.parse(storage.get("DRIP_NOTE_BREW_HISTORY")).length, 2);

storage.set("DRIP_NOTE_BREW_HISTORY", "{broken");
vm.runInContext("loadUserBrewData()", context);
assert.equal(vm.runInContext("brewHistory.length", context), 0, "손상된 기록 저장값은 빈 목록으로 복구해야 합니다.");

console.log("추출 기록·맛 조언·즐겨찾기·백업 v2 검증 완료");
