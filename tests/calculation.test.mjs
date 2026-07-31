import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadAppScript } from "./load-app-script.mjs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appScript = loadAppScript();

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
  appendChild(child) {
    this.innerHTML += `${child.textContent || ""}${child.innerHTML || ""}`;
  },
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

assert.equal(
  vm.runInContext("getRecipeDisplayName(DEFAULT_RECIPES.find(recipe => recipe.id === 'kasuya_46'))", context),
  "테츠 카스야 · 4:6"
);
assert.equal(
  vm.runInContext("getRecipeDisplayName(DEFAULT_RECIPES.find(recipe => recipe.id === 'ice_drip_classic'))", context),
  "아이스 기본형"
);
assert.equal(
  vm.runInContext("getEquipmentLabel(DEFAULT_RECIPES.find(recipe => recipe.id === 'hario_switch_sweet'))", context),
  "Switch"
);

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
assert.equal(kasuyaHot.modeDescription, "원본 핫 레시피");
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
assert.match(switchHot.stepListHtml, /스위치/);

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

assert.equal(html.includes('id="new-ratio-text"'), false);
assert.match(html, /id="new-ratio-preview"/);

const doseRange = recipeId => {
  const result = vm.runInContext(`
    getDoseRange(DEFAULT_RECIPES.find(recipe => recipe.id === ${JSON.stringify(recipeId)}));
  `, context);
  return JSON.parse(JSON.stringify(result));
};
assert.deepEqual(doseRange("kasuya_46"), { min: 15, max: 30 });
assert.deepEqual(doseRange("hario_switch_sweet"), { min: 15, max: 25 });
assert.deepEqual(doseRange("james_hoffmann_v60"), { min: 15, max: 30 });

const fallbackRange = vm.runInContext(`getDoseRange({ baseBeanWeight: 15 });`, context);
assert.deepEqual(JSON.parse(JSON.stringify(fallbackRange)), { min: 7.5, max: 30 });

const invalidDoseResult = vm.runInContext(`
  (() => {
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === "kasuya_46");
    currentBeanWeight = 20;
    isIceMode = false;
    const accepted = applyBeanWeight(14.5);
    return { accepted, currentBeanWeight, message: document.getElementById("dose-validation-message").textContent };
  })();
`, context);
const normalizedInvalidDose = JSON.parse(JSON.stringify(invalidDoseResult));
assert.equal(normalizedInvalidDose.accepted, false);
assert.equal(normalizedInvalidDose.currentBeanWeight, 20);
assert.match(normalizedInvalidDose.message, /15–30g/);

const halfGramResult = vm.runInContext(`
  (() => {
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === "kasuya_46");
    currentBeanWeight = 20;
    isIceMode = false;
    const accepted = applyBeanWeight(17.3);
    return { accepted, currentBeanWeight, message: document.getElementById("dose-validation-message").textContent };
  })();
`, context);
const normalizedHalfGram = JSON.parse(JSON.stringify(halfGramResult));
assert.equal(normalizedHalfGram.accepted, false);
assert.equal(normalizedHalfGram.currentBeanWeight, 20);
assert.match(normalizedHalfGram.message, /0.5g 단위/);

const validDoseResult = vm.runInContext(`
  (() => {
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === "kasuya_46");
    currentBeanWeight = 20;
    isIceMode = false;
    const accepted = applyBeanWeight(17.5);
    return { accepted, currentBeanWeight };
  })();
`, context);
assert.deepEqual(JSON.parse(JSON.stringify(validDoseResult)), { accepted: true, currentBeanWeight: 17.5 });

const validDraft = vm.runInContext(`
  validateCustomRecipeDraft({
    name: "테스트 레시피",
    baseBeanWeight: 15,
    stages: [
      { name: "Bloom", water: 40, temp: 92, time: 30, switch: "open" },
      { name: "Main", water: 160, temp: 92, time: 90, switch: "open" }
    ]
  });
`, context);
const normalizedValidDraft = JSON.parse(JSON.stringify(validDraft));
assert.equal(normalizedValidDraft.valid, true);
assert.equal(normalizedValidDraft.totalWater, 200);
assert.equal(formatNumber(normalizedValidDraft.ratio), formatNumber(200 / 15));

