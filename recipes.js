"use strict";

// Recipe presets, schema normalization, and shared constants.
// --- PRESET DEFAULT RECIPES ---
const DEFAULT_RECIPES = [
  {
    id: "kasuya_46",
    creator: "테츠 카스야",
    recipeName: "4:6",
    baseBeanWeight: 20,
    grindBase: "C40 28–32클릭 · 굵게",
    grindNote: "표준 클릭 · 앱 시작 범위 · Red Clix 약 2배",
    grindReferenceType: "app-start",
    type: "hot",
    ratioText: "1:15",
    equipment: "Hario V60",
    equipmentLabel: "V60",
    variantLabel: "원본 균형형",
    isVariant: false,
    sourceLabel: "HARIO 공식 4:6 Method",
    sourceUrl: "https://www.youtube.com/watch?v=wmCW8xSWGZY",
    recommendedDoseMin: 15,
    recommendedDoseMax: 30,
    isCustom: false,
    stages: [
      { step: 1, name: "1차 주입 (맛의 균형)", action: "pour", water: 60, temp: 92, startSec: 0, pourEndSec: 10, stepEndSec: 45, guideMode: "immediate", switch: "open" },
      { step: 2, name: "2차 주입 (맛의 균형)", action: "pour", water: 60, temp: 92, startSec: 45, pourEndSec: 55, stepEndSec: 90, guideMode: "immediate", switch: "open" },
      { step: 3, name: "3차 주입 (농도 조절)", action: "pour", water: 60, temp: 92, startSec: 90, pourEndSec: 100, stepEndSec: 135, guideMode: "immediate", switch: "open" },
      { step: 4, name: "4차 주입 (농도 조절)", action: "pour", water: 60, temp: 92, startSec: 135, pourEndSec: 145, stepEndSec: 180, guideMode: "immediate", switch: "open" },
      { step: 5, name: "5차 주입 및 드로우다운", action: "pour", water: 60, temp: 92, startSec: 180, pourEndSec: 190, stepEndSec: 210, guideMode: "immediate", switch: "open" }
    ]
  },
  {
    id: "hario_switch_sweet",
    creator: "테츠 카스야",
    recipeName: "Devil",
    baseBeanWeight: 20,
    grindBase: "C40 19–22클릭 · 중미세",
    grindNote: "표준 클릭 · 레시피 참고값(약 20클릭) · Red Clix 약 2배",
    grindReferenceType: "recipe-reference",
    grindSourceLabel: "RoastAroma — Devil Recipe",
    grindSourceUrl: "https://roastaroma.com/blog/tetsu-kasuyas-devil-recipe-for-the-hario-switch",
    type: "hot",
    ratioText: "1:14",
    equipment: "Hario Switch",
    equipmentLabel: "Switch",
    variantLabel: "원본 재현",
    isVariant: false,
    sourceLabel: "Tetsu Kasuya Switch 레시피 정리",
    sourceUrl: "https://comoricoffee.com/en/kasuyas-hario-switch-recipe-en/",
    recommendedDoseMin: 15,
    recommendedDoseMax: 25,
    isCustom: false,
    stages: [
      { step: 1, name: "1차 투과 주입", action: "pour", water: 60, temp: 90, startSec: 0, pourEndSec: 10, stepEndSec: 30, guideMode: "immediate", switch: "open" },
      { step: 2, name: "2차 투과 주입 (누적 120g)", action: "pour", water: 60, temp: 90, startSec: 30, pourEndSec: 40, stepEndSec: 75, guideMode: "immediate", switch: "open" },
      { step: 3, name: "저온 침출 (누적 280g)", action: "pour", water: 160, temp: 70, startSec: 75, pourEndSec: 90, stepEndSec: 105, guideMode: "immediate", switch: "closed" },
      { step: 4, name: "스위치 열고 드로우다운", action: "open-switch", water: 0, temp: 70, startSec: 105, pourEndSec: 105, stepEndSec: 180, guideMode: "event", switch: "open" }
    ]
  },
  {
    id: "james_hoffmann_v60",
    creator: "제임스 호프만",
    recipeName: "Ultimate",
    baseBeanWeight: 15,
    sourceBaseBeanWeight: 30,
    grindBase: "C40 20–24클릭 · 중미세",
    grindNote: "표준 클릭 · 15g 앱 변형 시작 범위 · Red Clix 약 2배",
    grindReferenceType: "app-start",
    type: "hot",
    ratioText: "1:16.7",
    equipment: "Hario V60",
    equipmentLabel: "V60",
    variantLabel: "15g 비례 축소",
    isVariant: true,
    sourceLabel: "Hario USA — James Hoffmann Ultimate V60",
    sourceUrl: "https://www.hario-usa.com/blogs/recipes-and-more-from-friends/james-hoffmann-uitimate-v60-technique",
    recommendedDoseMin: 15,
    recommendedDoseMax: 30,
    isCustom: false,
    stages: [
      { step: 1, name: "뜸들이기 (Bloom)", action: "pour", water: 30, temp: 97, startSec: 0, pourEndSec: 10, stepEndSec: 45, guideMode: "immediate", switch: "open" },
      { step: 2, name: "1차 메인 주입 (누적 60%)", action: "pour", water: 120, temp: 97, startSec: 45, pourEndSec: 75, stepEndSec: 75, guideMode: "linear", switch: "open" },
      { step: 3, name: "2차 메인 주입 (누적 100%)", action: "pour", water: 100, temp: 97, startSec: 75, pourEndSec: 105, stepEndSec: 105, guideMode: "linear", switch: "open" },
      { step: 4, name: "교반·스월 및 드로우다운", action: "swirl", water: 0, temp: 97, startSec: 105, pourEndSec: 105, stepEndSec: 210, guideMode: "event", switch: "open" }
    ]
  },
  {
    id: "ice_drip_classic",
    creator: null,
    recipeName: "아이스 기본형",
    baseBeanWeight: 20,
    grindBase: "C40 18–22클릭 · 중미세",
    grindNote: "표준 클릭 · 아이스 앱 시작 범위 · Red Clix 약 2배",
    grindReferenceType: "app-start",
    type: "ice",
    ratioText: "1:10",
    finalRatioText: "1:15",
    hotWaterTotal: 200,
    iceWeight: 100,
    finalWaterTotal: 300,
    equipment: "Hario V60",
    equipmentLabel: "V60",
    variantLabel: "앱 기본 아이스 변형",
    isVariant: true,
    sourceLabel: "드립노트 기본 변환 규칙",
    sourceUrl: null,
    recommendedDoseMin: 15,
    recommendedDoseMax: 30,
    isCustom: false,
    stages: [
      { step: 1, name: "1차 뜸들이기", action: "pour", water: 40, temp: 92, startSec: 0, pourEndSec: 10, stepEndSec: 45, guideMode: "immediate", switch: "open" },
      { step: 2, name: "2차 주입", action: "pour", water: 80, temp: 92, startSec: 45, pourEndSec: 75, stepEndSec: 90, guideMode: "linear", switch: "open" },
      { step: 3, name: "3차 주입 및 급랭", action: "pour", water: 80, temp: 92, startSec: 90, pourEndSec: 120, stepEndSec: 150, guideMode: "linear", switch: "open" }
    ]
  }
];

