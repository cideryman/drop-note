"use strict";

// Calculator state, rendering, controls, and custom recipe editor.
// --- STATE MANAGEMENT ---
let allRecipes = [];
let currentRecipe = null;
let currentBeanWeight = 15.0;
let isIceMode = false;
let soundEnabled = true;
let scaledStages = [];
let scaledIceWeight = 0;
let scaledTotalWater = 0;
let scaledFinalWater = 0;
let modalRecipeType = "hot";
const TEMPERATURE_CHANGE_THRESHOLD_C = 5;
const TEMPERATURE_PREP_LEAD_SEC = 30;
const TEMPERATURE_MIN_PREP_DURATION_SEC = 5;
function renderRecipeDropdown() {
  const select = document.getElementById("recipe-select");
  select.textContent = "";
  allRecipes.forEach(recipe => {
    const option = document.createElement("option");
    option.value = recipe.id;
    option.textContent = `${recipe.isCustom ? "⭐ " : ""}${getRecipeDisplayName(recipe)}`;
    select.appendChild(option);
  });

  if (currentRecipe) {
    select.value = currentRecipe.id;
  }
  updateDeleteButtonVisibility();
}

function updateDeleteButtonVisibility() {
  const btnDelete = document.getElementById("btn-delete-recipe");
  const btnEdit = document.getElementById("btn-edit-recipe");
  if (currentRecipe && currentRecipe.isCustom) {
    btnDelete.classList.remove("hidden");
    btnEdit.classList.remove("hidden");
  } else {
    btnDelete.classList.add("hidden");
    btnEdit.classList.add("hidden");
  }
}

function getDoseRange(recipe) {
  const baseWeight = Number(recipe?.baseBeanWeight) || 15;
  const fallbackMin = Math.max(5, Math.round(baseWeight * 0.5 * 2) / 2);
  const fallbackMax = Math.min(100, Math.round(baseWeight * 2 * 2) / 2);
  const min = Number(recipe?.recommendedDoseMin);
  const max = Number(recipe?.recommendedDoseMax);

  return {
    min: Number.isFinite(min) && min > 0 ? min : fallbackMin,
    max: Number.isFinite(max) && max > 0 ? max : fallbackMax
  };
}

function formatRatioValue(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return "–";
  return Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1);
}

function showDoseValidationMessage(message = "") {
  const messageElement = document.getElementById("dose-validation-message");
  messageElement.textContent = message;
  if (message) {
    messageElement.classList.remove("hidden");
  } else {
    messageElement.classList.add("hidden");
  }
}

function updateDoseControls() {
  if (!currentRecipe) return;
  const range = getDoseRange(currentRecipe);
  const input = document.getElementById("input-bean-weight");
  const minusButton = document.getElementById("btn-bean-minus");
  const plusButton = document.getElementById("btn-bean-plus");

  input.min = range.min.toString();
  input.max = range.max.toString();
  document.getElementById("dose-range-display").textContent =
    `지원 원두량 ${range.min}–${range.max}g · 0.5g 단위`;

  minusButton.disabled = currentBeanWeight <= range.min;
  plusButton.disabled = currentBeanWeight >= range.max;
  for (const button of [minusButton, plusButton]) {
    if (button.disabled) {
      button.classList.add("opacity-40", "cursor-not-allowed");
    } else {
      button.classList.remove("opacity-40", "cursor-not-allowed");
    }
  }
}

function applyBeanWeight(rawValue, showError = true) {
  const value = Number(rawValue);
  const range = getDoseRange(currentRecipe);
  const isHalfGramIncrement = Number.isFinite(value) && Math.abs(value * 2 - Math.round(value * 2)) < 0.000001;

  if (!Number.isFinite(value)) {
    if (showError) showDoseValidationMessage("원두량을 숫자로 입력해주세요.");
    calculateAndRender();
    return false;
  }
  if (!isHalfGramIncrement) {
    if (showError) showDoseValidationMessage("원두량은 0.5g 단위로 입력해주세요.");
    calculateAndRender();
    return false;
  }
  if (value < range.min || value > range.max) {
    if (showError) showDoseValidationMessage(`이 레시피는 ${range.min}–${range.max}g 범위에서 지원합니다.`);
    calculateAndRender();
    return false;
  }

  currentBeanWeight = value;
  showDoseValidationMessage();
  calculateAndRender();
  return true;
}

function getCurrentModeMetadata() {
  const isDerivedIce = isIceMode && currentRecipe.type !== "ice";

  if (isDerivedIce) {
    return {
      badge: "앱 기본 아이스 변형",
      description: `공식 아이스 버전 없음 · 추출수 1:${ICE_FALLBACK_POLICY.hotWaterRatio} + 얼음 1:${ICE_FALLBACK_POLICY.iceRatio}`,
      isAppVariant: true
    };
  }

  const baseHotWater = currentRecipe.hotWaterTotal
    || currentRecipe.stages.reduce((sum, stage) => sum + Number(stage.water || 0), 0);
  const baseIceWeight = currentRecipe.iceWeight
    || currentRecipe.baseBeanWeight * ICE_FALLBACK_POLICY.iceRatio;
  const hotWaterRatio = formatRatioValue(baseHotWater / currentRecipe.baseBeanWeight);
  const iceRatio = formatRatioValue(baseIceWeight / currentRecipe.baseBeanWeight);

  return {
    badge: currentRecipe.variantLabel || (currentRecipe.isCustom ? "나만의 레시피" : "원본"),
    description: isIceMode
      ? `아이스 레시피 · 추출수 1:${hotWaterRatio} + 얼음 1:${iceRatio}`
      : (currentRecipe.isCustom ? "나만의 핫 레시피" : "원본 핫 레시피"),
    isAppVariant: currentRecipe.isVariant === true || currentRecipe.isCustom
  };
}

