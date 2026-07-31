import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "manifest.json"), "utf8"));
const worker = fs.readFileSync(path.join(rootDir, "service-worker.js"), "utf8");
const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");

test("PWA 매니페스트가 설치 범위와 필수 아이콘을 제공한다", () => {
  assert.equal(manifest.name, "드립노트");
  assert.equal(manifest.id, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");

  for (const filename of ["icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"]) {
    const iconPath = path.join(rootDir, filename);
    assert.equal(fs.existsSync(iconPath), true, `${filename} 파일이 필요합니다.`);
    assert.ok(fs.statSync(iconPath).size > 0, `${filename} 파일이 비어 있습니다.`);
  }
});

test("앱 셸과 서비스 워커 등록이 연결되어 있다", () => {
  assert.match(html, /rel="manifest" href="manifest\.json"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="icon-180\.png"/);
  assert.match(html, /navigator\.serviceWorker\.register\("\.\/service-worker\.js"\)/);

  for (const filename of ["index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"]) {
    assert.match(worker, new RegExp(filename.replace(".", "\\.")));
  }
  assert.match(worker, /cache\.startsWith\('drip-note-'\)/);
});

console.log("PWA 매니페스트·아이콘·앱 셸 연결 검증 완료");
