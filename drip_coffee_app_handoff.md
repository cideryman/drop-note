# ☕ 드립노트 - 모바일 전용 드립 커피 비율 자동 계산기 & 타이머 앱 핸드오프 사양서

## 1. 프로젝트 개요 (Project Overview)
* **프로젝트명**: 드립노트 (모바일 전용 드립 커피 계산기 & 인터랙티브 타이머)
* **목적**: 드립 커피 추출 시 매번 원두량에 맞춰 투입 물량과 얼음량을 계산하는 번거로움을 자동화하고, 실시간 타이머와 누적 중량 가이드를 제공하여 일상 홈카페의 드립 품질과 편의성을 극대화함.
* **타겟 디바이스**: 모바일 전용 (Mobile-First responsive Web App / PWA)

---

## 2. 핵심 기능 명세 (Feature Specifications)

### ① 원두량 기반 자동 비율 계산 엔진
* **입력**: 사용자가 원하는 원두량 ($W_{input}$ g)
* **기준 레시피 데이터**: 기준 원두량 ($W_{base}$ g), 단계별 투입 물량 ($M_1, M_2, \dots$ g), 얼음량 ($I_{base}$ g, 아이스 시)
* **계산 로직**:
  $$\text{Ratio} = \frac{W_{input}}{W_{base}}$$
  $$\text{단계별 투입 물량}(g) = M_n \times \text{Ratio}$$
  $$\text{얼음량}(g) = I_{base} \times \text{Ratio}$$
* **고정 변수 (스케일링 금지)**:
  * 단계별 추출 시간 (Time)
  * 단계별 물 온도 (Water Temp °C)
  * 코만단테/일반 분쇄도 (Grind Size / Clicks)
  * 하리오 스위치 개폐 여부 (Switch Open/Close)

### ② 핫/아이스 분리 및 얼음량 자동 스케일링
* 핫 레시피: 전체 투입 물량만 단계별로 계산.
* 아이스 레시피: 서버/드립서버에 담아둘 얼음(g)을 원두 비율에 맞춰 별도 계산 및 화면에 굵게 명시.

### ③ 드립 추출 엣지 케이스 (Edge Case) 가이드
* **분쇄도 조정 팁**: 입력 원두량이 기준 대비 +15% 이상 커질 경우:
  * *"원두량이 많아 커피 층이 두꺼워졌습니다. 물 빠짐(Draw-down) 지연 방지를 위해 분쇄도를 1~2클릭 굵게 조절하세요."* 경고 카드 표시.

### ④ 인터랙티브 드립 타이머 & 저울 가이드 (Extraction Mode)
* **대형 타이머**: 분:초 (00:00) 실시간 스탑워치.
* **누적 중량(Cumulative Weight) 가이드**:
  * 저울을 보는 사용자를 위해 이번 단계 물량뿐만 아니라 **"저울 목표: 155g"** 형태의 누적 표시.
* **실시간 단계 하이라이트**: 현재 가이드 중인 단계 카드를 강조(Focus) 및 다음 단계 미리보기.
* **비프음/진동 알림**: 단계 전환 3초 전 카운트다운 비프음 알림.

### ⑤ 커스텀 레시피 관리 (Recipe Presets)
* 기본 프리셋 제공 (하리오 V60 4:6 카스야 테츠, 하리오 스위치 스위트 레시피, 제임스 호프만 푸어오버, 아이스 급랭 등)
* LocalStorage 기반 나만의 커스텀 레시피 추가/수정/삭제 (확장 가능 구조).

---

## 3. 데이터 구조 (Data Schema)

```json
{
  "id": "recipe_kasuya_46",
  "name": "하리오 V60 4:6 (카스야 테츠)",
  "type": "hot", // "hot" | "ice"
  "baseBeanWeight": 20, // 기준 원두량 (g)
  "grindSize": "코만단테 27클릭 (굵게)",
  "iceWeight": 0, // 아이스 기준 얼음량 (g)
  "notes": "단맛과 산미의 균형을 잡는 5단계 추출법",
  "stages": [
    { "step": 1, "timeSec": 45, "waterGrams": 60, "tempC": 92, "switch": "open", "desc": "1차 뜸들이기 (산미 결정)" },
    { "step": 2, "timeSec": 45, "waterGrams": 60, "tempC": 92, "switch": "open", "desc": "2차 주입 (단맛 결정)" },
    { "step": 3, "timeSec": 45, "waterGrams": 60, "tempC": 92, "switch": "open", "desc": "3차 주입 (바디감)" },
    { "step": 4, "timeSec": 45, "waterGrams": 60, "tempC": 92, "switch": "open", "desc": "4차 주입 (농도 조절)" },
    { "step": 5, "timeSec": 45, "waterGrams": 60, "tempC": 92, "switch": "open", "desc": "5차 주입 및 추출 완료" }
  ]
}
```

