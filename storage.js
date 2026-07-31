"use strict";

// Local storage, backup export, import validation, and migration.
function loadRecipesFromStorage() {
  let customRecipes = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      customRecipes = validateRecipeCollection(JSON.parse(stored), { source: "저장 데이터" });
    }
  } catch (e) {
    console.error("저장된 커스텀 레시피를 불러오지 못했습니다:", e);
  }

  allRecipes = [...DEFAULT_RECIPES, ...customRecipes].map(normalizeRecipeTimeline);
  currentRecipe = allRecipes[0];
  currentBeanWeight = currentRecipe.baseBeanWeight;
  isIceMode = currentRecipe.type === "ice";

  renderRecipeDropdown();
}

function saveCustomRecipesToStorage(customOnlyList) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnlyList));
    return true;
  } catch (e) {
    console.error("커스텀 레시피를 저장하지 못했습니다:", e);
    return false;
  }
}

// --- BACKUP (EXPORT) & RESTORE (IMPORT) LOGIC ---
function readRequiredString(value, label, maxLength = 80) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}이(가) 비어 있습니다.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  }
  return trimmed;
}

function readFiniteNumber(value, label, min, max, integerOnly = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}은(는) 숫자여야 합니다.`);
  }
  if (value < min || value > max || (integerOnly && !Number.isInteger(value))) {
    throw new Error(`${label}은(는) ${min}–${max} 범위${integerOnly ? "의 정수" : ""}여야 합니다.`);
  }
  return value;
}

function sanitizeImportedRecipe(recipe, recipeIndex) {
  const prefix = `${recipeIndex + 1}번째 레시피`;
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    throw new Error(`${prefix}의 구조가 올바르지 않습니다.`);
  }

  const recipeName = readRequiredString(
    recipe.recipeName ?? recipe.name,
    `${prefix} 이름`
  );
  let creator = null;
  if (recipe.creator != null && recipe.creator !== "") {
    creator = readRequiredString(recipe.creator, `${prefix} 제작자`, 80);
  }
  const baseBeanWeight = readFiniteNumber(recipe.baseBeanWeight, `${prefix} 기준 원두량`, 5, 100);
  if (Math.abs(baseBeanWeight * 2 - Math.round(baseBeanWeight * 2)) > 0.000001) {
    throw new Error(`${prefix} 기준 원두량은 0.5g 단위여야 합니다.`);
  }
  if (!Array.isArray(recipe.stages) || recipe.stages.length < 1 || recipe.stages.length > 20) {
    throw new Error(`${prefix}의 단계 수는 1–20개여야 합니다.`);
  }

  const allowedActions = new Set(["pour", "wait", "swirl", "stir", "open-switch", "close-switch", "finish"]);
  const allowedGuideModes = new Set(["linear", "immediate", "event"]);
  const stages = recipe.stages.map((stage, stageIndex) => {
    const stagePrefix = `${prefix} ${stageIndex + 1}단계`;
    if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
      throw new Error(`${stagePrefix}의 구조가 올바르지 않습니다.`);
    }

    const water = readFiniteNumber(stage.water, `${stagePrefix} 물량`, 0, 1000);
    const temp = readFiniteNumber(stage.temp, `${stagePrefix} 온도`, 40, 100, true);
    const name = readRequiredString(stage.name, `${stagePrefix} 이름`);
    const switchState = stage.switch ?? "open";
    if (!["open", "closed"].includes(switchState)) {
      throw new Error(`${stagePrefix}의 스위치 상태가 올바르지 않습니다.`);
    }

    const sanitizedStage = {
      step: stageIndex + 1,
      name,
      water,
      temp,
      switch: switchState
    };

    if (stage.time !== undefined) {
      sanitizedStage.time = readFiniteNumber(stage.time, `${stagePrefix} 시간`, 1, 600, true);
    } else {
      sanitizedStage.startSec = readFiniteNumber(stage.startSec, `${stagePrefix} 시작 시각`, 0, 7200, true);
      sanitizedStage.pourEndSec = readFiniteNumber(stage.pourEndSec, `${stagePrefix} 주입 종료 시각`, 0, 7200, true);
      sanitizedStage.stepEndSec = readFiniteNumber(stage.stepEndSec, `${stagePrefix} 종료 시각`, 1, 7200, true);
      if (sanitizedStage.pourEndSec < sanitizedStage.startSec ||
          sanitizedStage.pourEndSec > sanitizedStage.stepEndSec) {
        throw new Error(`${stagePrefix}의 시각 순서가 올바르지 않습니다.`);
      }
    }

    const action = stage.action || (water > 0 ? "pour" : "wait");
    const guideMode = stage.guideMode || (water > 0 ? "immediate" : "event");
    if (!allowedActions.has(action)) throw new Error(`${stagePrefix}의 동작을 지원하지 않습니다.`);
    if (!allowedGuideModes.has(guideMode)) throw new Error(`${stagePrefix}의 안내 방식을 지원하지 않습니다.`);
    sanitizedStage.action = action;
    sanitizedStage.guideMode = guideMode;
    return sanitizedStage;
  });

  const totalWater = stages.reduce((sum, stage) => sum + stage.water, 0);
  const ratio = totalWater / baseBeanWeight;
  if (totalWater < 1 || totalWater > 2000 || ratio < 5 || ratio > 25) {
    throw new Error(`${prefix}의 추출 비율은 1:5–1:25 범위여야 합니다.`);
  }

  const type = recipe.type ?? "hot";
  if (!["hot", "ice"].includes(type)) throw new Error(`${prefix}의 추출 방식이 올바르지 않습니다.`);
  const normalized = normalizeRecipeTimeline({
    id: typeof recipe.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(recipe.id) ? recipe.id : "",
    creator,
    recipeName,
    baseBeanWeight,
    grindBase: typeof recipe.grindBase === "string" && recipe.grindBase.trim()
      ? recipe.grindBase.trim().slice(0, 120)
      : "분쇄도 미지정",
    type,
    ratioText: `1:${formatRatioValue(ratio)}`,
    equipment: typeof recipe.equipment === "string" && recipe.equipment.trim()
      ? recipe.equipment.trim().slice(0, 80)
      : (stages.some(stage => stage.switch === "closed") ? "Hario Switch" : "드리퍼"),
    equipmentLabel: typeof recipe.equipmentLabel === "string" && recipe.equipmentLabel.trim()
      ? recipe.equipmentLabel.trim().slice(0, 40)
      : null,
    variantLabel: typeof recipe.variantLabel === "string" && recipe.variantLabel.trim()
      ? recipe.variantLabel.trim().slice(0, 80)
      : "나만의 레시피",
    isVariant: true,
    sourceLabel: typeof recipe.sourceLabel === "string" && recipe.sourceLabel.trim()
      ? recipe.sourceLabel.trim().slice(0, 120)
      : "사용자 가져오기",
    sourceUrl: recipe.sourceUrl == null ? null : readRequiredString(recipe.sourceUrl, `${prefix} 출처 URL`, 500),
    recommendedDoseMin: Number.isFinite(recipe.recommendedDoseMin)
      ? recipe.recommendedDoseMin
      : Math.max(5, Math.round(baseBeanWeight * 0.5 * 2) / 2),
    recommendedDoseMax: Number.isFinite(recipe.recommendedDoseMax)
      ? recipe.recommendedDoseMax
      : Math.min(100, Math.round(baseBeanWeight * 2 * 2) / 2),
    isCustom: true,
    stages
  });

  if (normalized.sourceUrl && !/^https?:\/\//i.test(normalized.sourceUrl)) {
    throw new Error(`${prefix} 출처 URL은 http 또는 https 주소여야 합니다.`);
  }
  for (let index = 0; index < normalized.stages.length; index++) {
    const stage = normalized.stages[index];
    const previousEnd = index === 0 ? 0 : normalized.stages[index - 1].stepEndSec;
    if (stage.startSec !== previousEnd) {
      throw new Error(`${prefix} ${index + 1}단계가 앞 단계 종료 시각과 이어지지 않습니다.`);
    }
  }

  if (type === "ice") {
    const hotWaterTotal = readFiniteNumber(recipe.hotWaterTotal, `${prefix} 추출수`, 1, 2000);
    const iceWeight = readFiniteNumber(recipe.iceWeight, `${prefix} 얼음`, 0, 1000);
    const finalWaterTotal = readFiniteNumber(recipe.finalWaterTotal, `${prefix} 최종 물량`, 1, 3000);
    if (Math.abs(hotWaterTotal - totalWater) > 0.001 ||
        Math.abs(finalWaterTotal - hotWaterTotal - iceWeight) > 0.001) {
      throw new Error(`${prefix}의 추출수·얼음·최종 물량이 서로 맞지 않습니다.`);
    }
    normalized.hotWaterTotal = hotWaterTotal;
    normalized.iceWeight = iceWeight;
    normalized.finalWaterTotal = finalWaterTotal;
  }

  const doseRange = getDoseRange(normalized);
  if (doseRange.min < 5 || doseRange.max > 100 || doseRange.min >= doseRange.max) {
    throw new Error(`${prefix}의 지원 원두량 범위가 올바르지 않습니다.`);
  }
  normalized.recommendedDoseMin = doseRange.min;
  normalized.recommendedDoseMax = doseRange.max;
  return normalized;
}

function validateRecipeCollection(recipes, { source = "백업" } = {}) {
  if (!Array.isArray(recipes)) throw new Error(`${source}의 레시피 목록이 없습니다.`);
  if (recipes.length > 100) throw new Error(`${source}에는 레시피를 최대 100개까지 담을 수 있습니다.`);
  return recipes.map(sanitizeImportedRecipe);
}

function parseBackupPayload(payload) {
  if (Array.isArray(payload)) {
    return validateRecipeCollection(payload, { source: "이전 형식 백업" });
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("올바른 백업 데이터가 아닙니다.");
  }
  if (payload.format !== BACKUP_FORMAT) {
    throw new Error("드립노트 백업 파일이 아닙니다.");
  }
  if (payload.version !== BACKUP_VERSION) {
    throw new Error(`지원하지 않는 백업 버전입니다. 현재 지원 버전: ${BACKUP_VERSION}`);
  }
  return validateRecipeCollection(payload.recipes);
}

function mergeImportedRecipes(existingRecipes, importedRecipes) {
  const usedIds = new Set(existingRecipes.map(recipe => recipe.id));
  const merged = [...existingRecipes];
  importedRecipes.forEach((recipe, index) => {
    let id = recipe.id;
    if (!id || usedIds.has(id)) {
      do {
        id = `custom_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
      } while (usedIds.has(id));
    }
    usedIds.add(id);
    merged.push({ ...recipe, id, isCustom: true });
  });
  return merged;
}