function updateRecipeMetadata() {
  const metadata = getCurrentModeMetadata();
  const variantBadge = document.getElementById("recipe-variant-badge");
  const sourceLink = document.getElementById("recipe-source-link");

  variantBadge.textContent = metadata.badge;
  variantBadge.className = metadata.isAppVariant
    ? "rounded-full border border-tertiary/30 bg-tertiary/10 px-2 py-0.5 text-tertiary"
    : "rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary";
  document.getElementById("recipe-equipment").textContent = getEquipmentLabel(currentRecipe);
  document.getElementById("brew-mode-description").textContent = metadata.description;

  if (currentRecipe.sourceUrl) {
    sourceLink.href = currentRecipe.sourceUrl;
    sourceLink.textContent = metadata.isAppVariant
      ? "기준 레시피 출처"
      : (currentRecipe.sourceLabel || "출처 보기");
    sourceLink.classList.remove("hidden");
  } else {
    sourceLink.removeAttribute("href");
    sourceLink.classList.add("hidden");
  }
}

function formatBrewTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getGuidedTarget(stage, elapsedSeconds) {
  const previousTarget = stage.previousCumulativeTarget ?? (stage.cumulativeTarget - stage.scaledWater);
  if (stage.scaledWater <= 0) return previousTarget;
  if (stage.guideMode !== "linear" || stage.pourEndSec <= stage.startSec) {
    return stage.cumulativeTarget;
  }
  if (elapsedSeconds <= stage.startSec) return previousTarget;
  if (elapsedSeconds >= stage.pourEndSec) return stage.cumulativeTarget;

  const progress = (elapsedSeconds - stage.startSec) / (stage.pourEndSec - stage.startSec);
  return Math.round(previousTarget + stage.scaledWater * progress);
}

