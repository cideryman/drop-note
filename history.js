"use strict";

// Local brew history, taste notes, favorites, and recent recipe preferences.
const BREW_HISTORY_KEY = "DRIP_NOTE_BREW_HISTORY";
const FAVORITES_KEY = "DRIP_NOTE_FAVORITES";
const RECENT_RECIPES_KEY = "DRIP_NOTE_RECENT_RECIPES";
const LARGE_TIMER_KEY = "DRIP_NOTE_LARGE_TIMER";
const MAX_BREW_HISTORY = 100;
const MAX_RECENT_RECIPES = 3;

let brewHistory = [];
let favoriteRecipeIds = [];
let recentRecipeIds = [];
let pendingTasteRecordId = null;
let largeTimerEnabled = false;

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`${key} 저장 데이터를 불러오지 못했습니다:`, error);
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`${key} 저장에 실패했습니다:`, error);
    return false;
  }
}

function normalizeIdList(value, maxLength = 100) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .filter(id => typeof id === "string" && id.length > 0 && id.length <= 120)
    .filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, maxLength);
}

function sanitizeTasteValue(value, allowed) {
  return allowed.includes(value) ? value : null;
}

function sanitizeBrewRecord(record, { strict = false } = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    if (strict) throw new Error("추출 기록 구조가 올바르지 않습니다.");
    return null;
  }
  const completedAt = typeof record.completedAt === "string" && !Number.isNaN(Date.parse(record.completedAt))
    ? record.completedAt
    : null;
  const recipeName = typeof record.recipeName === "string" ? record.recipeName.trim().slice(0, 160) : "";
  const beanWeight = Number(record.beanWeight);
  if (!completedAt || !recipeName || !Number.isFinite(beanWeight) || beanWeight <= 0 || beanWeight > 100) {
    if (strict) throw new Error("추출 기록의 필수 값이 올바르지 않습니다.");
    return null;
  }

  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const rawClicks = record.c40Clicks == null || record.c40Clicks === "" ? null : Number(record.c40Clicks);
  const c40Clicks = rawClicks == null ? null : Math.round(rawClicks);
  if (strict && rawClicks != null && (!Number.isInteger(rawClicks) || rawClicks < 0 || rawClicks > 100)) {
    throw new Error("C40 클릭 수는 0–100 범위의 정수여야 합니다.");
  }

  return {
    id: typeof record.id === "string" && record.id.length <= 120 ? record.id : createBrewRecordId(),
    completedAt,
    recipeId: typeof record.recipeId === "string" ? record.recipeId.slice(0, 120) : "",
    recipeName,
    equipment: typeof record.equipment === "string" ? record.equipment.slice(0, 80) : "도구 미지정",
    mode: record.mode === "ice" ? "ice" : "hot",
    beanWeight,
    hotWater: Math.max(0, safeNumber(record.hotWater)),
    iceWeight: Math.max(0, safeNumber(record.iceWeight)),
    plannedTimeSec: Math.max(0, Math.round(safeNumber(record.plannedTimeSec))),
    temperatures: Array.isArray(record.temperatures)
      ? [...new Set(record.temperatures.map(Number).filter(temp => Number.isInteger(temp) && temp >= 40 && temp <= 100))]
      : [],
    beanName: typeof record.beanName === "string" ? record.beanName.trim().slice(0, 80) : "",
    c40Clicks: c40Clicks != null && c40Clicks >= 0 && c40Clicks <= 100 ? c40Clicks : null,
    note: typeof record.note === "string" ? record.note.trim().slice(0, 300) : "",
    acidity: sanitizeTasteValue(record.acidity, ["low", "balanced", "high"]),
    bitterness: sanitizeTasteValue(record.bitterness, ["low", "balanced", "high"]),
    strength: sanitizeTasteValue(record.strength, ["light", "balanced", "strong"])
  };
}

function sanitizeBrewHistory(value, options = {}) {
  if (!Array.isArray(value)) {
    if (options.strict) throw new Error("추출 기록 목록이 없습니다.");
    return [];
  }
  const seen = new Set();
  return value
    .map(record => sanitizeBrewRecord(record, options))
    .filter(Boolean)
    .filter(record => {
      if (seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    })
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, MAX_BREW_HISTORY);
}

