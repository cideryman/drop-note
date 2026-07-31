"use strict";

// Audio cues, timer state, background recovery, and Wake Lock.
let wakeLock = null;
let wakeLockRequestPending = false;

// Timer State
let timerInterval = null;
let timerRunning = false;
let timerCompleted = false;
let timerRunStartedAtMs = null;
let timerElapsedBeforeRunMs = 0;
let timerLastCountdownSecond = null;
let totalSecondsElapsed = 0;
let currentStepIndex = 0;
let stepTimeRemaining = 0;
// Web Audio Synthesizer
let audioCtx = null;
try {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = AudioContextClass ? new AudioContextClass() : null;
} catch (error) {
  console.warn("오디오 알림을 초기화하지 못했습니다:", error);
}

function playBeep(freq = 880, duration = 0.15, type = 'sine') {
  if (!soundEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.log('Audio error:', e);
  }
}
// --- TIMER ENGINE & LIVE VIEW ---
function getTotalBrewTime() {
  return scaledStages.reduce((max, stage) => Math.max(max, stage.stepEndSec), 0);
}

function getCurrentTimeMs() {
  return Date.now();
}

function getTimerElapsedMs(nowMs = getCurrentTimeMs()) {
  if (!timerRunning || timerRunStartedAtMs === null) {
    return timerElapsedBeforeRunMs;
  }
  return timerElapsedBeforeRunMs + Math.max(0, nowMs - timerRunStartedAtMs);
}

function syncTimerStepToElapsed() {
  const nextStepIndex = scaledStages.findIndex(stage => totalSecondsElapsed < stage.stepEndSec);
  if (nextStepIndex < 0) return false;

  currentStepIndex = nextStepIndex;
  stepTimeRemaining = Math.max(0, scaledStages[currentStepIndex].stepEndSec - totalSecondsElapsed);
  return true;
}

function startTimerView() {
  if (scaledStages.length === 0) return;

  document.getElementById("view-calculator").classList.add("hidden");
  document.getElementById("calculator-action-bar").classList.add("hidden");

  document.getElementById("view-timer").classList.remove("hidden");
  document.getElementById("timer-control-bar").classList.remove("hidden");

  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerCompleted = false;
  timerRunStartedAtMs = null;
  timerElapsedBeforeRunMs = 0;
  timerLastCountdownSecond = null;
  totalSecondsElapsed = 0;
  currentStepIndex = 0;
  stepTimeRemaining = scaledStages[0].stepEndSec;

  resetTimerControls();
  updateTimerCapabilityStatus();
  renderTimerStep();
  startTimerInterval();
}

function stopTimerView() {
  const needsConfirmation = !timerCompleted && (timerRunning || totalSecondsElapsed > 0);
  if (needsConfirmation && !confirm("추출 타이머를 종료할까요? 현재 진행 상황은 저장되지 않습니다.")) {
    return false;
  }

  releaseWakeLock();
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerCompleted = false;
  timerRunStartedAtMs = null;
  timerElapsedBeforeRunMs = 0;
  timerLastCountdownSecond = null;

  document.getElementById("view-timer").classList.add("hidden");
  document.getElementById("timer-control-bar").classList.add("hidden");

  document.getElementById("view-calculator").classList.remove("hidden");
  document.getElementById("calculator-action-bar").classList.remove("hidden");
  return true;
}

function scheduleTimerTicks() {
  clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 250);
}

function startTimerInterval(nowMs = getCurrentTimeMs()) {
  if (timerRunning || timerCompleted) return false;

  timerRunStartedAtMs = nowMs;
  timerRunning = true;
  timerLastCountdownSecond = null;
  updatePlayPauseButtonUI();
  document.getElementById("timer-status-badge").textContent = "추출 중";
  document.getElementById("timer-status-badge").className = "font-mono text-xs text-brew-green font-bold tracking-widest animate-pulse-slow";
  scheduleTimerTicks();
  requestWakeLock();
  if (timerElapsedBeforeRunMs === 0) playBeep(880, 0.2);
  return true;
}

