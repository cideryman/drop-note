import assert from "node:assert/strict";
import fs from "node:fs";
import { loadAppScript } from "./load-app-script.mjs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sourceCss = fs.readFileSync(new URL("../styles.input.css", import.meta.url), "utf8");
const appScript = loadAppScript();

const viewport = html.match(/<meta\s+content="([^"]+)"\s+name="viewport"\/>/)?.[1] ?? "";
assert.match(viewport, /width=device-width/);
assert.doesNotMatch(viewport, /maximum-scale|user-scalable/, "화면 확대를 제한하지 않아야 합니다.");

assert.match(html, /<title>드립노트/);
assert.match(html, /추출 타이머 시작/);
assert.doesNotMatch(html, /Start Brewing Timer|Pause Brew|Resume Brew|BREW COMPLETE/);

assert.match(html, /<nav id="bottom-nav"[^>]*class="hidden"/, "미구현 하단 메뉴는 숨겨야 합니다.");
assert.match(html, /<label for="recipe-select"/);
assert.match(html, /<label for="input-bean-weight"/);
assert.match(html, /<label for="new-recipe-name"/);
assert.match(html, /<label for="new-base-bean"/);
assert.match(html, /<label for="new-grind-size"/);

assert.match(html, /id="btn-sound-toggle"[^>]*aria-label="소리 알림 끄기"/);
assert.match(html, /id="btn-open-backup-modal"[^>]*aria-label="설정 및 백업 열기"/);
assert.match(html, /id="btn-close-modal"[^>]*aria-label=/);
assert.match(html, /id="btn-close-backup-modal"[^>]*aria-label=/);
assert.match(html, /화면 테마 선택/);
assert.match(html, /data-theme-preference="system"[^>]*aria-pressed="true"/);
assert.match(html, /data-theme-preference="light"[^>]*aria-pressed="false"/);
assert.match(html, /data-theme-preference="dark"[^>]*aria-pressed="false"/);
assert.match(html, /id="btn-timer-stop"[^>]*aria-label=/);
assert.match(html, /id="btn-timer-toggle"[^>]*aria-label=/);
assert.match(html, /id="btn-timer-skip"[^>]*aria-label=/);
assert.match(html, /id="btn-toggle-favorite"[^>]*aria-pressed="false"/);
assert.match(html, /id="btn-large-timer-toggle"[^>]*aria-pressed="false"/);
assert.match(html, /id="timer-preparation-panel"[^>]*aria-live="assertive"/);
assert.match(html, /id="modal-taste-evaluation"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="modal-brew-history"[^>]*role="dialog"[^>]*aria-modal="true"/);

assert.match(html, /id="modal-add-recipe"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="modal-backup"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="timer-progress-bar"[^>]*role="progressbar"[^>]*aria-valuenow="0"/);
assert.match(html, /id="timer-progress-bar"[^>]*style="width: 0%"/);
assert.match(html, /id="timer-step-progress-bar"[^>]*role="progressbar"[^>]*aria-label="현재 단계 진행률"/);
assert.match(html, /id="timer-step-progress-bar"[^>]*aria-valuetext="현재 단계 0% 진행"/);
assert.match(html, /id="timer-target-card"[^>]*timer-temperature-card/);
assert.match(html, /권장 물 온도/);
assert.match(html, /id="temperature-transition-notice"[^>]*role="note"/);
assert.match(html, /id="temperature-transition-summary"/);
assert.match(html, /id="grind-reference-note"/);
assert.match(html, /Red Clix 약 2배/);
assert.match(html, /id="timer-action-banner"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(html, /id="timer-action-banner"[^>]*pointer-events-none/);
assert.doesNotMatch(
  html.match(/<!-- VIEW 2: LIVE TIMER VIEW -->([\s\S]*?)<!-- MODAL 1:/)?.[1] ?? "",
  /animate-pulse/,
  "초집중 타이머 화면은 반복 점멸을 사용하지 않아야 합니다."
);
assert.match(appScript, /document\.body\.classList\.add\("timer-focus-active"\)/);
assert.match(appScript, /function getTemperatureAccent\(temp\)/);
assert.match(appScript, /function getSwitchPresentation\(switchState\)/);
assert.match(appScript, /닫힘 · 침출/);
assert.match(appScript, /열림 · 배출/);
assert.match(appScript, /function splitStageLabel\(name\)/);
assert.match(appScript, /function getTemperaturePreparation\(stages, stageIndex, elapsedSeconds\)/);
assert.match(appScript, /다음 단계 준비/);
assert.match(appScript, /function getStageActionEvent\(stage, stageIndex\)/);
assert.match(appScript, /스위치를 닫으세요/);
assert.match(appScript, /교반하고 스월링하세요/);
assert.match(appScript, /function playCue\(kind\)/);
assert.match(appScript, /function beginTimerPreparation\(\)/);
assert.match(appScript, /DRIP_NOTE_BREW_HISTORY/);
assert.match(appScript, /DRIP_NOTE_FAVORITES/);
assert.match(sourceCss, /@media \(prefers-reduced-motion: reduce\)/);

for (const buttonId of [
  "btn-sound-toggle",
  "btn-open-backup-modal",
  "btn-open-add-modal",
  "btn-bean-minus",
  "btn-bean-plus",
  "btn-type-hot",
  "btn-type-ice",
  "btn-start-brew",
  "btn-timer-stop",
  "btn-timer-toggle",
  "btn-timer-skip",
  "btn-toggle-favorite",
  "btn-large-timer-toggle",
  "btn-cancel-preparation",
  "btn-open-brew-history",
  "btn-save-taste",
  "btn-skip-taste"
]) {
  const button = html.match(new RegExp(`<button id="${buttonId}"[^>]*>`))?.[0] ?? "";
  assert.match(button, /(?:min-h-11|h-12)/, `${buttonId}: 터치 높이는 최소 44px여야 합니다.`);
}

assert.match(appScript, /confirm\("추출 타이머를 종료할까요\?/);
assert.match(html, /href="styles\.css\?v=3\.0\.0"/);
assert.match(sourceCss, /\.theme-option-active/);
assert.match(sourceCss, /html\.theme-transitioning/);
assert.doesNotMatch(html, /cdn\.tailwindcss\.com|tailwind\.config/);

console.log("한국어·확대·레이블·터치 영역·종료 확인 UX 검증 완료");