// --- CORE SCALER CALCULATION LOGIC ---
function calculateAndRender() {
  if (!currentRecipe) return;

  const ratio = currentBeanWeight / currentRecipe.baseBeanWeight;
  const baseStageWater = currentRecipe.stages.reduce((acc, s) => acc + s.water, 0);
  const targetBaseHotWater = isIceMode
    ? (currentRecipe.hotWaterTotal || currentRecipe.baseBeanWeight * ICE_FALLBACK_POLICY.hotWaterRatio)
    : (currentRecipe.type === "ice"
      ? (currentRecipe.finalWaterTotal || currentRecipe.baseBeanWeight * 15)
      : baseStageWater);
  const targetHotWater = Math.round(targetBaseHotWater * ratio);
  const stageModeScale = baseStageWater > 0 ? targetBaseHotWater / baseStageWater : 1;

  let cumuScaleTarget = 0;
  scaledStages = currentRecipe.stages.map(st => {
    const scaledWater = Math.round(st.water * ratio * stageModeScale);
    const previousCumulativeTarget = cumuScaleTarget;
    cumuScaleTarget += scaledWater;
    return {
      ...st,
      scaledWater: scaledWater,
      previousCumulativeTarget,
      cumulativeTarget: cumuScaleTarget
    };
  });

  const roundingDiff = targetHotWater - cumuScaleTarget;
  if (roundingDiff !== 0) {
    let lastPourIndex = -1;
    for (let i = currentRecipe.stages.length - 1; i >= 0; i--) {
      if (currentRecipe.stages[i].water > 0) {
        lastPourIndex = i;
        break;
      }
    }
    if (lastPourIndex >= 0) {
      scaledStages[lastPourIndex].scaledWater += roundingDiff;
      cumuScaleTarget = 0;
      scaledStages = scaledStages.map(st => ({
        ...st,
        previousCumulativeTarget: cumuScaleTarget,
        cumulativeTarget: (cumuScaleTarget += st.scaledWater)
      }));
    }
  }

  if (isIceMode) {
    const baseIceWeight = currentRecipe.iceWeight || currentRecipe.baseBeanWeight * ICE_FALLBACK_POLICY.iceRatio;
    scaledIceWeight = Math.round(baseIceWeight * ratio);
    scaledTotalWater = targetHotWater;
  } else {
    scaledIceWeight = 0;
    scaledTotalWater = targetHotWater;
  }
  scaledFinalWater = scaledTotalWater + scaledIceWeight;

  const beanRatioDiff = (currentBeanWeight - currentRecipe.baseBeanWeight) / currentRecipe.baseBeanWeight;
  const warningBanner = document.getElementById("warning-banner");
  const warningText = document.getElementById("warning-grind-text");

  if (beanRatioDiff >= 0.20) {
    warningBanner.classList.remove("hidden");
    warningText.textContent = "분쇄도를 +1~2클릭 굵게";
  } else if (beanRatioDiff <= -0.20) {
    warningBanner.classList.remove("hidden");
    warningText.textContent = "분쇄도를 -1클릭 미세하게";
  } else {
    warningBanner.classList.add("hidden");
  }

  document.getElementById("input-bean-weight").value = currentBeanWeight.toFixed(1);
  const actualRatio = scaledTotalWater / currentBeanWeight;
  const formattedRatio = formatRatioValue(actualRatio);
  document.getElementById("ratio-badge").textContent = `1:${formattedRatio} 추출 비율`;
  document.getElementById("total-water-display").textContent = `${scaledTotalWater}g`;
  document.getElementById("ice-weight-display").textContent = `${scaledIceWeight}g`;
  document.getElementById("ice-badge").textContent = isIceMode ? "아이스" : "핫";
  document.getElementById("final-yield-display").textContent = `${scaledFinalWater}g`;
  const finalYieldCard = document.getElementById("final-yield-card");
  if (isIceMode) {
    finalYieldCard.classList.remove("hidden");
    finalYieldCard.classList.add("flex");
  } else {
    finalYieldCard.classList.add("hidden");
    finalYieldCard.classList.remove("flex");
  }
  document.getElementById("grind-display").textContent = currentRecipe.grindBase || "코만단테 24클릭";
  updateDoseControls();
  updateRecipeMetadata();
  updateTemperatureTransitionNotice();

  const totalTimeSec = scaledStages.reduce((max, stage) => Math.max(max, stage.stepEndSec), 0);
  document.getElementById("total-time-display").textContent = `총 추출 시간 ${formatBrewTime(totalTimeSec)}`;

  const container = document.getElementById("step-list-container");
  container.textContent = "";
  scaledStages.forEach((stage, index) => {
    const card = document.createElement("div");
    card.className = `glass-card ${index === 0 ? "active-step-card" : "opacity-70"} rounded-xl p-4 flex flex-col gap-2.5`;

    const header = document.createElement("div");
    header.className = "flex justify-between items-start gap-3";
    const stageLabel = splitStageLabel(stage.name);
    const stageHeading = document.createElement("div");
    stageHeading.className = "min-w-0 flex flex-col";
    appendTextElement(
      stageHeading,
      "span",
      "font-mono text-xs text-primary font-bold",
      `${stage.step}단계 · ${stageLabel.title}`
    );
    if (stageLabel.detail) {
      appendTextElement(
        stageHeading,
        "span",
        "mt-0.5 max-w-full truncate whitespace-nowrap font-mono text-[10px] text-on-surface-variant",
        stageLabel.detail
      );
    }
    header.appendChild(stageHeading);
    appendTextElement(
      header,
      "span",
      "shrink-0 font-mono text-[11px] text-on-surface-variant",
      `저울 목표: ${stage.cumulativeTarget}g`
    );
    card.appendChild(header);

    const details = document.createElement("div");
    details.className = `grid ${currentRecipe.equipment === "Hario Switch" ? "grid-cols-4" : "grid-cols-3"} gap-2`;
    appendStepDetail(details, "물", `+${stage.scaledWater}g`);
    appendStepDetail(details, "온도", `${stage.temp}°C`);

    const timing = document.createElement("div");
    timing.className = "flex flex-col";
    appendTextElement(timing, "span", "font-mono text-[10px] text-on-surface-variant", "구간");
    appendTextElement(
      timing,
      "span",
      "font-display font-semibold text-sm text-on-surface",
      `${formatBrewTime(stage.startSec)}–${formatBrewTime(stage.stepEndSec)}`
    );
    if (stage.scaledWater > 0) {
      appendTextElement(
        timing,
        "span",
        "font-mono text-[9px] text-on-surface-variant",
        `주입 ${formatBrewTime(stage.pourEndSec)}까지`
      );
    }
    details.appendChild(timing);

    if (currentRecipe.equipment === "Hario Switch") {
      const switchDetail = document.createElement("div");
      switchDetail.className = "flex flex-col items-end";
      const switchPresentation = getSwitchPresentation(stage.switch);
      appendTextElement(switchDetail, "span", "font-mono text-[10px] text-on-surface-variant", "스위치");
      const switchState = document.createElement("span");
      switchState.className = `inline-flex items-center gap-0.5 font-mono text-xs font-bold ${switchPresentation.textClass}`;
      appendTextElement(switchState, "span", "text-sm leading-none", switchPresentation.symbol);
      appendTextElement(switchState, "span", "", formatSwitchState(stage.switch));
      switchDetail.appendChild(switchState);
      details.appendChild(switchDetail);
    }

    card.appendChild(details);
    container.appendChild(card);
  });
}

function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function appendStepDetail(parent, label, value) {
  const detail = document.createElement("div");
  detail.className = "flex flex-col";
  appendTextElement(detail, "span", "font-mono text-[10px] text-on-surface-variant", label);
  appendTextElement(detail, "span", "font-display font-semibold text-base text-on-surface", value);
  parent.appendChild(detail);
}

function formatSwitchState(switchState) {
  return switchState === "closed" ? "닫힘" : "열림";
}