function timerTick(nowMs = getCurrentTimeMs()) {
  if (!timerRunning || timerCompleted) return false;

  const previousStepIndex = currentStepIndex;
  const totalBrewTime = getTotalBrewTime();
  const elapsedMs = getTimerElapsedMs(nowMs);
  totalSecondsElapsed = Math.min(totalBrewTime, Math.floor(elapsedMs / 1000));

  if (totalSecondsElapsed >= totalBrewTime || !syncTimerStepToElapsed()) {
    finishBrewing();
    return false;
  }

  if (currentStepIndex !== previousStepIndex) {
    timerLastCountdownSecond = null;
    playBeep(1200, 0.3);
    if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
  } else if (
    stepTimeRemaining <= 3 &&
    stepTimeRemaining > 0 &&
    timerLastCountdownSecond !== stepTimeRemaining
  ) {
    timerLastCountdownSecond = stepTimeRemaining;
    playBeep(600, 0.1);
    if (navigator.vibrate) navigator.vibrate(100);
  }

  renderTimerStep();
  return true;
}

function pauseTimer(nowMs = getCurrentTimeMs()) {
  if (!timerRunning || timerCompleted) return false;

  timerElapsedBeforeRunMs = getTimerElapsedMs(nowMs);
  timerRunStartedAtMs = null;
  timerRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  releaseWakeLock();

  const totalBrewTime = getTotalBrewTime();
  totalSecondsElapsed = Math.min(totalBrewTime, Math.floor(timerElapsedBeforeRunMs / 1000));
  if (totalSecondsElapsed >= totalBrewTime || !syncTimerStepToElapsed()) {
    finishBrewing();
    return false;
  }

  document.getElementById("timer-status-badge").textContent = "일시정지";
  document.getElementById("timer-status-badge").className = "font-mono text-xs text-primary font-bold tracking-widest";
  updatePlayPauseButtonUI();
  renderTimerStep();
  return true;
}

function toggleTimerPlayPause() {
  if (timerCompleted) return;
  if (timerRunning) {
    pauseTimer();
  } else {
    startTimerInterval();
  }
}

function updatePlayPauseButtonUI() {
  const icon = document.getElementById("timer-toggle-icon");
  const text = document.getElementById("timer-toggle-text");
  const btn = document.getElementById("btn-timer-toggle");

  if (timerCompleted) {
    icon.textContent = "check";
    text.textContent = "추출 완료";
    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
    btn.setAttribute("aria-label", "추출 완료");
    btn.className = "min-h-11 flex-grow flex items-center justify-center gap-2 bg-surface-container-highest text-on-surface-variant py-3.5 px-6 rounded-2xl font-mono font-bold opacity-60 cursor-not-allowed";
    return;
  }

  btn.disabled = false;
  btn.setAttribute("aria-disabled", "false");
  if (timerRunning) {
    icon.textContent = "pause";
    text.textContent = "일시정지";
    btn.setAttribute("aria-label", "추출 타이머 일시정지");
    btn.className = "min-h-11 flex-grow flex items-center justify-center gap-2 bg-brew-amber text-surface-dim py-3.5 px-6 rounded-2xl font-mono font-bold shadow-lg shadow-brew-amber/20 active:scale-[0.98] transition-all";
  } else {
    icon.textContent = "play_arrow";
    text.textContent = "다시 시작";
    btn.setAttribute("aria-label", "추출 타이머 다시 시작");
    btn.className = "min-h-11 flex-grow flex items-center justify-center gap-2 bg-brew-green text-surface-dim py-3.5 px-6 rounded-2xl font-mono font-bold shadow-lg shadow-brew-green/20 active:scale-[0.98] transition-all";
  }
}

function resetTimerControls() {
  const skipButton = document.getElementById("btn-timer-skip");
  skipButton.disabled = false;
  skipButton.setAttribute("aria-disabled", "false");
  skipButton.classList.remove("opacity-40", "cursor-not-allowed");
  updatePlayPauseButtonUI();
}