function loadUserBrewData() {
  brewHistory = sanitizeBrewHistory(readStoredJson(BREW_HISTORY_KEY, []));
  const validRecipeIds = new Set(allRecipes.map(recipe => recipe.id));
  favoriteRecipeIds = normalizeIdList(readStoredJson(FAVORITES_KEY, []))
    .filter(id => validRecipeIds.has(id));
  recentRecipeIds = normalizeIdList(readStoredJson(RECENT_RECIPES_KEY, []), MAX_RECENT_RECIPES)
    .filter(id => validRecipeIds.has(id));
  largeTimerEnabled = readStoredJson(LARGE_TIMER_KEY, false) === true;
  writeStoredJson(FAVORITES_KEY, favoriteRecipeIds);
  writeStoredJson(RECENT_RECIPES_KEY, recentRecipeIds);
  applyLargeTimerMode();
  renderRecentBrewHistory();
  updateFavoriteButton();
}

function createBrewRecordId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch (_) {}
  return `brew_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBrewHistoryRecord() {
  const record = sanitizeBrewRecord({
    id: createBrewRecordId(),
    completedAt: new Date().toISOString(),
    recipeId: currentRecipe.id,
    recipeName: getRecipeDisplayName(currentRecipe),
    equipment: getEquipmentLabel(currentRecipe),
    mode: isIceMode ? "ice" : "hot",
    beanWeight: currentBeanWeight,
    hotWater: scaledTotalWater,
    iceWeight: scaledIceWeight,
    plannedTimeSec: getTotalBrewTime(),
    temperatures: scaledStages.map(stage => stage.temp)
  });
  if (!record) return null;
  brewHistory = [record, ...brewHistory].slice(0, MAX_BREW_HISTORY);
  writeStoredJson(BREW_HISTORY_KEY, brewHistory);
  pendingTasteRecordId = record.id;
  renderRecentBrewHistory();
  return record;
}

function getPreviousBrewDefaults(recipeId, excludingId = null) {
  return brewHistory.find(record => (
    record.recipeId === recipeId && record.id !== excludingId && (record.beanName || record.c40Clicks != null)
  )) || null;
}

function getTasteSuggestion(taste) {
  const acidityHigh = taste?.acidity === "high";
  const bitternessHigh = taste?.bitterness === "high";
  const light = taste?.strength === "light";
  const strong = taste?.strength === "strong";
  if ((acidityHigh && bitternessHigh) || (light && strong)) {
    return { direction: null, text: "맛 신호가 엇갈립니다. 같은 조건으로 한 번 더 확인해 보세요." };
  }
  if ((acidityHigh || light) && !bitternessHigh && !strong) {
    return buildGrindSuggestion("finer", taste.c40Clicks);
  }
  if ((bitternessHigh || strong) && !acidityHigh && !light) {
    return buildGrindSuggestion("coarser", taste.c40Clicks);
  }
  return { direction: null, text: "현재 기록에서는 분쇄도를 바꿀 만큼 뚜렷한 신호가 없습니다." };
}

function buildGrindSuggestion(direction, clicks) {
  const current = Number.isInteger(Number(clicks)) ? Number(clicks) : null;
  if (direction === "finer") {
    const range = current == null ? "" : ` (${Math.max(0, current - 2)}–${Math.max(0, current - 1)}클릭)`;
    return { direction, text: `다음에는 C40를 1–2클릭 가늘게${range} 시도해 보세요.` };
  }
  const range = current == null ? "" : ` (${current + 1}–${current + 2}클릭)`;
  return { direction, text: `다음에는 C40를 1–2클릭 굵게${range} 시도해 보세요.` };
}

function openTasteEvaluation(recordId) {
  const record = brewHistory.find(item => item.id === recordId);
  const modal = document.getElementById("modal-taste-evaluation");
  if (!record || !modal) return false;
  pendingTasteRecordId = record.id;
  const previous = getPreviousBrewDefaults(record.recipeId, record.id);
  document.getElementById("taste-recipe-summary").textContent = `${record.recipeName} · ${record.beanWeight}g`;
  document.getElementById("taste-bean-name").value = previous?.beanName || "";
  document.getElementById("taste-c40-clicks").value = previous?.c40Clicks ?? "";
  document.getElementById("taste-note").value = "";
  resetTasteChoiceButtons();
  document.getElementById("taste-suggestion").textContent = "평가를 선택하면 다음 추출 제안을 확인할 수 있습니다.";
  modal.classList.remove("hidden");
  document.getElementById("taste-bean-name").focus?.();
  return true;
}

function resetTasteChoiceButtons() {
  for (const button of document.querySelectorAll?.("[data-taste-field]") || []) {
    button.setAttribute("aria-pressed", "false");
    button.classList.remove("taste-choice-active");
  }
}

function getSelectedTasteValue(field) {
  return document.querySelector?.(`[data-taste-field="${field}"][aria-pressed="true"]`)?.dataset.tasteValue || null;
}

function updateTasteSuggestionPreview() {
  const clicksValue = document.getElementById("taste-c40-clicks").value;
  const suggestion = getTasteSuggestion({
    acidity: getSelectedTasteValue("acidity"),
    bitterness: getSelectedTasteValue("bitterness"),
    strength: getSelectedTasteValue("strength"),
    c40Clicks: clicksValue === "" ? null : Number(clicksValue)
  });
  document.getElementById("taste-suggestion").textContent = suggestion.text;
}

function saveTasteEvaluation() {
  const recordIndex = brewHistory.findIndex(record => record.id === pendingTasteRecordId);
  if (recordIndex < 0) return false;
  const clicksRaw = document.getElementById("taste-c40-clicks").value.trim();
  const clicks = clicksRaw === "" ? null : Number(clicksRaw);
  if (clicks != null && (!Number.isInteger(clicks) || clicks < 0 || clicks > 100)) {
    document.getElementById("taste-form-error").textContent = "C40 클릭 수는 0–100 범위의 정수로 입력해 주세요.";
    return false;
  }
  document.getElementById("taste-form-error").textContent = "";
  brewHistory[recordIndex] = sanitizeBrewRecord({
    ...brewHistory[recordIndex],
    beanName: document.getElementById("taste-bean-name").value,
    c40Clicks: clicks,
    note: document.getElementById("taste-note").value,
    acidity: getSelectedTasteValue("acidity"),
    bitterness: getSelectedTasteValue("bitterness"),
    strength: getSelectedTasteValue("strength")
  });
  writeStoredJson(BREW_HISTORY_KEY, brewHistory);
  closeTasteEvaluation();
  renderRecentBrewHistory();
  return true;
}

function closeTasteEvaluation() {
  document.getElementById("modal-taste-evaluation")?.classList.add("hidden");
  pendingTasteRecordId = null;
}

function formatBrewRecordDate(isoDate) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(new Date(isoDate));
  } catch (_) {
    return isoDate.slice(0, 16).replace("T", " ");
  }
}

function getTasteLabels(record) {
  const labels = [];
  if (record.acidity) labels.push(`산미 ${record.acidity === "high" ? "높음" : record.acidity === "low" ? "낮음" : "균형"}`);
  if (record.bitterness) labels.push(`쓴맛 ${record.bitterness === "high" ? "높음" : record.bitterness === "low" ? "낮음" : "균형"}`);
  if (record.strength) labels.push(`농도 ${record.strength === "strong" ? "진함" : record.strength === "light" ? "연함" : "균형"}`);
  return labels;
}

function createHistoryCard(record, { detailed = false } = {}) {
  const article = document.createElement("article");
  article.className = "rounded-xl border border-outline/10 bg-surface-container p-3";
  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-3";
  const info = document.createElement("div");
  info.className = "min-w-0";
  const title = document.createElement("p");
  title.className = "truncate text-sm font-bold text-on-surface";
  title.textContent = record.recipeName;
  const meta = document.createElement("p");
  meta.className = "mt-1 font-mono text-[10px] text-on-surface-variant";
  meta.textContent = `${formatBrewRecordDate(record.completedAt)} · ${record.beanWeight}g · ${record.hotWater}g${record.iceWeight ? ` + 얼음 ${record.iceWeight}g` : ""}`;
  info.appendChild(title);
  info.appendChild(meta);
  top.appendChild(info);
  if (detailed) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.dataset.deleteBrewId = record.id;
    deleteButton.className = "min-w-11 min-h-11 rounded-full text-error flex items-center justify-center";
    deleteButton.setAttribute("aria-label", `${record.recipeName} 추출 기록 삭제`);
    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined text-base";
    icon.textContent = "delete";
    deleteButton.appendChild(icon);
    top.appendChild(deleteButton);
  }
  article.appendChild(top);
  if (detailed) {
    const details = document.createElement("p");
    details.className = "mt-2 text-xs leading-relaxed text-on-surface-variant";
    const parts = [record.equipment, record.beanName, record.c40Clicks != null ? `C40 ${record.c40Clicks}클릭` : "", ...getTasteLabels(record)].filter(Boolean);
    details.textContent = parts.join(" · ") || "추가 평가 없음";
    article.appendChild(details);
    if (record.note) {
      const note = document.createElement("p");
      note.className = "mt-2 rounded-lg bg-surface-container-highest/50 p-2 text-xs text-on-surface";
      note.textContent = record.note;
      article.appendChild(note);
    }
  }
  return article;
}

function renderRecentBrewHistory() {
  const section = document.getElementById("recent-brews-section");
  const list = document.getElementById("recent-brews-list");
  if (!section || !list) return;
  list.textContent = "";
  brewHistory.slice(0, 3).forEach(record => list.appendChild(createHistoryCard(record)));
  section.classList.toggle("hidden", brewHistory.length === 0);
  section.classList.toggle("flex", brewHistory.length > 0);
}

function openBrewHistoryModal() {
  const modal = document.getElementById("modal-brew-history");
  const list = document.getElementById("brew-history-list");
  list.textContent = "";
  if (brewHistory.length === 0) {
    const empty = document.createElement("p");
    empty.className = "py-8 text-center text-sm text-on-surface-variant";
    empty.textContent = "아직 저장된 추출 기록이 없습니다.";
    list.appendChild(empty);
  } else {
    brewHistory.forEach(record => list.appendChild(createHistoryCard(record, { detailed: true })));
  }
  document.getElementById("btn-clear-brew-history").classList.toggle("hidden", brewHistory.length === 0);
  modal.classList.remove("hidden");
}

function closeBrewHistoryModal() {
  document.getElementById("modal-brew-history")?.classList.add("hidden");
}

function deleteBrewHistoryRecord(id) {
  const record = brewHistory.find(item => item.id === id);
  if (!record || !confirm(`'${record.recipeName}' 추출 기록을 삭제할까요?`)) return false;
  brewHistory = brewHistory.filter(item => item.id !== id);
  writeStoredJson(BREW_HISTORY_KEY, brewHistory);
  renderRecentBrewHistory();
  openBrewHistoryModal();
  return true;
}

function clearBrewHistory() {
  if (brewHistory.length === 0 || !confirm("모든 추출 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return false;
  brewHistory = [];
  writeStoredJson(BREW_HISTORY_KEY, brewHistory);
  renderRecentBrewHistory();
  openBrewHistoryModal();
  return true;
}

function recordRecentRecipeUse() {
  if (!currentRecipe?.id) return;
  recentRecipeIds = [currentRecipe.id, ...recentRecipeIds.filter(id => id !== currentRecipe.id)]
    .slice(0, MAX_RECENT_RECIPES);
  writeStoredJson(RECENT_RECIPES_KEY, recentRecipeIds);
  renderRecipeDropdown();
}

function toggleCurrentRecipeFavorite() {
  if (!currentRecipe?.id) return;
  favoriteRecipeIds = favoriteRecipeIds.includes(currentRecipe.id)
    ? favoriteRecipeIds.filter(id => id !== currentRecipe.id)
    : [currentRecipe.id, ...favoriteRecipeIds];
  writeStoredJson(FAVORITES_KEY, favoriteRecipeIds);
  renderRecipeDropdown();
}

function updateFavoriteButton() {
  const button = document.getElementById("btn-toggle-favorite");
  if (!button || !currentRecipe) return;
  const active = favoriteRecipeIds.includes(currentRecipe.id);
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.setAttribute("aria-label", active ? "현재 레시피 즐겨찾기 해제" : "현재 레시피 즐겨찾기 추가");
  button.classList.toggle("text-primary", active);
  button.classList.toggle("text-on-surface-variant", !active);
  button.querySelector("span").classList.toggle("fill-icon", active);
}

function applyLargeTimerMode() {
  document.body?.classList.toggle("timer-large-mode", largeTimerEnabled);
  const button = document.getElementById("btn-large-timer-toggle");
  if (!button) return;
  button.setAttribute("aria-pressed", largeTimerEnabled ? "true" : "false");
  button.setAttribute("aria-label", largeTimerEnabled ? "기본 타이머 보기" : "큰 글자 타이머 보기");
  button.classList.toggle("text-primary", largeTimerEnabled);
}

function toggleLargeTimerMode() {
  largeTimerEnabled = !largeTimerEnabled;
  writeStoredJson(LARGE_TIMER_KEY, largeTimerEnabled);
  applyLargeTimerMode();
}

function getBrewBackupData() {
  return {
    brewHistory,
    recipePreferences: {
      favoriteRecipeIds,
      recentRecipeIds
    }
  };
}

function mergeImportedBrewData(bundle, recipeIdMap = new Map()) {
  const importedHistory = sanitizeBrewHistory(bundle.brewHistory || [], { strict: true })
    .map(record => ({ ...record, recipeId: recipeIdMap.get(record.recipeId) || record.recipeId }));
  const byId = new Map([...importedHistory, ...brewHistory].map(record => [record.id, record]));
  brewHistory = [...byId.values()]
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, MAX_BREW_HISTORY);
  const validRecipeIds = new Set(allRecipes.map(recipe => recipe.id));
  const importedFavorites = normalizeIdList(bundle.recipePreferences?.favoriteRecipeIds || [])
    .map(id => recipeIdMap.get(id) || id)
    .filter(id => validRecipeIds.has(id));
  const importedRecent = normalizeIdList(bundle.recipePreferences?.recentRecipeIds || [], MAX_RECENT_RECIPES)
    .map(id => recipeIdMap.get(id) || id)
    .filter(id => validRecipeIds.has(id));
  favoriteRecipeIds = normalizeIdList([...importedFavorites, ...favoriteRecipeIds]);
  recentRecipeIds = normalizeIdList([...importedRecent, ...recentRecipeIds], MAX_RECENT_RECIPES);
  writeStoredJson(BREW_HISTORY_KEY, brewHistory);
  writeStoredJson(FAVORITES_KEY, favoriteRecipeIds);
  writeStoredJson(RECENT_RECIPES_KEY, recentRecipeIds);
  renderRecentBrewHistory();
  renderRecipeDropdown();
}

function bindHistoryEvents() {
  document.getElementById("btn-toggle-favorite").addEventListener("click", toggleCurrentRecipeFavorite);
  document.getElementById("btn-large-timer-toggle").addEventListener("click", toggleLargeTimerMode);
  document.getElementById("btn-open-brew-history").addEventListener("click", openBrewHistoryModal);
  document.getElementById("btn-close-brew-history").addEventListener("click", closeBrewHistoryModal);
  document.getElementById("btn-clear-brew-history").addEventListener("click", clearBrewHistory);
  document.getElementById("brew-history-list").addEventListener("click", event => {
    const button = event.target.closest?.("[data-delete-brew-id]");
    if (button) deleteBrewHistoryRecord(button.dataset.deleteBrewId);
  });
  document.getElementById("btn-save-taste").addEventListener("click", saveTasteEvaluation);
  document.getElementById("btn-skip-taste").addEventListener("click", closeTasteEvaluation);
  document.getElementById("taste-c40-clicks").addEventListener("input", updateTasteSuggestionPreview);
  for (const button of document.querySelectorAll("[data-taste-field]")) {
    button.addEventListener("click", () => {
      const field = button.dataset.tasteField;
      for (const peer of document.querySelectorAll(`[data-taste-field="${field}"]`)) {
        const active = peer === button;
        peer.setAttribute("aria-pressed", active ? "true" : "false");
        peer.classList.toggle("taste-choice-active", active);
      }
      updateTasteSuggestionPreview();
    });
  }
}