---

## 4. 모바일 UI/UX 디자인 요구사항 (Mobile UI Spec)

### 🎨 테마 & 스타일 룩앤필
* **컨셉**: Modern Coffee Lab Dark Mode & Glassmorphism
* **컬러 팔레트**:
  * Background: `#111315` (Deep Espresso Charcoal)
  * Surface/Card: `#1A1D20` (Glassmorphism border `#ffffff10`)
  * Accent Primary: `#E5A93B` (Warm Coffee Amber / Roasted Gold)
  * Text Primary: `#FFFFFF` / Secondary: `#9A9EA7`
  * Timer Accent: `#00E676` (Active Green)

---

## 5. 스티치(Stitch) / AI UI 제안 요청용 프롬프트 (Stitch Prompt Pack)

### 📌 [Stitch Prompt 1] 메인 계산기 & 원두량 입력 화면 (Main Calculator)
```text
Mobile app screen UI for a premium Pour-Over Coffee Calculator & Recipe Scaler.
Dark mode theme with deep espresso charcoal background (#111315), warm coffee amber accent (#E5A93B), and subtle glassmorphism cards.

Components:
1. Header: "드립노트" with recipe dropdown selector (Current: "테츠 카스야 · 4:6").
2. Input Card: Large bean weight input field (default 15.0g) with smooth [-] [+] stepper buttons and ratio indicator.
3. Summary Cards: 
   - Total Water: 225g
   - Ice Weight: 0g (Hot option selected)
   - Recommended Grind: Comandante 27 Clicks
   - Warning Banner: "Bean weight increased. Recommend +1 click coarser grind."
4. Step Breakdown List: Vertical cards showing Step 1 to 5 with Water (g), Temp (°C), Time (s), and Switch Open status.
5. Bottom Floating Action Button: Prominent amber "Start Brewing Timer" button spanning full width.

Clean iOS/Android mobile design, high readability font, modern aesthetics.
```

### 📌 [Stitch Prompt 2] 실시간 드립 타이머 & 저울 가이드 화면 (Live Brew Timer)
```text
Mobile app screen UI for a Live Coffee Brewing Assistant & Timer Mode.
Mobile-first full screen focus mode, dark mode (#111315) with vibrant active timer accent (#00E676) and golden amber (#E5A93B).

Components:
1. Top Bar: Progress bar showing overall extraction percentage (60% complete) and Step 3 of 5.
2. Center Hero: 
   - Huge digital stopwatch timer "00:32" in high-contrast bold font.
   - Scale Target display: "Target Scale Weight: 180g" in large clear numbers for easy viewing next to coffee scale.
3. Current Step Card (Highlighted with neon border):
   - Instruction: "Pour 60g Water now (92°C)"
   - Switch status icon: "Switch OPEN"
4. Next Step Preview Card: Semi-transparent card showing "Next: Step 4 - Pour 60g Water at 01:45".
5. Control Bar: Large Pause, Skip Step, and Stop buttons at the bottom for easy thumb access.
```

---

## 6. 📝 작업 기록 및 히스토리 (Activity & Change Log)

### 6.1 버전 및 변경 히스토리 (Changelog)

