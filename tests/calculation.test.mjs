import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const appScript = scripts.at(-1)?.[1];

assert.ok(appScript?.includes("const DEFAULT_RECIPES"), "애플리케이션 스크립트를 찾을 수 있어야 합니다.");

const elements = new Map();
const createElement = () => ({
  value: "",
  textContent: "",
  innerHTML: "",
  className: "",
  style: {},
  classList: {
    add() {},
    remove() {}
  },
  addEventListener() {},
  appendChild() {},
  remove() {},
  setAttribute() {},
  removeAttribute() {},
  querySelector() { return createElement(); }
});

const documentStub = {
  addEventListener() {},
  createElement,
  body: createElement(),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  }
};

class AudioContextStub {
  state = "running";
  currentTime = 0;
  destination = {};
  resume() {}
  createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} } }; }
  createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
}

const context = vm.createContext({
  window: { AudioContext: AudioContextStub },
  document: documentStub,
  navigator: {},
  localStorage: { getItem() { return null; }, setItem() {} },
  console,
  alert() {},
  confirm() { return true; },
  setInterval() { return 1; },
  clearInterval() {},
  Date,
  Math,
  JSON
});

vm.runInContext(appScript, context);

function calculate(recipeId, beanWeight, iceMode) {
  const result = vm.runInContext(`
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === ${JSON.stringify(recipeId)});
    currentBeanWeight = ${beanWeight};
    isIceMode = ${iceMode};
    updateHotIceButtons();
    calculateAndRender();
    ({
      totalWater: scaledTotalWater,
      iceWeight: scaledIceWeight,
      finalWater: scaledFinalWater,
      lastTarget: scaledStages.at(-1).cumulativeTarget,
      ratioLabel: document.getElementById("ratio-badge").textContent,
      totalLabel: document.getElementById("total-water-display").textContent,
      finalLabel: document.getElementById("final-yield-display").textContent,
      variantBadge: document.getElementById("recipe-variant-badge").textContent,
      modeDescription: document.getElementById("brew-mode-description").textContent,
      hotDisabled: document.getElementById("btn-type-hot").disabled,
      stepListHtml: document.getElementById("step-list-container").innerHTML
    });
  `, context);
  return JSON.parse(JSON.stringify(result));
}

function guidedTarget(recipeId, beanWeight, iceMode, stageIndex, elapsedSeconds) {
  return vm.runInContext(`
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === ${JSON.stringify(recipeId)});
    currentBeanWeight = ${beanWeight};
    isIceMode = ${iceMode};
    calculateAndRender();
    getGuidedTarget(scaledStages[${stageIndex}], ${elapsedSeconds});
  `, context);
}

function timerPosition(recipeId, elapsedSeconds) {
  const result = vm.runInContext(`
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === ${JSON.stringify(recipeId)});
    currentBeanWeight = currentRecipe.baseBeanWeight;
    isIceMode = currentRecipe.type === "ice";
    calculateAndRender();
    totalSecondsElapsed = ${elapsedSeconds};
    syncTimerStepToElapsed();
    ({ currentStepIndex, stepTimeRemaining });
  `, context);
  return JSON.parse(JSON.stringify(result));
}

function renderTimerAt(recipeId, beanWeight, iceMode, elapsedSeconds) {
  const result = vm.runInContext(`
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === ${JSON.stringify(recipeId)});
    currentBeanWeight = ${beanWeight};
    isIceMode = ${iceMode};
    calculateAndRender();
    totalSecondsElapsed = ${elapsedSeconds};
    syncTimerStepToElapsed();
    renderTimerStep();
    ({
      target: document.getElementById("timer-target-scale").textContent,
      instruction: document.getElementById("timer-instruction").innerHTML || document.getElementById("timer-instruction").textContent,
      nextTime: document.getElementById("timer-next-time").textContent,
      progress: document.getElementById("timer-progress-bar").style.width
    });
  `, context);
  return JSON.parse(JSON.stringify(result));
}

const kasuyaHot = calculate("kasuya_46", 20, false);
assert.equal(kasuyaHot.totalWater, 300);
assert.equal(kasuyaHot.iceWeight, 0);
assert.equal(kasuyaHot.finalWater, 300);
assert.equal(kasuyaHot.lastTarget, 300);
assert.equal(kasuyaHot.ratioLabel, "1:15 추출 비율");
assert.equal(kasuyaHot.totalLabel, "300g");
assert.equal(kasuyaHot.finalLabel, "300g");
assert.equal(kasuyaHot.variantBadge, "원본 균형형");
assert.equal(kasuyaHot.modeDescription, "원본 HOT 레시피");
assert.equal(kasuyaHot.hotDisabled, false);
assert.doesNotMatch(kasuyaHot.stepListHtml, /SWITCH/);