function getSwitchPresentation(switchState) {
  if (switchState === "closed") {
    return {
      icon: "horizontal_rule",
      symbol: "━",
      label: "닫힘 · 침출",
      ariaLabel: "닫힘, 침출 중",
      textClass: "text-brew-amber",
      badgeClass: "border-brew-amber/30 bg-brew-amber/10 text-brew-amber"
    };
  }
  return {
    icon: "arrow_downward",
    symbol: "↓",
    label: "열림 · 배출",
    ariaLabel: "열림, 배출 중",
    textClass: "text-tertiary",
    badgeClass: "border-tertiary/30 bg-tertiary/10 text-tertiary"
  };
}

function splitStageLabel(name) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const match = normalizedName.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match || !match[1].trim() || !match[2].trim()) {
    return { title: normalizedName, detail: "" };
  }
  return {
    title: match[1].trim(),
    detail: match[2].trim()
  };
}

function getTemperatureTransitions(stages) {
  const transitions = [];
  for (let index = 0; index < stages.length - 1; index++) {
    const currentStage = stages[index];
    const nextStage = stages[index + 1];
    if (
      !Number.isFinite(currentStage.temp) ||
      !Number.isFinite(nextStage.temp) ||
      Math.abs(nextStage.temp - currentStage.temp) < TEMPERATURE_CHANGE_THRESHOLD_C
    ) {
      continue;
    }
    transitions.push({
      currentIndex: index,
      nextIndex: index + 1,
      fromTemp: currentStage.temp,
      toTemp: nextStage.temp,
      startSec: nextStage.startSec
    });
  }
  return transitions;
}

function getTemperaturePreparation(stages, stageIndex, elapsedSeconds) {
  if (stageIndex < 0 || stageIndex >= stages.length - 1) return null;
  const currentStage = stages[stageIndex];
  const nextStage = stages[stageIndex + 1];
  if (
    !Number.isFinite(currentStage.temp) ||
    !Number.isFinite(nextStage.temp) ||
    Math.abs(nextStage.temp - currentStage.temp) < TEMPERATURE_CHANGE_THRESHOLD_C
  ) {
    return null;
  }

  const prepStartSec = Math.max(
    currentStage.pourEndSec,
    nextStage.startSec - TEMPERATURE_PREP_LEAD_SEC
  );
  if (nextStage.startSec - prepStartSec < TEMPERATURE_MIN_PREP_DURATION_SEC) {
    return null;
  }

  return {
    prepStartSec,
    nextStartSec: nextStage.startSec,
    fromTemp: currentStage.temp,
    toTemp: nextStage.temp,
    active: elapsedSeconds >= prepStartSec && elapsedSeconds < nextStage.startSec
  };
}

function updateTemperatureTransitionNotice() {
  const notice = document.getElementById("temperature-transition-notice");
  const summary = document.getElementById("temperature-transition-summary");
  const transitions = getTemperatureTransitions(scaledStages);
  if (transitions.length === 0) {
    notice.classList.add("hidden");
    notice.classList.remove("flex");
    summary.textContent = "";
    return;
  }

  summary.textContent = transitions
    .map(transition => (
      `${formatBrewTime(transition.startSec)} · 권장 ${transition.fromTemp}°C → ${transition.toTemp}°C`
    ))
    .join(" / ");
  notice.classList.remove("hidden");
  notice.classList.add("flex");
}