| 버전 | 일자 | 작업구분 | 주요 변경 내용 | 담당/작성자 |
|:---:|:---:|:---:|:---|:---:|
| `v1.0.0` | 2026-07-30 | 신규생성 | 초기 핸드오프 사양서 및 스티치(Stitch) 프롬프트 팩 작성 | Antigravity AI |
| `v1.1.0` | 2026-07-30 | 기능구현 | Stitch 디자인 100% 반영 Single Page Web App (`index.html`) 구축 | Antigravity AI |
| `v1.1.1` | 2026-07-30 | 기능추가 | Wake Lock(화면 꺼짐 방지), Web Audio Beep(3초전 알림), Target Scale Weight 연동 | Antigravity AI |
| `v1.1.2` | 2026-07-30 | 문서화 | 프로젝트 README.md 및 핸드오프 작업 기록 관리 체계 확립 | USER & Antigravity AI |
| `v1.2.0` | 2026-07-31 | 정확도 개선 | 기본 프리셋 수치·출처 교정, 아이스 기본 변환 규칙과 추출수/얼음 분리 표기 반영 | USER & Codex |
| `v1.2.1` | 2026-07-31 | 모드 개선 | 원본/앱 변형 배지, 출처·장비 정보, 최종 예상량 및 HOT/ICE 선택 규칙 반영 | USER & Codex |
| `v1.3.0` | 2026-07-31 | 타임라인 개선 | 절대 시각 단계 스키마, 선형/즉시/이벤트 가이드, 시간별 권장 저울 목표 및 레거시 마이그레이션 구현 | USER & Codex |
| `v1.4.0` | 2026-07-31 | 입력 안정성 | 실제 물량 기반 비율, 프리셋별 원두 범위, 커스텀 자동 비율 및 저장 전 유효성 검사 구현 | USER & Codex |
| `v1.5.0` | 2026-07-31 | 데이터 안전성 | 버전형 백업, JSON 스키마 검증, 안전한 문자열 렌더링 및 저장 실패 처리 구현 | USER & Codex |
| `v1.6.0` | 2026-07-31 | 명명 체계 | 프리셋 제작자·레시피명·도구 표시명 분리 및 기존 백업 이름 자동 이전 구현 | USER & Codex |
| `v1.7.0` | 2026-07-31 | 브랜드 확정 | 앱 표시 이름을 `드립노트`로 통일하고 PWA 후속 작업과 iOS 지원 범위를 로드맵에 추가 | USER & Codex |
| `v1.8.0` | 2026-07-31 | 타이머 안정성 | 실제 시각 기반 경과 시간, 일시정지·백그라운드 복원, 완료 상태와 Wake Lock 재요청 구현 | USER & Codex |
| `v1.9.0` | 2026-07-31 | 모바일 UX | 한국어 UI, 확대 허용, 접근 가능한 레이블·진행률·모달, 44px 터치 영역과 타이머 종료 확인 구현 | USER & Codex |
| `v2.0.0` | 2026-07-31 | PWA·레시피 편집 | 손상된 앱 로직 복구, 커스텀 HOT/ICE 추가·수정, 가이드 방식 저장, 설치 아이콘·오프라인 앱 셸 및 회귀 테스트 구현 | USER & Codex |
| `v2.1.0` | 2026-07-31 | 구조·배포 개선 | 단일 HTML 로직을 기능별 JavaScript로 분리하고 Tailwind Play CDN을 정적 CSS 빌드로 교체 | USER & Codex |

### 6.2 기능 구현 현황 (Feature Progress Tracker)

- [x] **원두량 비율 자동 스케일링 엔진**: 원두량 조절 시 물량 및 얼음량 즉시 재계산
- [x] **핫 / 아이스 탭 전환**: 아이스 전용 얼음 비중(35%) 자동 분리 계산
- [x] **스마트 분쇄도 조절 알림**: 원두량 20% 이상 변동 시 클릭 수 조절 가이드 팝업
- [x] **실시간 타이머 & 저울 누적 중량 가이드**: 00:00 스탑워치 및 전자저울 누적 목표 중량(g) 표시
- [x] **화면 꺼짐 방지 (Screen Wake Lock API)**: 타이머 실행 중 모바일 자동 화면 슬립 방지
- [x] **카운트다운 사운드/진동 (Web Audio API & Vibration)**: 3초 전 비프음 및 단계 전환음/진동
- [x] **PWA 설치 및 오프라인 앱 셸**: 매니페스트, SVG·PNG 설치 아이콘, 서비스 워커 캐시와 오프라인 재실행 검증 완료
- [x] **나만의 커스텀 레시피 추가/수정 폼**: HOT/ICE, 선형·즉시·동작 가이드, 수정·삭제 및 백업/복원 연동 완료
- [x] **프로덕션 CSS 및 코드 모듈화**: 정적 `styles.css` 빌드, 기능별 JavaScript 분리 및 오프라인 앱 셸 연결 완료

### 6.3 주요 기술적 의사결정 노트 (Decision Log)

1. **Web Audio Synthesizer (별도 MP3 파일 미사용)**
   - **결정 사유**: 외부 mp3 파일 로딩 지연 및 모바일 브라우저 오디오 자동 재생 제한(Autoplay Policy)을 방지하기 위해, HTML5 `AudioContext` 주파수 발진기(Oscillator)로 '띱-띱-띱-띵!' 사운드를 독자 합성 생성함.
