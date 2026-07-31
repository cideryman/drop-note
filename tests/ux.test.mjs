import assert from "node:assert/strict";
import fs from "node:fs";
import { loadAppScript } from "./load-app-script.mjs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
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
assert.match(html, /id="btn-open-backup-modal"[^>]*aria-label=/);
assert.match(html, /id="btn-close-modal"[^>]*aria-label=/);
assert.match(html, /id="btn-close-backup-modal"[^>]*aria-label=/);
assert.match(html, /id="btn-timer-stop"[^>]*aria-label=/);
assert.match(html, /id="btn-timer-toggle"[^>]*aria-label=/);
assert.match(html, /id="btn-timer-skip"[^>]*aria-label=/);

assert.match(html, /id="modal-add-recipe"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="modal-backup"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="timer-progress-bar"[^>]*role="progressbar"[^>]*aria-valuenow="0"/);
assert.match(html, /id="timer-progress-bar"[^>]*style="width: 0%"/);

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
  "btn-timer-skip"
]) {
  const button = html.match(new RegExp(`<button id="${buttonId}"[^>]*>`))?.[0] ?? "";
  assert.match(button, /(?:min-h-11|h-12)/, `${buttonId}: 터치 높이는 최소 44px여야 합니다.`);
}

assert.match(appScript, /confirm\("추출 타이머를 종료할까요\?/);
assert.match(html, /href="styles\.css"/);
assert.doesNotMatch(html, /cdn\.tailwindcss\.com|tailwind\.config/);

console.log("한국어·확대·레이블·터치 영역·종료 확인 UX 검증 완료");