// --- EVENT BINDINGS ---
function bindEvents() {
  document.getElementById("recipe-select").addEventListener("change", (e) => {
    currentRecipe = allRecipes.find(r => r.id === e.target.value) || allRecipes[0];
    currentBeanWeight = currentRecipe.baseBeanWeight;
    isIceMode = currentRecipe.type === "ice";
    showDoseValidationMessage();
    updateHotIceButtons();
    updateDeleteButtonVisibility();
    calculateAndRender();
  });

  // Delete Custom Recipe
  document.getElementById("btn-edit-recipe").addEventListener("click", () => {
    if (currentRecipe?.isCustom) openEditRecipeModal(currentRecipe);
  });

  document.getElementById("btn-delete-recipe").addEventListener("click", () => {
    if (!currentRecipe || !currentRecipe.isCustom) return;
    if (confirm(`'${getRecipeDisplayName(currentRecipe)}' 레시피를 삭제하시겠습니까?`)) {
      const customOnly = allRecipes.filter(r => r.isCustom && r.id !== currentRecipe.id);
      if (!saveCustomRecipesToStorage(customOnly)) {
        alert("레시피를 삭제하지 못했습니다. 브라우저 저장 공간을 확인해주세요.");
        return;
      }
      loadRecipesFromStorage();
      calculateAndRender();
    }
  });

  // Bean Stepper
  document.getElementById("btn-bean-minus").addEventListener("click", () => {
    if (document.getElementById("btn-bean-minus").disabled) return;
    applyBeanWeight(currentBeanWeight - 0.5, false);
  });

  document.getElementById("btn-bean-plus").addEventListener("click", () => {
    if (document.getElementById("btn-bean-plus").disabled) return;
    applyBeanWeight(currentBeanWeight + 0.5, false);
  });

  document.getElementById("input-bean-weight").addEventListener("change", (e) => {
    applyBeanWeight(e.target.value);
  });

  // Hot / Ice Toggle
  document.getElementById("btn-type-hot").addEventListener("click", () => {
    if (currentRecipe.type === "ice" && !currentRecipe.hotVariantId) return;
    isIceMode = false;
    updateHotIceButtons();
    calculateAndRender();
  });

  document.getElementById("btn-type-ice").addEventListener("click", () => {
    isIceMode = true;
    updateHotIceButtons();
    calculateAndRender();
  });

  // Sound Toggle
  document.getElementById("btn-sound-toggle").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    document.getElementById("sound-icon").textContent = soundEnabled ? "volume_up" : "volume_off";
    document.getElementById("btn-sound-toggle").setAttribute(
      "aria-label",
      soundEnabled ? "소리 알림 끄기" : "소리 알림 켜기"
    );
    playBeep(1000, 0.1);
  });

  // Add Modal Events
  document.getElementById("btn-open-add-modal").addEventListener("click", openAddRecipeModal);
  document.getElementById("btn-close-modal").addEventListener("click", closeAddRecipeModal);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeAddRecipeModal);
  document.getElementById("btn-add-stage-row").addEventListener("click", addStageRowInModal);
  document.getElementById("form-add-recipe").addEventListener("submit", handleAddRecipeSubmit);
  document.getElementById("btn-modal-type-hot").addEventListener("click", () => setModalRecipeType("hot"));
  document.getElementById("btn-modal-type-ice").addEventListener("click", () => setModalRecipeType("ice"));
  document.getElementById("new-base-bean").addEventListener("input", updateCustomRecipePreview);
  document.getElementById("modal-stages-container").addEventListener("input", updateCustomRecipePreview);

  // Backup & Restore Modal Events
  document.getElementById("btn-open-backup-modal").addEventListener("click", () => {
    document.getElementById("modal-backup").classList.remove("hidden");
    document.getElementById("btn-open-backup-modal").setAttribute("aria-expanded", "true");
    document.getElementById("btn-close-backup-modal").focus?.();
  });
  document.getElementById("btn-close-backup-modal").addEventListener("click", () => {
    document.getElementById("modal-backup").classList.add("hidden");
    document.getElementById("btn-open-backup-modal").setAttribute("aria-expanded", "false");
    document.getElementById("btn-open-backup-modal").focus?.();
  });
  document.getElementById("btn-cancel-backup-modal").addEventListener("click", () => {
    document.getElementById("modal-backup").classList.add("hidden");
    document.getElementById("btn-open-backup-modal").setAttribute("aria-expanded", "false");
    document.getElementById("btn-open-backup-modal").focus?.();
  });

  // Backup Export JSON
  document.getElementById("btn-export-json").addEventListener("click", exportRecipesToJSON);
  
  // Restore Import JSON
  document.getElementById("btn-trigger-import").addEventListener("click", () => {
    document.getElementById("input-import-file").click();
  });
  document.getElementById("input-import-file").addEventListener("change", importRecipesFromJSON);

  // View Navigation
  document.getElementById("btn-start-brew").addEventListener("click", startTimerView);
  document.getElementById("btn-timer-stop").addEventListener("click", stopTimerView);
  document.getElementById("btn-timer-toggle").addEventListener("click", toggleTimerPlayPause);
  document.getElementById("btn-timer-skip").addEventListener("click", skipToNextStep);
  document.addEventListener("visibilitychange", handleTimerVisibilityChange);
}

// --- MODAL & CUSTOM RECIPE BUILDER ---
function collectCustomStageDrafts() {
  return [...document.querySelectorAll(".stage-builder-row")].map((row, index) => ({
    step: index + 1,
    name: row.querySelector(".stage-name").value.trim(),
    water: Number(row.querySelector(".stage-water").value),
    temp: Number(row.querySelector(".stage-temp").value),
    time: Number(row.querySelector(".stage-time").value),
    switch: row.querySelector(".stage-switch").value,
    guideMode: row.querySelector(".stage-guide-mode").value
  }));
}