2. **저울 중량 표시 UX (Cumulative Target)**
   - **결정 사유**: 홈카페 전자저울 사용 시 단계별 물 량만 표기하면 저울 계산을 머릿속으로 해야 함. 따라서 `Target Scale Weight` (누적 중량)을 크게 강조함.
3. **Screen Wake Lock Graceful Fallback**
   - **결정 사유**: 일부 구형 모바일 브라우저에서 `navigator.wakeLock` 미지원 시 에러가 발생하지 않도록 try-catch 안에서 안전하게 처리함.

### 6.4 디바이스 검증 및 QA 기록 (Verification Log)

* **테스트 디바이스**: Mobile Chrome, iOS Safari, PC Edge
* **검증 결과**:
  * [Pass] 원두량 조절 시 step별 물량 소수점 반올림 및 1:N 비율 정확도 100%
  * [Pass] 타이머 Pause / Resume / Skip Step 정상 작동
  * [Pass] Web Audio 비프음 및 모바일 진동(Vibration) 출력 확인
  * [Pass] 자동 회귀 테스트 6건: 계산·타임라인·백업·프리셋·UX·PWA
  * [Pass] 390px 모바일 화면에서 커스텀 아이스 생성·수정·중복 방지·문자열 안전 렌더링·타이머 진입 확인
  * [Pass] 로컬 서버 종료 후 서비스 워커 캐시만으로 앱 재실행 및 커스텀 레시피 복원 확인
  * [Pass] Tailwind 런타임 CDN 없이 정적 CSS 적용, 기능별 JavaScript 로드 및 모듈화된 앱 셸 오프라인 재실행 확인

---
*최종 업데이트: 2026-07-31 | 작성: USER, Antigravity AI & Codex*

---

## 7. 확정된 제품 결정 (2026-07-31)

### 7.1 시간에 따른 권장 저울 목표

추출 타이머는 현재 단계의 최종 누적 중량만 고정 표시하지 않고, 주입 구간에서는 시간 경과에 맞춘 **현재 권장 목표 중량**을 제공한다.

- `linear`: 정해진 주입 시간 동안 목표 중량을 선형으로 증가시킨다.
- `immediate`: 목표량을 짧은 시간에 주입한 뒤 단계 종료 시각까지 기다린다.
- `event`: 스월, 교반, 밸브 개폐처럼 물량이 없는 동작을 안내한다.

앱은 실제 저울값을 읽지 않으므로 `현재 중량`이 아니라 `현재 권장 목표`라는 표현을 사용한다. 데이터 구조에는 `startSec`, `pourEndSec`, `stepEndSec`, `targetWeight`, `guideMode`를 분리하여 저장한다.

예시:

```js
{
  startSec: 0,
  pourEndSec: 8,
  stepEndSec: 30,
  targetWeight: 40,
  guideMode: "linear"
}
```

### 7.2 공식 아이스 버전이 없는 레시피의 기본 변환

- 뜨거운 추출수는 원두 대비 `1:10`을 기본값으로 한다.
- 희석용 얼음은 원두 대비 `1:5`를 기본값으로 한다.
- 얼음이 모두 녹았을 때의 최종 설계 비율은 `1:15`가 된다.
- 이 규칙으로 만든 레시피에는 반드시 `앱 기본 아이스 변형`을 표시한다.
- 원두와 로스팅에 따라 분쇄도, 온도, 얼음량을 조정할 수 있도록 확장한다.

20g 원두 기준 예시:

```text
추출수       200g (1:10)
서버 얼음    100g (1:5)
최종 예상량  300g (1:15)
```

### 7.3 아이스 화면의 물량 표기

`Total Water`처럼 얼음 포함 여부가 불분명한 표현을 사용하지 않는다.

- 주 정보: `추출수`
- 별도 정보: `서버 얼음`
- 보조 정보: `최종 예상량`

타이머의 누적 저울 목표는 얼음을 제외한 뜨거운 추출수만 기준으로 한다.

### 7.4 기본 프리셋 출처 정책

- 원본 레시피는 제작자와 출처 URL을 기록한다.
- 원본을 비례 축소하거나 단계에 변형을 가한 경우 `앱 변형` 또는 구체적인 변형명을 표시한다.
- 출처가 없는 자체 레시피는 유명 레시피처럼 표현하지 않는다.

### 7.5 HOT/ICE 모드 선택 정책