// 기존 사용자의 저장 데이터를 유지하기 위해 레거시 키 이름은 변경하지 않는다.
const STORAGE_KEY = "POUROVER_PRO_CUSTOM_RECIPES";
const BACKUP_FORMAT = "drop-note-recipes";
const BACKUP_VERSION = 1;
const ICE_FALLBACK_POLICY = Object.freeze({
  hotWaterRatio: 10,
  iceRatio: 5,
  finalRatio: 15
});
function getRecipeDisplayName(recipe) {
  const recipeName = typeof recipe?.recipeName === "string" && recipe.recipeName.trim()
    ? recipe.recipeName.trim()
    : (typeof recipe?.name === "string" ? recipe.name.trim() : "");
  const creator = typeof recipe?.creator === "string" ? recipe.creator.trim() : "";
  return creator ? `${creator} · ${recipeName}` : recipeName;
}

function getEquipmentLabel(recipe) {
  if (typeof recipe?.equipmentLabel === "string" && recipe.equipmentLabel.trim()) {
    return recipe.equipmentLabel.trim();
  }
  if (recipe?.equipment === "Hario V60") return "V60";
  if (recipe?.equipment === "Hario Switch") return "Switch";
  return recipe?.equipment || "장비 미지정";
}

function normalizeRecipeTimeline(recipe) {
  let cursorSec = 0;
  const validGuideModes = new Set(["linear", "immediate", "event"]);
  const stages = (Array.isArray(recipe.stages) ? recipe.stages : []).map((stage, index) => {
    const { time, ...stageWithoutLegacyTime } = stage;
    const legacyDuration = Number.isFinite(Number(time)) && Number(time) > 0 ? Number(time) : 45;
    const startSec = Number.isFinite(Number(stage.startSec))
      ? Math.max(0, Number(stage.startSec))
      : cursorSec;
    const stepEndSec = Number.isFinite(Number(stage.stepEndSec)) && Number(stage.stepEndSec) > startSec
      ? Number(stage.stepEndSec)
      : startSec + legacyDuration;
    const hasWater = Number(stage.water) > 0;
    const defaultPourEndSec = hasWater ? Math.min(stepEndSec, startSec + 10) : startSec;
    const pourEndSec = Number.isFinite(Number(stage.pourEndSec))
      ? Math.min(stepEndSec, Math.max(startSec, Number(stage.pourEndSec)))
      : defaultPourEndSec;
    const guideMode = validGuideModes.has(stage.guideMode)
      ? stage.guideMode
      : (hasWater ? "immediate" : "event");

    cursorSec = stepEndSec;
    return {
      ...stageWithoutLegacyTime,
      step: index + 1,
      action: stage.action || (hasWater ? "pour" : "wait"),
      startSec,
      pourEndSec,
      stepEndSec,
      guideMode
    };
  });

  const recipeName = typeof recipe.recipeName === "string" && recipe.recipeName.trim()
    ? recipe.recipeName.trim()
    : (typeof recipe.name === "string" ? recipe.name.trim() : "");
  const creator = typeof recipe.creator === "string" && recipe.creator.trim()
    ? recipe.creator.trim()
    : null;

  return {
    ...recipe,
    creator,
    recipeName,
    name: getRecipeDisplayName({ creator, recipeName }),
    equipmentLabel: getEquipmentLabel(recipe),
    stages
  };
}