const kasuyaIce = calculate("kasuya_46", 20, true);
assert.equal(kasuyaIce.totalWater, 200);
assert.equal(kasuyaIce.iceWeight, 100);
assert.equal(kasuyaIce.finalWater, 300);
assert.equal(kasuyaIce.lastTarget, 200);
assert.equal(kasuyaIce.ratioLabel, "1:10 추출 비율");
assert.equal(kasuyaIce.totalLabel, "200g");
assert.equal(kasuyaIce.finalLabel, "300g");
assert.equal(kasuyaIce.variantBadge, "앱 기본 아이스 변형");
assert.match(kasuyaIce.modeDescription, /공식 아이스 버전 없음/);

const iceDefault = calculate("ice_drip_classic", 20, true);
assert.equal(iceDefault.totalWater, 200);
assert.equal(iceDefault.iceWeight, 100);
assert.equal(iceDefault.finalWater, 300);
assert.equal(iceDefault.lastTarget, 200);
assert.equal(iceDefault.ratioLabel, "1:10 추출 비율");
assert.equal(iceDefault.totalLabel, "200g");
assert.equal(iceDefault.finalLabel, "300g");
assert.equal(iceDefault.variantBadge, "앱 기본 아이스 변형");
assert.equal(iceDefault.hotDisabled, true);

const hoffmannHot = calculate("james_hoffmann_v60", 15, false);
assert.equal(hoffmannHot.totalWater, 250);
assert.equal(hoffmannHot.iceWeight, 0);
assert.equal(hoffmannHot.lastTarget, 250);
assert.equal(hoffmannHot.ratioLabel, "1:16.7 추출 비율");
assert.equal(hoffmannHot.totalLabel, "250g");

const switchHot = calculate("hario_switch_sweet", 20, false);
assert.match(switchHot.stepListHtml, /SWITCH/);

const scaled = calculate("kasuya_46", 17.5, true);
assert.equal(scaled.totalWater, 175);
assert.equal(scaled.lastTarget, scaled.totalWater);

assert.equal(guidedTarget("kasuya_46", 20, false, 0, 0), 60);
assert.equal(guidedTarget("james_hoffmann_v60", 15, false, 1, 45), 30);
assert.equal(guidedTarget("james_hoffmann_v60", 15, false, 1, 60), 90);
assert.equal(guidedTarget("james_hoffmann_v60", 15, false, 1, 75), 150);
assert.equal(guidedTarget("ice_drip_classic", 20, true, 1, 60), 80);
assert.equal(guidedTarget("hario_switch_sweet", 20, false, 3, 120), 280);

assert.deepEqual(timerPosition("kasuya_46", 44), { currentStepIndex: 0, stepTimeRemaining: 1 });
assert.deepEqual(timerPosition("kasuya_46", 45), { currentStepIndex: 1, stepTimeRemaining: 45 });
assert.deepEqual(timerPosition("kasuya_46", 180), { currentStepIndex: 4, stepTimeRemaining: 30 });

const kasuyaAtStart = renderTimerAt("kasuya_46", 20, false, 0);
assert.equal(kasuyaAtStart.target, 60);
assert.match(kasuyaAtStart.instruction, /60g/);
assert.equal(kasuyaAtStart.progress, "0%");

const hoffmannAtOneMinute = renderTimerAt("james_hoffmann_v60", 15, false, 60);
assert.equal(hoffmannAtOneMinute.target, 90);
assert.match(hoffmannAtOneMinute.instruction, /1:15까지 150g/);
assert.equal(hoffmannAtOneMinute.nextTime, "1:15 시작");

const iceAtFiftySeconds = renderTimerAt("ice_drip_classic", 20, true, 50);
assert.equal(iceAtFiftySeconds.target, 53);
assert.match(iceAtFiftySeconds.instruction, /1:15까지 120g/);

const legacyRecipe = vm.runInContext(`
  normalizeRecipeTimeline({
    id: "legacy",
    stages: [
      { name: "Bloom", water: 40, time: 30 },
      { name: "Wait", water: 0, time: 20 }
    ]
  });
`, context);
const normalizedLegacy = JSON.parse(JSON.stringify(legacyRecipe));
assert.deepEqual(
  normalizedLegacy.stages.map(stage => ({
    startSec: stage.startSec,
    pourEndSec: stage.pourEndSec,
    stepEndSec: stage.stepEndSec,
    guideMode: stage.guideMode,
    hasLegacyTime: "time" in stage
  })),
  [
    { startSec: 0, pourEndSec: 10, stepEndSec: 30, guideMode: "immediate", hasLegacyTime: false },
    { startSec: 30, pourEndSec: 30, stepEndSec: 50, guideMode: "event", hasLegacyTime: false }
  ]
);

console.log("HOT/ICE 계산·절대 타임라인·권장 중량 검증 완료");