- HOT 레시피에서 ICE를 선택했는데 공식 아이스 버전이 없으면 `앱 기본 아이스 변형` 배지를 표시하고 7.2의 기본 변환을 적용한다.
- 앱 변환은 기존 단계별 주입 비중을 유지하되, 뜨거운 추출수 합계를 원두 대비 `1:10`으로 다시 계산한다.
- 원본 출처가 있는 변형은 기준 레시피 출처를 계속 확인할 수 있게 한다.
- 독립 아이스 레시피에 연결된 HOT 버전이 없으면 HOT 버튼을 비활성화한다. 임의의 역변환은 만들지 않는다.
- 아이스 화면에는 `추출수`, `서버 얼음`, `최종 예상량`을 동시에 표시하고, 타이머의 마지막 누적 목표는 `추출수`와 일치시킨다.

### 7.6 절대 시각 타임라인 구현

단계의 `time`을 순서대로 더하던 구조를 폐기하고 다음 필드를 사용한다.

```js
{
  action: "pour",
  startSec: 45,
  pourEndSec: 75,
  stepEndSec: 75,
  guideMode: "linear"
}
```

- `startSec`: 단계 및 동작 시작 시각
- `pourEndSec`: 목표 물량 주입을 마쳐야 하는 시각
- `stepEndSec`: 다음 단계로 넘어가는 절대 시각
- `guideMode`: `linear`, `immediate`, `event` 중 하나
- `linear` 단계는 이전 누적 중량에서 새 누적 목표까지 시간에 따라 현재 권장 목표를 보간한다.
- `immediate` 단계는 최종 누적 목표를 즉시 표시하고 주입 이후 대기 시간을 안내한다.
- `event` 단계는 물을 추가하지 않고 스월, 교반, 밸브 개폐 등의 동작을 안내한다.
- 기존 커스텀 레시피의 `time` 값은 로딩 시 연속된 절대 타임라인으로 자동 변환하며, 0g 단계는 `event`로 처리한다.
- 단계 목록과 다음 단계 미리보기에는 상대적인 남은 시간 대신 `0:45`, `1:15` 같은 절대 시각을 표시한다.

### 7.7 실제 비율과 입력 검증 정책

- 추출 비율은 `단계별 추출수 합계 ÷ 원두량`으로 계산하며 사용자가 문자열로 입력하지 않는다.
- 단계별 물량 반올림으로 차이가 발생하면 마지막 물 주입 단계에서 보정하여 화면 추출수와 마지막 누적 목표를 항상 일치시킨다.
- 기본 프리셋은 레시피에 기록된 `recommendedDoseMin`–`recommendedDoseMax` 범위만 지원한다.
- 원두 입력은 0.5g 단위이며 범위를 벗어나거나 숫자가 아니면 기존 값으로 복원하고 이유를 표시한다.
- 증감 버튼은 레시피별 최소·최대 지점에서 비활성화한다.
- 커스텀 레시피의 비율 입력란은 제거하고 기준 원두량과 단계별 물량으로 실시간 계산한 비율을 미리 보여준다.
- 커스텀 레시피는 저장 전에 이름, 원두량, 단계 수, 물량, 온도, 시간, 스위치 상태와 전체 비율을 검사한다.

커스텀 레시피 허용 범위:

```text
레시피 이름       1–80자
기준 원두량       5–100g, 0.5g 단위
단계 수           1–20개
단계별 물량       0–1000g
온도              40–100℃
단계 시간         1–600초
전체 추출수       1–2000g
전체 추출 비율    1:5–1:25
```

### 7.8 백업 가져오기와 사용자 데이터 안전성

- 새 백업은 `format`, `version`, `exportedAt`, `recipes`를 가진 버전형 객체로 내보낸다.
- 이전 배열 형식 백업은 호환을 위해 계속 가져올 수 있다.
- 지원하지 않는 버전, 필수 필드 누락, 잘못된 숫자·시간·단계·URL은 저장 전에 거부한다.
- 가져온 레시피는 허용된 필드만 새 객체로 구성하고, 기존 ID와 충돌하면 새 ID를 부여한다.
- 레시피명과 단계명은 HTML로 해석하지 않고 `textContent`로 표시한다.
- LocalStorage 기록이 실패하면 성공 안내, 화면 갱신, 기존 데이터 교체를 진행하지 않는다.
- 파일 읽기 또는 검증 실패 후 기존 커스텀 레시피는 그대로 유지한다.

### 7.9 프리셋 명명과 표시 정책