const editResult = vm.runInContext(`
  (() => {
    const existing = [
      { id: "custom_1", recipeName: "기존 A" },
      { id: "custom_2", recipeName: "기존 B" }
    ];
    const updated = upsertCustomRecipe(
      existing,
      { id: "custom_1", recipeName: "수정 A", type: "ice" },
      "custom_1"
    );
    return {
      count: updated.length,
      first: updated[0],
      second: updated[1]
    };
  })();
`, context);
assert.deepEqual(JSON.parse(JSON.stringify(editResult)), {
  count: 2,
  first: { id: "custom_1", recipeName: "수정 A", type: "ice" },
  second: { id: "custom_2", recipeName: "기존 B" }
});

const invalidDraft = vm.runInContext(`
  validateCustomRecipeDraft({
    name: "",
    baseBeanWeight: 15.3,
    stages: [
      { name: "", water: -1, temp: 110, time: 0, switch: "broken" }
    ]
  });
`, context);
const normalizedInvalidDraft = JSON.parse(JSON.stringify(invalidDraft));
assert.equal(normalizedInvalidDraft.valid, false);
assert.ok(normalizedInvalidDraft.errors.length >= 6);

for (const recipeId of ["kasuya_46", "hario_switch_sweet", "james_hoffmann_v60", "ice_drip_classic"]) {
  const range = doseRange(recipeId);
  for (let beanWeight = range.min; beanWeight <= range.max; beanWeight += 0.5) {
    const hotAllowed = recipeId !== "ice_drip_classic";
    if (hotAllowed) {
      const hot = calculate(recipeId, beanWeight, false);
      assert.equal(hot.lastTarget, hot.totalWater, `${recipeId} ${beanWeight}g HOT 누적값 불일치`);
    }
    const ice = calculate(recipeId, beanWeight, true);
    assert.equal(ice.lastTarget, ice.totalWater, `${recipeId} ${beanWeight}g ICE 누적값 불일치`);
    assert.equal(ice.finalWater, ice.totalWater + ice.iceWeight, `${recipeId} ${beanWeight}g 최종량 불일치`);
  }
}

function startFakeTimer(recipeId = "kasuya_46", startMs = 100_000) {
  return vm.runInContext(`
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === ${JSON.stringify(recipeId)});
    currentBeanWeight = currentRecipe.baseBeanWeight;
    isIceMode = currentRecipe.type === "ice";
    calculateAndRender();
    fakeNowMs = ${startMs};
    getCurrentTimeMs = () => fakeNowMs;
    startTimerView();
    ({ timerRunning, timerCompleted, totalSecondsElapsed });
  `, context);
}

startFakeTimer();
const driftRecovery = vm.runInContext(`
  fakeNowMs += 45_500;
  timerTick();
  ({ totalSecondsElapsed, currentStepIndex, stepTimeRemaining });
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(driftRecovery)),
  { totalSecondsElapsed: 45, currentStepIndex: 1, stepTimeRemaining: 45 },
  "콜백 횟수가 아니라 실제 경과 시각으로 진행해야 합니다."
);

startFakeTimer("kasuya_46", 200_000);
const pauseRecovery = vm.runInContext(`
  fakeNowMs += 12_000;
  timerTick();
  pauseTimer();
  fakeNowMs += 30_000;
  timerTick();
  const elapsedWhilePaused = totalSecondsElapsed;
  startTimerInterval();
  fakeNowMs += 3_000;
  timerTick();
  ({ elapsedWhilePaused, elapsedAfterResume: totalSecondsElapsed });
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(pauseRecovery)),
  { elapsedWhilePaused: 12, elapsedAfterResume: 15 },
  "일시정지 시간은 추출 경과 시간에 포함하지 않아야 합니다."
);