function skipToNextStep() {
  if (timerCompleted) return false;
  if (currentStepIndex < scaledStages.length - 1) {
    currentStepIndex++;
    totalSecondsElapsed = scaledStages[currentStepIndex].startSec;
    timerElapsedBeforeRunMs = totalSecondsElapsed * 1000;
    if (timerRunning) timerRunStartedAtMs = getCurrentTimeMs();
    stepTimeRemaining = scaledStages[currentStepIndex].stepEndSec - totalSecondsElapsed;
    timerLastCountdownSecond = null;
    playBeep(1000, 0.15);
    renderTimerStep();
    return true;
  } else {
    finishBrewing();
    return false;
  }
}

function finishBrewing() {
  if (timerCompleted) return false;

  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerCompleted = true;
  timerRunStartedAtMs = null;
  totalSecondsElapsed = getTotalBrewTime();
  timerElapsedBeforeRunMs = totalSecondsElapsed * 1000;
  stepTimeRemaining = 0;
  currentStepIndex = Math.max(0, scaledStages.length - 1);
  releaseWakeLock();
  playBeep(1500, 0.5, 'triangle');
  if (navigator.vibrate) navigator.vibrate([200, 100, 300]);

  document.getElementById("timer-display").textContent = "완료";
  document.getElementById("timer-status-badge").textContent = "추출 완료";
  document.getElementById("timer-status-badge").className = "font-mono text-xs text-primary font-bold tracking-widest";
  document.getElementById("timer-instruction").textContent = "☕ 맛있는 드립 커피가 완성되었습니다!";
  document.getElementById("timer-progress-bar").style.width = "100%";
  document.getElementById("timer-progress-bar").setAttribute("aria-valuenow", "100");
  document.getElementById("timer-step-counter").textContent = `${scaledStages.length}/${scaledStages.length}단계`;
  const skipButton = document.getElementById("btn-timer-skip");
  skipButton.disabled = true;
  skipButton.setAttribute("aria-disabled", "true");
  skipButton.classList.add("opacity-40", "cursor-not-allowed");
  updatePlayPauseButtonUI();
  return true;
}

function renderTimerStep() {
  const st = scaledStages[currentStepIndex];
  const totalSteps = scaledStages.length;

  document.getElementById("timer-display").textContent = formatBrewTime(totalSecondsElapsed).padStart(5, "0");

  const totalBrewTime = getTotalBrewTime();
  const progressPct = totalBrewTime > 0
    ? Math.min(100, Math.round((totalSecondsElapsed / totalBrewTime) * 100))
    : 0;
  document.getElementById("timer-progress-bar").style.width = `${progressPct}%`;
  document.getElementById("timer-progress-bar").setAttribute("aria-valuenow", progressPct.toString());
  document.getElementById("timer-step-counter").textContent = `${currentStepIndex + 1}/${totalSteps}단계`;

  const guidedTarget = getGuidedTarget(st, totalSecondsElapsed);
  document.getElementById("timer-target-scale").textContent = guidedTarget;
  document.getElementById("timer-step-water").textContent = st.scaledWater > 0
    ? `+${st.scaledWater}g`
    : "물 주입 없음";

  document.getElementById("timer-step-title").textContent = `${st.step}단계 (${st.name})`;
  const isPouring = st.scaledWater > 0 && totalSecondsElapsed < st.pourEndSec;
  if (isPouring && st.guideMode === "linear") {
    setTimerInstruction([
      { text: `${formatBrewTime(st.pourEndSec)}까지 ${st.cumulativeTarget}g`, emphasized: true },
      { text: "에 맞춰 주입하세요" }
    ]);
  } else if (isPouring) {
    setTimerInstruction([
      { text: `${st.cumulativeTarget}g`, emphasized: true },
      { text: "까지 바로 주입하세요" }
    ]);
  } else if (st.scaledWater > 0) {
    setTimerInstruction([
      { text: "주입 완료 · " },
      { text: formatBrewTime(st.stepEndSec), emphasized: true },
      { text: `까지 ${st.name}` }
    ]);
  } else {
    document.getElementById("timer-instruction").textContent = st.name;
  }
  document.getElementById("timer-step-temp").textContent = `${st.temp}°C`;
  const switchContainer = document.getElementById("timer-step-switch-container");
  if (currentRecipe.equipment === "Hario Switch") {
    switchContainer.classList.remove("hidden");
    document.getElementById("timer-step-switch").textContent = `스위치 ${formatSwitchState(st.switch)}`;
  } else {
    switchContainer.classList.add("hidden");
  }

  if (currentStepIndex < totalSteps - 1) {
    const nextSt = scaledStages[currentStepIndex + 1];
    document.getElementById("timer-next-label").textContent = `다음: ${nextSt.step}단계`;
    document.getElementById("timer-next-desc").textContent = nextSt.scaledWater > 0
      ? `${nextSt.name} · +${nextSt.scaledWater}g`
      : nextSt.name;
    document.getElementById("timer-next-time").textContent = `${formatBrewTime(nextSt.startSec)} 시작`;
  } else {
    document.getElementById("timer-next-label").textContent = "다음: 추출 완료";
    document.getElementById("timer-next-desc").textContent = "추출 완료 및 서버 정리";
    document.getElementById("timer-next-time").textContent = `${formatBrewTime(st.stepEndSec)} 완료`;
  }
}