function validateCustomRecipeDraft(draft) {
  const errors = [];
  const name = typeof draft.name === "string" ? draft.name.trim() : "";
  const baseBeanWeight = Number(draft.baseBeanWeight);
  const stages = Array.isArray(draft.stages) ? draft.stages : [];

  if (!name) errors.push("레시피 이름을 입력해주세요.");
  if (name.length > 80) errors.push("레시피 이름은 80자 이하로 입력해주세요.");
  if (!Number.isFinite(baseBeanWeight) || baseBeanWeight < 5 || baseBeanWeight > 100) {
    errors.push("기준 원두량은 5–100g 범위로 입력해주세요.");
  }
  if (Math.abs(baseBeanWeight * 2 - Math.round(baseBeanWeight * 2)) > 0.000001) {
    errors.push("기준 원두량은 0.5g 단위로 입력해주세요.");
  }
  if (stages.length < 1 || stages.length > 20) {
    errors.push("추출 단계는 1–20개로 구성해주세요.");
  }

  stages.forEach((stage, index) => {
    const label = `${index + 1}단계`;
    const guideMode = stage.guideMode || (stage.water > 0 ? "immediate" : "event");
    if (!stage.name || stage.name.length > 80) errors.push(`${label} 이름을 1–80자로 입력해주세요.`);
    if (!Number.isFinite(stage.water) || stage.water < 0 || stage.water > 1000) {
      errors.push(`${label} 물량은 0–1000g 범위로 입력해주세요.`);
    }
    if (!Number.isInteger(stage.temp) || stage.temp < 40 || stage.temp > 100) {
      errors.push(`${label} 온도는 40–100℃의 정수로 입력해주세요.`);
    }
    if (!Number.isInteger(stage.time) || stage.time < 1 || stage.time > 600) {
      errors.push(`${label} 시간은 1–600초의 정수로 입력해주세요.`);
    }
    if (!["open", "closed"].includes(stage.switch)) {
      errors.push(`${label} 스위치 상태가 올바르지 않습니다.`);
    }
    if (!["linear", "immediate", "event"].includes(guideMode)) {
      errors.push(`${label} 저울 가이드 방식이 올바르지 않습니다.`);
    }
    if (stage.water > 0 && guideMode === "event") {
      errors.push(`${label}에 물량이 있으면 동작 가이드를 사용할 수 없습니다.`);
    }
    if (stage.water === 0 && guideMode !== "event") {
      errors.push(`${label}의 물량이 0g이면 동작 가이드를 선택해주세요.`);
    }
  });

  const totalWater = stages.reduce(
    (sum, stage) => sum + (Number.isFinite(stage.water) && stage.water >= 0 ? stage.water : 0),
    0
  );
  const ratio = Number.isFinite(baseBeanWeight) && baseBeanWeight > 0 ? totalWater / baseBeanWeight : 0;
  if (totalWater <= 0 || totalWater > 2000) errors.push("전체 추출수는 1–2000g 범위여야 합니다.");
  if (ratio > 0 && (ratio < 5 || ratio > 25)) errors.push("추출 비율은 1:5–1:25 범위여야 합니다.");

  return { valid: errors.length === 0, errors, totalWater, ratio };
}

function updateCustomRecipePreview() {
  const baseBeanWeight = Number(document.getElementById("new-base-bean").value);
  const stages = collectCustomStageDrafts();
  const totalWater = stages.reduce(
    (sum, stage) => sum + (Number.isFinite(stage.water) && stage.water >= 0 ? stage.water : 0),
    0
  );
  const preview = document.getElementById("new-ratio-preview");

  if (!Number.isFinite(baseBeanWeight) || baseBeanWeight <= 0 || totalWater <= 0) {
    preview.textContent = "단계 물량 입력 후 계산";
    return;
  }
  preview.textContent = `1:${formatRatioValue(totalWater / baseBeanWeight)} · 추출수 ${totalWater}g`;
}

function setModalRecipeType(type) {
  modalRecipeType = type === "ice" ? "ice" : "hot";
  const isIce = modalRecipeType === "ice";
  const hotButton = document.getElementById("btn-modal-type-hot");
  const iceButton = document.getElementById("btn-modal-type-ice");
  hotButton.setAttribute("aria-pressed", (!isIce).toString());
  iceButton.setAttribute("aria-pressed", isIce.toString());
  hotButton.className = isIce
    ? "flex-1 min-h-11 rounded-lg font-mono text-xs font-semibold text-on-surface-variant hover:text-white transition-all"
    : "flex-1 min-h-11 rounded-lg font-mono text-xs font-semibold bg-primary-container text-on-primary transition-all";
  iceButton.className = isIce
    ? "flex-1 min-h-11 rounded-lg font-mono text-xs font-semibold bg-tertiary text-surface transition-all"
    : "flex-1 min-h-11 rounded-lg font-mono text-xs font-semibold text-on-surface-variant hover:text-white transition-all";
  document.getElementById("modal-type-help").textContent = isIce
    ? `입력한 단계 물량을 추출수로 사용하고 서버 얼음은 원두 대비 1:${ICE_FALLBACK_POLICY.iceRatio}로 계산합니다.`
    : "핫 레시피로 저장합니다.";
}

function setCustomRecipeModalTitle(isEditing) {
  const title = document.getElementById("add-recipe-title");
  title.textContent = "";
  appendTextElement(title, "span", "material-symbols-outlined", isEditing ? "edit" : "edit_note");
  title.appendChild(document.createTextNode(isEditing ? " 나만의 레시피 수정" : " 나만의 레시피 추가"));
}

function openAddRecipeModal() {
  document.getElementById("editing-recipe-id").value = "";
  setCustomRecipeModalTitle(false);
  document.getElementById("modal-add-recipe").classList.remove("hidden");
  document.getElementById("btn-open-add-modal").setAttribute("aria-expanded", "true");
  document.getElementById("form-add-recipe").reset();
  setModalRecipeType("hot");
  const container = document.getElementById("modal-stages-container");
  container.innerHTML = "";
  addStageRowInModal("1차 뜸들이기", 40, 92, 45, "open", "immediate");
  addStageRowInModal("2차 메인 주입", 80, 92, 45, "open", "linear");
  addStageRowInModal("3차 마무리 주입", 80, 90, 45, "open", "linear");
  updateCustomRecipePreview();
  document.getElementById("new-recipe-name").focus?.();
}

