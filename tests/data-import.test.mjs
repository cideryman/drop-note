import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const appScript = scripts.at(-1)?.[1];
assert.ok(appScript, "애플리케이션 스크립트를 찾을 수 있어야 합니다.");

let unsafeHtmlAssignments = 0;
const elements = new Map();
function createElement() {
  let innerHTML = "";
  return {
    value: "",
    textContent: "",
    className: "",
    style: {},
    children: [],
    disabled: false,
    classList: { add() {}, remove() {} },
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    remove() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return createElement(); },
    click() {},
    get innerHTML() { return innerHTML; },
    set innerHTML(value) {
      unsafeHtmlAssignments++;
      innerHTML = value;
    }
  };
}

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
  createOscillator() {
    return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} } };
  }
  createGain() {
    return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
  }
}

const context = vm.createContext({
  window: { AudioContext: AudioContextStub },
  document: documentStub,
  navigator: {},
  localStorage: { getItem() { return null; }, setItem() {} },
  console: { ...console, error() {} },
  alert() {},
  confirm() { return true; },
  setInterval() { return 1; },
  clearInterval() {},
  Date,
  Math,
  JSON,
  Set
});
vm.runInContext(appScript, context);

const maliciousName = `<img src=x onerror="globalThis.pwned=true">`;
const validLegacyRecipe = {
  id: "custom_safe",
  name: maliciousName,
  baseBeanWeight: 20,
  grindBase: "중간",
  type: "hot",
  equipment: "드리퍼",
  stages: [
    { name: `<script>globalThis.pwned=true</script>`, water: 40, temp: 92, time: 45, switch: "open" },
    { name: "메인 주입", water: 160, temp: 92, time: 90, switch: "open" }
  ]
};

context.backupPayload = {
  format: "drop-note-recipes",
  version: 1,
  recipes: [validLegacyRecipe]
};
const parsed = vm.runInContext("parseBackupPayload(backupPayload)", context);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].name, maliciousName, "사용자 문자열은 변형하지 않고 텍스트로 보존합니다.");
assert.equal(parsed[0].creator, null, "이전 백업의 제작자 없음 상태를 유지합니다.");
assert.equal(parsed[0].recipeName, maliciousName, "이전 name 필드를 recipeName으로 이전합니다.");
assert.equal(parsed[0].stages[0].name, validLegacyRecipe.stages[0].name);
assert.equal(parsed[0].stages[1].startSec, 45, "이전 time 형식은 절대 시각으로 변환합니다.");

context.identityPayload = {
  format: "drop-note-recipes",
  version: 1,
  recipes: [{ ...validLegacyRecipe, name: undefined, creator: "홍길동", recipeName: "봄 레시피" }]
};
const identityParsed = vm.runInContext("parseBackupPayload(identityPayload)", context);
assert.equal(identityParsed[0].creator, "홍길동");
assert.equal(identityParsed[0].recipeName, "봄 레시피");
assert.equal(identityParsed[0].name, "홍길동 · 봄 레시피");

context.unsupportedPayload = { format: "drop-note-recipes", version: 99, recipes: [] };
assert.throws(
  () => vm.runInContext("parseBackupPayload(unsupportedPayload)", context),
  /지원하지 않는 백업 버전/
);

context.invalidPayload = {
  format: "drop-note-recipes",
  version: 1,
  recipes: [{ ...validLegacyRecipe, stages: [{ water: 200, temp: 92, time: 60, switch: "open" }] }]
};
assert.throws(
  () => vm.runInContext("parseBackupPayload(invalidPayload)", context),
  /이름이\(가\) 비어/
);

context.invalidUrlPayload = {
  format: "drop-note-recipes",
  version: 1,
  recipes: [{ ...validLegacyRecipe, sourceUrl: "javascript:alert(1)" }]
};
assert.throws(
  () => vm.runInContext("parseBackupPayload(invalidUrlPayload)", context),
  /http 또는 https/
);

context.existingRecipesForMerge = [{ ...parsed[0], id: "custom_safe" }];
context.importedRecipesForMerge = parsed;
const merged = vm.runInContext(
  "mergeImportedRecipes(existingRecipesForMerge, importedRecipesForMerge)",
  context
);
assert.equal(merged.length, 2);
assert.notEqual(merged[0].id, merged[1].id, "중복 ID는 새 ID로 교체해야 합니다.");
assert.equal(parsed[0].id, "custom_safe", "가져온 원본 객체를 직접 변경하지 않아야 합니다.");

vm.runInContext("localStorage.setItem = () => { throw new Error('quota'); }", context);
assert.equal(
  vm.runInContext("saveCustomRecipesToStorage([])", context),
  false,
  "저장 실패를 성공으로 처리하지 않아야 합니다."
);

unsafeHtmlAssignments = 0;
context.maliciousRecipe = parsed[0];
vm.runInContext(`
  allRecipes = [maliciousRecipe];
  currentRecipe = maliciousRecipe;
  currentBeanWeight = maliciousRecipe.baseBeanWeight;
  isIceMode = false;
  renderRecipeDropdown();
  calculateAndRender();
  totalSecondsElapsed = 50;
  currentStepIndex = 1;
  renderTimerStep();
`, context);
assert.equal(unsafeHtmlAssignments, 0, "레시피명과 단계명을 innerHTML로 렌더링하지 않아야 합니다.");
assert.equal(context.pwned, undefined, "가져온 HTML 문자열이 실행되지 않아야 합니다.");

console.log("백업 검증·저장 실패·안전한 문자열 렌더링 검증 완료");
