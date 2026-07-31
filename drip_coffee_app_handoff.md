# ☕ PourOver Pro - 모바일 전용 드립 커피 비율 자동 계산기 & 타이머 앱 핸드오프 사양서

## 1. 프로젝트 개요 (Project Overview)
* **프로젝트명**: PourOver Pro (모바일 전용 드립 커피 계산기 & 인터랙티브 타이머)
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
1. Header: "PourOver Pro" with recipe dropdown selector (Current: "Hario V60 4:6 Kasuya Recipe").
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

### 6.2 기능 구현 현황 (Feature Progress Tracker)

- [x] **원두량 비율 자동 스케일링 엔진**: 원두량 조절 시 물량 및 얼음량 즉시 재계산
- [x] **핫 / 아이스 탭 전환**: 아이스 전용 얼음 비중(35%) 자동 분리 계산
- [x] **스마트 분쇄도 조절 알림**: 원두량 20% 이상 변동 시 클릭 수 조절 가이드 팝업
- [x] **실시간 타이머 & 저울 누적 중량 가이드**: 00:00 스탑워치 및 전자저울 누적 목표 중량(g) 표시
- [x] **화면 꺼짐 방지 (Screen Wake Lock API)**: 타이머 실행 중 모바일 자동 화면 슬립 방지
- [x] **카운트다운 사운드/진동 (Web Audio API & Vibration)**: 3초 전 비프음 및 단계 전환음/진동
- [ ] **PWA 매니페스트 (pwa manifest.json)**: 홈 화면 앱 추가 및 오프라인 동작 아이콘 지원 (다음 단계)
- [ ] **나만의 커스텀 레시피 추가 폼**: 사용자가 폼에서 직접 레시피를 생성/저장하는 기능 (다음 단계)

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