- 레시피 데이터는 `creator`, `recipeName`, `equipment`, `equipmentLabel`, `variantLabel`을 분리하여 저장한다.
- 제작자가 있으면 선택 목록 제목을 `제작자 · 레시피 이름`으로 조합한다.
- 제작자가 없으면 레시피 이름만 표시하며 임의의 사람이나 앱 이름을 붙이지 않는다.
- 장비와 원본/변형 정보는 제목에 반복하지 않고 각각 별도 표시한다.

기본 프리셋 표시:

```text
테츠 카스야 · 4:6        / V60    / 원본 균형형
테츠 카스야 · Devil      / Switch / 원본 재현
제임스 호프만 · Ultimate / V60    / 15g 비례 축소
아이스 기본형             / V60    / 앱 기본 아이스 변형
```

- 과거 백업에 `name`만 있으면 이를 `recipeName`으로 자동 이전하고 `creator`는 비워둔다.
- 조합된 화면 제목은 기본 프리셋 데이터에 중복 저장하지 않는다.

### 7.10 앱 이름과 iOS PWA 범위

- 사용자에게 표시하는 공식 앱 이름은 `드립노트`로 통일한다.
- 기존 LocalStorage 키는 이름을 변경하면 저장된 레시피가 사라질 수 있으므로 호환성을 위해 유지한다.
- PWA는 홈 화면 설치, 독립 실행, 오프라인 앱 셸과 기본 프리셋 제공을 목표로 한다.
- iOS에서 앱이 백그라운드로 이동하면 웹 타이머의 연속 실행을 보장하지 않는다. 복귀 시 절대 시작 시각을 기준으로 현재 단계와 남은 시간을 복원한다.
- 홈 화면에 설치한 웹 앱은 사용자 권한과 서버 구성이 있을 때 Web Push 알림을 사용할 수 있다.
- Dynamic Island의 지속 타이머 표시는 PWA 범위가 아니라 ActivityKit과 WidgetKit을 사용하는 네이티브 iOS 기능으로 분류한다.

### 7.11 실제 시각 기반 타이머 정책

- 타이머 경과 시간은 `setInterval()` 호출 횟수가 아니라 실행을 시작한 실제 시각과 현재 시각의 차이로 계산한다.
- 인터벌은 화면 갱신을 요청하는 역할만 하며, 콜백이 늦거나 여러 번 생략되어도 경과 시간에는 영향을 주지 않는다.
- 일시정지할 때까지의 밀리초를 별도로 누적하고, 재개 시 새 기준 시각을 설정하여 멈춰 있던 시간을 제외한다.
- 앱이 숨겨지면 불필요한 화면 갱신 인터벌과 Wake Lock을 해제한다.
- 화면이 다시 보이면 즉시 실제 경과 시간을 계산하고 현재 단계·남은 시간·진행률을 복원한 뒤 Wake Lock을 다시 요청한다.
- 단계 건너뛰기는 선택한 단계의 절대 시작 시각을 새 경과 기준으로 설정한다.
- 완료 처리는 한 번만 실행하며 인터벌을 제거하고 Resume·Skip 버튼을 비활성화한다.
- 소리, 진동, Wake Lock을 지원하지 않는 환경에는 복귀 시 시간 자동 보정이 적용된다는 안내를 표시한다.

### 7.12 모바일 인터페이스와 접근성

- 사용자에게 보이는 주요 문구를 한국어로 통일하고 `HOT`, `ICE`, `STEP`, 타이머 제어 문구도 핫·아이스·단계·일시정지·다시 시작으로 표시한다.
- viewport의 확대 금지 설정을 제거하여 iPhone에서 화면 확대를 사용할 수 있게 한다.
- 레시피, 원두량, 커스텀 레시피 입력에 연결된 label 또는 접근 가능한 이름을 제공한다.
- 아이콘 전용 버튼에는 용도를 설명하는 `aria-label`을 제공한다.
- 모달에는 dialog 역할, 제목 연결과 열림 상태를 제공하고 열린 뒤 첫 입력으로 초점을 이동한다.
- 추출 진행 막대는 0%에서 시작하며 화면 표시와 함께 접근성 진행 값도 갱신한다.
- 주요 모바일 버튼과 입력의 높이는 최소 44px로 유지한다.
- 아직 구현하지 않은 레시피·기록 하단 메뉴는 화면에서 숨긴다.
- 진행 중인 타이머를 종료할 때 확인을 받고, 취소하면 기존 진행 상태를 유지한다.
