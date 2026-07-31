import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const recipeSource = fs.readFileSync(new URL("../recipes.js", import.meta.url), "utf8");
const match = recipeSource.match(/const DEFAULT_RECIPES = (\[[\s\S]*?\n\]);/);

assert.ok(match, "recipes.js에서 DEFAULT_RECIPES를 찾을 수 있어야 합니다.");

const recipes = vm.runInNewContext(match[1]);
const byId = Object.fromEntries(recipes.map(recipe => [recipe.id, recipe]));
const sumWater = recipe => recipe.stages.reduce((sum, stage) => sum + stage.water, 0);
const totalTime = recipe => recipe.stages.reduce((max, stage) => Math.max(max, stage.stepEndSec), 0);

assert.match(html, />추출수</);
assert.match(html, />서버 얼음</);

assert.equal(sumWater(byId.kasuya_46), 300);
assert.equal(byId.kasuya_46.baseBeanWeight, 20);
assert.equal(totalTime(byId.kasuya_46), 210);
assert.equal(byId.kasuya_46.creator, "테츠 카스야");
assert.equal(byId.kasuya_46.recipeName, "4:6");
assert.equal(byId.kasuya_46.equipmentLabel, "V60");

assert.equal(sumWater(byId.hario_switch_sweet), 280);
assert.equal(byId.hario_switch_sweet.baseBeanWeight, 20);
assert.equal(totalTime(byId.hario_switch_sweet), 180);
assert.equal(byId.hario_switch_sweet.creator, "테츠 카스야");
assert.equal(byId.hario_switch_sweet.recipeName, "Devil");
assert.equal(byId.hario_switch_sweet.equipmentLabel, "Switch");

assert.equal(sumWater(byId.james_hoffmann_v60), 250);
assert.equal(byId.james_hoffmann_v60.baseBeanWeight, 15);
assert.equal(totalTime(byId.james_hoffmann_v60), 210);
assert.equal(byId.james_hoffmann_v60.creator, "제임스 호프만");
assert.equal(byId.james_hoffmann_v60.recipeName, "Ultimate");
assert.equal(byId.james_hoffmann_v60.equipmentLabel, "V60");

const iceRecipe = byId.ice_drip_classic;
assert.equal(iceRecipe.creator, null);
assert.equal(iceRecipe.recipeName, "아이스 기본형");
assert.equal(iceRecipe.equipmentLabel, "V60");
assert.equal(sumWater(iceRecipe), iceRecipe.hotWaterTotal);
assert.equal(iceRecipe.hotWaterTotal / iceRecipe.baseBeanWeight, 10);
assert.equal(iceRecipe.iceWeight, 100);
assert.equal(iceRecipe.hotWaterTotal + iceRecipe.iceWeight, iceRecipe.finalWaterTotal);
assert.equal(iceRecipe.finalWaterTotal / iceRecipe.baseBeanWeight, 15);

for (const recipe of recipes) {
  assert.equal("name" in recipe, false, `${recipe.id}: 조합된 제목을 원본 데이터에 중복 저장하지 않아야 합니다.`);
  assert.ok(recipe.equipment, `${recipe.id}: 장비 정보가 필요합니다.`);
  assert.ok(recipe.variantLabel, `${recipe.id}: 원본/변형 표시가 필요합니다.`);
  assert.ok(recipe.sourceLabel, `${recipe.id}: 출처 설명이 필요합니다.`);
  assert.equal(typeof recipe.isVariant, "boolean", `${recipe.id}: 원본/변형 상태가 필요합니다.`);
  assert.ok(recipe.recommendedDoseMin < recipe.recommendedDoseMax, `${recipe.id}: 권장 원두량 범위가 올바르지 않습니다.`);

  let previousEndSec = 0;
  for (const stage of recipe.stages) {
    assert.equal(stage.startSec, previousEndSec, `${recipe.id}: 단계 시작 시각이 앞 단계와 이어져야 합니다.`);
    assert.ok(stage.pourEndSec >= stage.startSec, `${recipe.id}: 주입 종료가 시작보다 빠를 수 없습니다.`);
    assert.ok(stage.pourEndSec <= stage.stepEndSec, `${recipe.id}: 주입 종료가 단계 종료보다 늦을 수 없습니다.`);
    assert.ok(["linear", "immediate", "event"].includes(stage.guideMode), `${recipe.id}: 지원하지 않는 가이드 모드입니다.`);
    assert.equal("time" in stage, false, `${recipe.id}: 레거시 time 필드를 사용하지 않아야 합니다.`);
    previousEndSec = stage.stepEndSec;
  }
}

console.log(`기본 프리셋 ${recipes.length}개 검증 완료`);