function setTimerInstruction(parts) {
  const container = document.getElementById("timer-instruction");
  container.textContent = "";
  parts.forEach(part => {
    appendTextElement(
      container,
      "span",
      part.emphasized ? "text-brew-green font-black" : "",
      part.text
    );
  });
}

// --- WAKE LOCK API ---
function updateTimerCapabilityStatus(message = "") {
  const status = document.getElementById("timer-capability-status");
  if (message) {
    status.textContent = message;
    return;
  }

  const unavailable = [];
  if (!audioCtx) unavailable.push("소리");
  if (!("vibrate" in navigator)) unavailable.push("진동");
  if (!("wakeLock" in navigator)) unavailable.push("화면 꺼짐 방지");
  status.textContent = unavailable.length > 0
    ? `${unavailable.join("·")} 미지원 · 복귀 시 시간 자동 보정`
    : "화면 꺼짐 방지 사용 · 복귀 시 시간 자동 보정";
}

function handleTimerVisibilityChange() {
  if (!timerRunning || timerCompleted) return;

  if (document.visibilityState === "hidden") {
    clearInterval(timerInterval);
    timerInterval = null;
    releaseWakeLock();
    updateTimerCapabilityStatus("백그라운드 진입 · 복귀 시 실제 경과 시간으로 보정");
    return;
  }

  if (document.visibilityState === "visible") {
    timerTick();
    if (timerRunning && !timerCompleted) {
      scheduleTimerTicks();
      requestWakeLock();
      updateTimerCapabilityStatus();
    }
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    updateTimerCapabilityStatus();
    return false;
  }
  if (wakeLock) return true;
  if (wakeLockRequestPending) return false;

  wakeLockRequestPending = true;
  try {
    const requestedLock = await navigator.wakeLock.request("screen");
    if (!timerRunning || timerCompleted || document.visibilityState === "hidden") {
      await requestedLock.release();
      return false;
    }
    wakeLock = requestedLock;
    if (typeof requestedLock.addEventListener === "function") {
      requestedLock.addEventListener("release", () => {
        if (wakeLock === requestedLock) wakeLock = null;
      });
    }
    updateTimerCapabilityStatus();
    return true;
  } catch (err) {
    console.warn("화면 꺼짐 방지를 사용할 수 없습니다:", err);
    updateTimerCapabilityStatus("화면 꺼짐 방지 실패 · 복귀 시 시간 자동 보정");
    return false;
  } finally {
    wakeLockRequestPending = false;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  const lockToRelease = wakeLock;
  wakeLock = null;
  try {
    await lockToRelease.release();
  } catch (err) {
    console.warn("화면 꺼짐 방지 해제에 실패했습니다:", err);
  }
}