function exportRecipesToJSON() {
  const customOnly = allRecipes.filter(r => r.isCustom);
  if (customOnly.length === 0) {
    alert("백업할 커스텀 레시피가 없습니다. 레시피를 먼저 추가해주세요!");
    return;
  }

  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    recipes: customOnly
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
  const downloadAnchor = document.createElement('a');
  const today = new Date().toISOString().slice(0,10);
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `dripnote_recipes_backup_${today}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  playBeep(1200, 0.2);
}

function importRecipesFromJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const importedRecipes = parseBackupPayload(JSON.parse(evt.target.result));
      const existingCustom = allRecipes.filter(r => r.isCustom);
      const merged = mergeImportedRecipes(existingCustom, importedRecipes);
      if (!saveCustomRecipesToStorage(merged)) {
        throw new Error("브라우저 저장 공간에 기록하지 못했습니다. 기존 레시피는 변경되지 않았습니다.");
      }
      loadRecipesFromStorage();
      calculateAndRender();

      alert(`총 ${importedRecipes.length}개의 레시피를 성공적으로 복원했습니다!`);
      document.getElementById("modal-backup").classList.add("hidden");
      document.getElementById("btn-open-backup-modal").setAttribute("aria-expanded", "false");
      playBeep(1500, 0.3);
    } catch (err) {
      alert("백업 파일 읽기 실패: " + err.message);
    } finally {
      e.target.value = "";
    }
  };
  reader.onerror = function() {
    alert("백업 파일을 읽을 수 없습니다.");
    e.target.value = "";
  };
  reader.readAsText(file);
}