startFakeTimer("kasuya_46", 300_000);
const visibilityRecovery = vm.runInContext(`
  document.visibilityState = "hidden";
  handleTimerVisibilityChange();
  fakeNowMs += 90_400;
  document.visibilityState = "visible";
  handleTimerVisibilityChange();
  ({ totalSecondsElapsed, currentStepIndex, timerRunning });
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(visibilityRecovery)),
  { totalSecondsElapsed: 90, currentStepIndex: 2, timerRunning: true },
  "백그라운드 복귀 시 실제 시각에 맞는 단계로 복원해야 합니다."
);

startFakeTimer("kasuya_46", 400_000);
const skipRecovery = vm.runInContext(`
  fakeNowMs += 5_000;
  timerTick();
  skipToNextStep();
  fakeNowMs += 3_000;
  timerTick();
  ({ totalSecondsElapsed, currentStepIndex });
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(skipRecovery)),
  { totalSecondsElapsed: 48, currentStepIndex: 1 },
  "단계 건너뛰기 후에도 새 기준 시각에서 계속 진행해야 합니다."
);

startFakeTimer("kasuya_46", 500_000);
const completionState = vm.runInContext(`
  fakeNowMs += 211_000;
  const tickResult = timerTick();
  const duplicateFinishResult = finishBrewing();
  ({
    tickResult,
    duplicateFinishResult,
    timerRunning,
    timerCompleted,
    timerInterval,
    elapsed: totalSecondsElapsed,
    toggleDisabled: document.getElementById("btn-timer-toggle").disabled,
    skipDisabled: document.getElementById("btn-timer-skip").disabled
  });
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(completionState)),
  {
    tickResult: false,
    duplicateFinishResult: false,
    timerRunning: false,
    timerCompleted: true,
    timerInterval: null,
    elapsed: 210,
    toggleDisabled: true,
    skipDisabled: true
  },
  "완료 이후 인터벌과 Resume·Skip 동작을 중복 실행하지 않아야 합니다."
);

delete context.navigator.wakeLock;
delete context.navigator.vibrate;
vm.runInContext("updateTimerCapabilityStatus()", context);
assert.match(
  elements.get("timer-capability-status").textContent,
  /진동·화면 꺼짐 방지 미지원/,
  "지원하지 않는 알림·화면 기능을 안내해야 합니다."
);

const wakeLockRecovery = await vm.runInContext(`
  (async () => {
    wakeLock = null;
    wakeLockRequestPending = false;
    wakeRequestCount = 0;
    wakeReleaseCount = 0;
    navigator.wakeLock = {
      async request() {
        wakeRequestCount++;
        return {
          addEventListener() {},
          async release() { wakeReleaseCount++; }
        };
      }
    };
    currentRecipe = DEFAULT_RECIPES.find(recipe => recipe.id === "kasuya_46");
    currentBeanWeight = currentRecipe.baseBeanWeight;
    isIceMode = false;
    calculateAndRender();
    fakeNowMs = 600000;
    getCurrentTimeMs = () => fakeNowMs;
    document.visibilityState = "visible";
    startTimerView();
    await Promise.resolve();
    document.visibilityState = "hidden";
    handleTimerVisibilityChange();
    await Promise.resolve();
    fakeNowMs += 5_000;
    document.visibilityState = "visible";
    handleTimerVisibilityChange();
    await Promise.resolve();
    return { wakeRequestCount, wakeReleaseCount, totalSecondsElapsed };
  })();
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(wakeLockRecovery)),
  { wakeRequestCount: 2, wakeReleaseCount: 1, totalSecondsElapsed: 5 },
  "화면 복귀 시 Wake Lock을 다시 요청하고 실제 시간을 복원해야 합니다."
);

startFakeTimer("kasuya_46", 700_000);
const cancelledStop = vm.runInContext(`
  confirm = () => false;
  ({ stopped: stopTimerView(), timerRunning });
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(cancelledStop)),
  { stopped: false, timerRunning: true },
  "사용자가 취소하면 진행 중인 타이머를 유지해야 합니다."
);
const confirmedStop = vm.runInContext(`
  confirm = () => true;
  ({ stopped: stopTimerView(), timerRunning });
`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(confirmedStop)),
  { stopped: true, timerRunning: false },
  "사용자가 확인한 경우에만 진행 중인 타이머를 종료해야 합니다."
);

console.log("계산·타임라인·입력·실제 시각 타이머 검증 완료");

function formatNumber(value) {
  return Number(value.toFixed(8));
}