function openEditRecipeModal(recipe) {
  if (!recipe?.isCustom) return;
  document.getElementById("editing-recipe-id").value = recipe.id;
  setCustomRecipeModalTitle(true);
  document.getElementById("modal-add-recipe").classList.remove("hidden");
  document.getElementById("btn-open-add-modal").setAttribute("aria-expanded", "true");
  document.getElementById("new-recipe-name").value = recipe.recipeName || recipe.name || "";
  document.getElementById("new-base-bean").value = recipe.baseBeanWeight;
  document.getElementById("new-grind-size").value = recipe.grindBase || "";
  setModalRecipeType(recipe.type);

  const container = document.getElementById("modal-stages-container");
  container.textContent = "";
  recipe.stages.forEach(stage => {
    addStageRowInModal(
      stage.name,
      stage.water,
      stage.temp,
      Math.max(1, stage.stepEndSec - stage.startSec),
      stage.switch,
      stage.guideMode
    );
  });
  updateCustomRecipePreview();
  document.getElementById("new-recipe-name").focus?.();
}

function closeAddRecipeModal() {
  document.getElementById("modal-add-recipe").classList.add("hidden");
  document.getElementById("btn-open-add-modal").setAttribute("aria-expanded", "false");
  document.getElementById("btn-open-add-modal").focus?.();
}

function addStageRowInModal(defaultName = "", defaultWater = 50, defaultTemp = 92, defaultTime = 45, defaultSwitch = "open", defaultGuideMode = "immediate") {
  const container = document.getElementById("modal-stages-container");
  const index = container.children.length + 1;
  const rowId = `stage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row = document.createElement("div");
  row.className = "stage-builder-row bg-surface-container border border-white/5 rounded-xl p-2.5 flex flex-col gap-2 relative";
  row.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-mono text-[11px] text-primary font-bold">${index}단계</span>
      <button type="button" aria-label="${index}단계 삭제" class="btn-remove-stage-row min-h-11 px-2 text-error hover:text-white font-mono text-[10px]">삭제</button>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <input type="text" maxlength="80" aria-label="${index}단계 이름" class="stage-name min-h-11 bg-surface-container-highest border border-white/5 rounded-lg px-2 py-1 text-xs text-white" placeholder="단계 이름"/>
      <input type="number" min="0" max="1000" step="1" aria-label="${index}단계 물량" class="stage-water min-h-11 bg-surface-container-highest border border-white/5 rounded-lg px-2 py-1 text-xs font-mono text-white" placeholder="물량(g)"/>
    </div>
    <div class="grid grid-cols-2 gap-1.5">
      <div>
        <label for="${rowId}-temp" class="font-mono text-[9px] text-on-surface-variant block">온도(°C)</label>
        <input id="${rowId}-temp" type="number" min="40" max="100" step="1" aria-label="${index}단계 온도" class="stage-temp min-h-11 bg-surface-container-highest border border-white/5 rounded-lg px-1.5 py-1 text-xs font-mono text-white"/>
      </div>
      <div>
        <label for="${rowId}-time" class="font-mono text-[9px] text-on-surface-variant block">시간(초)</label>
        <input id="${rowId}-time" type="number" min="1" max="600" step="1" aria-label="${index}단계 시간" class="stage-time min-h-11 bg-surface-container-highest border border-white/5 rounded-lg px-1.5 py-1 text-xs font-mono text-white"/>
      </div>
      <div>
        <label for="${rowId}-switch" class="font-mono text-[9px] text-on-surface-variant block">스위치</label>
        <select id="${rowId}-switch" aria-label="${index}단계 스위치 상태" class="stage-switch min-h-11 bg-surface-container-highest border border-white/5 rounded-lg px-1 py-1 text-xs font-mono text-white">
          <option value="open">열림</option>
          <option value="closed">닫힘</option>
        </select>
      </div>
      <div>
        <label for="${rowId}-guide" class="font-mono text-[9px] text-on-surface-variant block">저울 가이드</label>
        <select id="${rowId}-guide" aria-label="${index}단계 저울 가이드" class="stage-guide-mode min-h-11 w-full bg-surface-container-highest border border-white/5 rounded-lg px-1 py-1 text-xs font-mono text-white">
          <option value="immediate">바로 목표량</option>
          <option value="linear">시간에 맞춰 증가</option>
          <option value="event">물 없는 동작</option>
        </select>
      </div>
    </div>
  `;

  row.querySelector(".stage-name").value = defaultName || `주입 ${index}`;
  row.querySelector(".stage-water").value = defaultWater;
  row.querySelector(".stage-temp").value = defaultTemp;
  row.querySelector(".stage-time").value = defaultTime;
  row.querySelector(".stage-switch").value = defaultSwitch;
  row.querySelector(".stage-guide-mode").value = defaultGuideMode;

  row.querySelector(".btn-remove-stage-row").addEventListener("click", () => {
    if (container.children.length > 1) {
      row.remove();
      updateCustomRecipePreview();
    } else {
      alert("최소 1개의 단계는 필요합니다.");
    }
  });

  container.appendChild(row);
  updateCustomRecipePreview();
}

function handleAddRecipeSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById("new-recipe-name").value.trim();
  const editingRecipeId = document.getElementById("editing-recipe-id").value;
  const baseBeanWeight = Number(document.getElementById("new-base-bean").value);
  const grindBase = document.getElementById("new-grind-size").value.trim() || "코만단테 24클릭";
  const stages = collectCustomStageDrafts();
  const validation = validateCustomRecipeDraft({ name, baseBeanWeight, stages });

  if (!validation.valid) {
    alert(validation.errors[0]);
    return;
  }

  const recommendedDoseMin = Math.max(5, Math.round(baseBeanWeight * 0.5 * 2) / 2);
  const recommendedDoseMax = Math.min(100, Math.round(baseBeanWeight * 2 * 2) / 2);
  const usesSwitch = stages.some(stage => stage.switch === "closed");

  let timelineCursor = 0;
  const timelineStages = stages.map(stage => {
    const startSec = timelineCursor;
    const stepEndSec = startSec + stage.time;
    const pourEndSec = stage.water <= 0
      ? startSec
      : (stage.guideMode === "linear" ? stepEndSec : Math.min(stepEndSec, startSec + 10));
    timelineCursor = stepEndSec;
    return {
      step: stage.step,
      name: stage.name,
      action: stage.water > 0 ? "pour" : "wait",
      water: stage.water,
      temp: stage.temp,
      startSec,
      pourEndSec,
      stepEndSec,
      guideMode: stage.guideMode,
      switch: stage.switch
    };
  });
  const iceWeight = modalRecipeType === "ice"
    ? Math.round(baseBeanWeight * ICE_FALLBACK_POLICY.iceRatio)
    : 0;
  const recipeId = editingRecipeId || `custom_${Date.now()}`;
  const savedRecipe = normalizeRecipeTimeline({
    id: recipeId,
    creator: null,
    recipeName: name,
    baseBeanWeight: baseBeanWeight,
    grindBase: grindBase,
    type: modalRecipeType,
    ratioText: `1:${formatRatioValue(validation.ratio)}`,
    finalRatioText: modalRecipeType === "ice"
      ? `1:${formatRatioValue((validation.totalWater + iceWeight) / baseBeanWeight)}`
      : null,
    hotWaterTotal: modalRecipeType === "ice" ? validation.totalWater : null,
    iceWeight: modalRecipeType === "ice" ? iceWeight : 0,
    finalWaterTotal: modalRecipeType === "ice" ? validation.totalWater + iceWeight : null,
    equipment: usesSwitch ? "Hario Switch" : "드리퍼",
    equipmentLabel: usesSwitch ? "Switch" : "드리퍼",
    variantLabel: modalRecipeType === "ice" ? "나만의 아이스 레시피" : "나만의 레시피",
    isVariant: true,
    sourceLabel: "사용자 작성",
    sourceUrl: null,
    recommendedDoseMin,
    recommendedDoseMax,
    isCustom: true,
    stages: timelineStages
  });

  const existingCustom = allRecipes.filter(r => r.isCustom);
  const updatedCustom = upsertCustomRecipe(existingCustom, savedRecipe, editingRecipeId);

  if (!saveCustomRecipesToStorage(updatedCustom)) {
    alert("레시피를 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요.");
    return;
  }
  loadRecipesFromStorage();

  currentRecipe = allRecipes.find(recipe => recipe.id === recipeId) || allRecipes[0];
  currentBeanWeight = currentRecipe.baseBeanWeight;
  isIceMode = currentRecipe.type === "ice";
  renderRecipeDropdown();
  updateHotIceButtons();
  calculateAndRender();

  closeAddRecipeModal();
  playBeep(1200, 0.2);
}

function upsertCustomRecipe(existingCustom, savedRecipe, editingRecipeId = "") {
  if (!editingRecipeId) return [...existingCustom, savedRecipe];
  const editingIndex = existingCustom.findIndex(recipe => recipe.id === editingRecipeId);
  if (editingIndex < 0) return [...existingCustom, savedRecipe];
  return existingCustom.map((recipe, index) => index === editingIndex ? savedRecipe : recipe);
}

function updateHotIceButtons() {
  const btnHot = document.getElementById("btn-type-hot");
  const btnIce = document.getElementById("btn-type-ice");
  const hotUnavailable = currentRecipe?.type === "ice" && !currentRecipe.hotVariantId;

  btnHot.disabled = hotUnavailable;
  btnHot.setAttribute("aria-disabled", hotUnavailable.toString());
  btnHot.setAttribute("aria-pressed", (!isIceMode).toString());
  btnIce.setAttribute("aria-pressed", isIceMode.toString());

  if (isIceMode) {
    btnIce.className = "flex-1 min-h-11 py-2 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-tertiary text-surface shadow-sm";
    btnHot.className = hotUnavailable
      ? "flex-1 min-h-11 py-2 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 text-on-surface-variant opacity-40 cursor-not-allowed"
      : "flex-1 min-h-11 py-2 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-on-surface-variant hover:text-on-surface";
  } else {
    btnHot.className = "flex-1 min-h-11 py-2 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-primary-container text-on-primary shadow-sm";
    btnIce.className = "flex-1 min-h-11 py-2 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-on-surface-variant hover:text-on-surface";
  }
}
