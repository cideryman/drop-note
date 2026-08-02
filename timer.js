"use strict";

// Audio cues, timer state, background recovery, and Wake Lock.
let wakeLock = null;
let wakeLockRequestPending = false;

// Timer State
let timerInterval = null;
let timerRunning = false;
let timerCompleted = false;
let timerPhase = "idle";
let timerRunStartedAtMs = null;
let timerElapsedBeforeRunMs = 0;
let timerLastCountdownSecond = null;
let totalSecondsElapsed = 0;
let currentStepIndex = 0;
let stepTimeRemaining = 0;
let shownActionEventKeys = new Set();
let actionBannerFadeTimer = null;
let actionBannerHideTimer = null;
let preparationInterval = null;
let preparationCountdown = 3;
let skipConfirmationUntil = 0;
let skipConfirmationTimer = null;
let scheduledCueTimers = [];
// Web Audio Synthesizer
let audioCtx = null;
try {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = AudioContextClass ? new AudioContextClass() : null;
} catch (error) {
  console.warn("오디오 알림을 초기화하지 못했습니다:", error);
}

function unlockAudio() {
  if (!soundEnabled || !audioCtx || audioCtx.state !== "suspended") return;
  try {
    const resumeResult = audioCtx.resume();
    resumeResult?.catch?.(() => {});
  } catch (_) {}
}

function playTone(freq = 880, duration = 0.15, type = "sine", delayMs = 0) {
  if (!soundEnabled || !audioCtx) return;
  const play = () => {
    try {
      unlockAudio();
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
    } catch (error) {
      console.log("Audio error:", error);
    }
  };
  if (delayMs > 0) {
    scheduledCueTimers.push(setTimeout(play, delayMs));
  } else {
    play();
  }
}

function clearScheduledCues() {
  scheduledCueTimers.forEach(clearTimeout);
  scheduledCueTimers = [];
}

function playCue(kind) {
  const cue = {
    preparation: [[660, 0.1, "sine", 0]],
    start: [[1040, 0.22, "sine", 0]],
    warning: [[600, 0.1, "sine", 0]],
    stage: [[1200, 0.25, "sine", 0]],
    temperature: [[760, 0.11, "sine", 0], [980, 0.11, "sine", 150]],
    action: [[900, 0.1, "sine", 0], [650, 0.1, "sine", 140]],
    complete: [[1500, 0.5, "triangle", 0]],
    confirm: [[1000, 0.12, "sine", 0]]
  }[kind];
  if (!cue) return false;
  cue.forEach(([freq, duration, type, delay]) => playTone(freq, duration, type, delay));
  return true;
}

function playBeep(freq = 880, duration = 0.15, type = "sine") {
  // Legacy helper retained for recipe save/export feedback.
  try {
    playTone(freq, duration, type);
  } catch (_) {}
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
  unlockAudio();

  document.body.classList.add("timer-focus-active");
  document.getElementById("view-calculator").classList.add("hidden");
  document.getElementById("calculator-action-bar").classList.add("hidden");

  document.getElementById("view-timer").classList.remove("hidden");
  document.getElementById("timer-control-bar").classList.add("hidden");

  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerCompleted = false;
  timerPhase = "preparing";
  timerRunStartedAtMs = null;
  timerElapsedBeforeRunMs = 0;
  timerLastCountdownSecond = null;
  shownActionEventKeys = new Set();
  hideActionBanner(true);
  totalSecondsElapsed = 0;
  currentStepIndex = 0;
  stepTimeRemaining = scaledStages[0].stepEndSec;

  resetTimerControls();
  updateTimerCapabilityStatus();
  renderTimerStep();
  beginTimerPreparation();
}

function getPreparationSummary() {
  const temperatures = [...new Set(scaledStages.map(stage => stage.temp))];
  const waterText = isIceMode
    ? `추출수 ${scaledTotalWater}g · 얼음 ${scaledIceWeight}g`
    : `추출수 ${scaledTotalWater}g`;
  return {
    title: getRecipeDisplayName(currentRecipe),
    dose: `원두 ${currentBeanWeight}g · ${waterText}`,
    grind: currentRecipe.grindBase,
    temperature: temperatures.length > 1
      ? `물 온도 ${temperatures.join(" → ")}°C`
      : `물 온도 ${temperatures[0]}°C`
  };
}

function renderPreparationCountdown(value) {
  const summary = getPreparationSummary();
  document.getElementById("preparation-recipe-name").textContent = summary.title;
  document.getElementById("preparation-dose").textContent = summary.dose;
  document.getElementById("preparation-grind").textContent = summary.grind;
  document.getElementById("preparation-temperature").textContent = summary.temperature;
  const countdown = document.getElementById("preparation-countdown");
  countdown.textContent = String(value);
  countdown.classList.remove("preparation-countdown");
  void countdown.offsetWidth;
  countdown.classList.add("preparation-countdown");
  document.getElementById("preparation-status").textContent = value > 1 ? "주전자와 저울을 준비하세요" : "첫 주입을 준비하세요";
}

function beginTimerPreparation() {
  clearInterval(preparationInterval);
  clearScheduledCues();
  preparationCountdown = 3;
  timerPhase = "preparing";
  timerRunning = false;
  timerCompleted = false;
  document.getElementById("timer-preparation-panel").classList.remove("hidden");
  document.getElementById("timer-preparation-panel").classList.add("flex");
  document.getElementById("timer-control-bar").classList.add("hidden");
  renderPreparationCountdown(preparationCountdown);
  playCue("preparation");
  preparationInterval = setInterval(advanceTimerPreparation, 1000);
}

function advanceTimerPreparation() {
  if (timerPhase !== "preparing") return false;
  preparationCountdown -= 1;
  if (preparationCountdown > 0) {
    renderPreparationCountdown(preparationCountdown);
    playCue("preparation");
    return true;
  }
  clearInterval(preparationInterval);
  preparationInterval = null;
  document.getElementById("preparation-countdown").textContent = "시작";
  document.getElementById("preparation-status").textContent = "첫 주입을 시작하세요";
  document.getElementById("timer-preparation-panel").classList.add("hidden");
  document.getElementById("timer-preparation-panel").classList.remove("flex");
  document.getElementById("timer-control-bar").classList.remove("hidden");
  return startTimerInterval();
}

function cancelTimerPreparation(message = "") {
  if (timerPhase !== "preparing") return false;
  clearInterval(preparationInterval);
  preparationInterval = null;
  clearScheduledCues();
  stopTimerView({ skipConfirmation: true });
  if (message) updateTimerCapabilityStatus(message);
  return true;
}

function restartSameBrew() {
  if (timerPhase !== "completed") return false;
  closeTasteEvaluation();
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerCompleted = false;
  timerRunStartedAtMs = null;
  timerElapsedBeforeRunMs = 0;
  totalSecondsElapsed = 0;
  currentStepIndex = 0;
  stepTimeRemaining = scaledStages[0].stepEndSec;
  shownActionEventKeys = new Set();
  resetTimerControls();
  renderTimerStep();
  beginTimerPreparation();
  return true;
}

function stopTimerView(options = {}) {
  const needsConfirmation = !options.skipConfirmation && !timerCompleted && (timerRunning || totalSecondsElapsed > 0);
  if (needsConfirmation && !confirm("추출 타이머를 종료할까요? 현재 진행 상황은 저장되지 않습니다.")) {
    return false;
  }

  releaseWakeLock();
  clearInterval(timerInterval);
  clearInterval(preparationInterval);
  timerInterval = null;
  preparationInterval = null;
  clearScheduledCues();
  clearSkipConfirmation();
  timerRunning = false;
  timerCompleted = false;
  timerPhase = "idle";
  timerRunStartedAtMs = null;
  timerElapsedBeforeRunMs = 0;
  timerLastCountdownSecond = null;
  shownActionEventKeys = new Set();
  hideActionBanner(true);
  document.getElementById("timer-preparation-panel").classList.add("hidden");
  document.getElementById("timer-preparation-panel").classList.remove("flex");
  document.body.classList.remove("timer-focus-active");

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

  const isFreshStart = timerElapsedBeforeRunMs === 0 && timerPhase === "preparing";
  timerRunStartedAtMs = nowMs;
  timerRunning = true;
  timerPhase = "running";
  timerLastCountdownSecond = null;
  updatePlayPauseButtonUI();
  document.getElementById("timer-status-badge").textContent = "추출 중";
  document.getElementById("timer-status-badge").className = "font-mono text-xs text-brew-green font-bold tracking-widest";
  scheduleTimerTicks();
  requestWakeLock();
  if (isFreshStart) {
    playCue("start");
    recordRecentRecipeUse();
  }
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
    const previousStage = scaledStages[previousStepIndex];
    const currentStage = scaledStages[currentStepIndex];
    const actionEvent = getStageActionEvent(currentStage, currentStepIndex);
    if (previousStage && previousStage.temp !== currentStage.temp) {
      playCue("temperature");
    } else if (actionEvent) {
      playCue("action");
    } else {
      playCue("stage");
    }
    if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
  } else if (
    stepTimeRemaining <= 3 &&
    stepTimeRemaining > 0 &&
    timerLastCountdownSecond !== stepTimeRemaining
  ) {
    timerLastCountdownSecond = stepTimeRemaining;
    playCue("warning");
    if (navigator.vibrate) navigator.vibrate(100);
  }

  renderTimerStep(elapsedMs / 1000);
  return true;
}

function pauseTimer(nowMs = getCurrentTimeMs()) {
  if (!timerRunning || timerCompleted) return false;

  clearScheduledCues();
  timerElapsedBeforeRunMs = getTimerElapsedMs(nowMs);
  timerRunStartedAtMs = null;
  timerRunning = false;
  timerPhase = "paused";
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
  renderTimerStep(timerElapsedBeforeRunMs / 1000);
  return true;
}

function toggleTimerPlayPause() {
  if (timerCompleted) {
    restartSameBrew();
    return;
  }
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
    icon.textContent = "replay";
    text.textContent = "같은 레시피 다시 추출";
    btn.disabled = false;
    btn.setAttribute("aria-disabled", "false");
    btn.setAttribute("aria-label", "같은 레시피 다시 추출");
    btn.className = "min-h-11 flex-grow flex items-center justify-center gap-2 bg-primary-container text-on-primary py-3.5 px-4 rounded-2xl font-mono font-bold shadow-lg active:scale-[0.98] transition-all";
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
  clearSkipConfirmation();
  updatePlayPauseButtonUI();
}

function clearSkipConfirmation() {
  clearTimeout(skipConfirmationTimer);
  skipConfirmationTimer = null;
  skipConfirmationUntil = 0;
  const label = document.getElementById("timer-skip-label");
  const button = document.getElementById("btn-timer-skip");
  if (label) label.textContent = "다음 단계";
  if (button && !button.disabled) button.setAttribute("aria-label", "다음 추출 단계로 건너뛰기");
}

function requestSkipToNextStep(nowMs = getCurrentTimeMs()) {
  if (timerCompleted || timerPhase === "preparing") return false;
  if (nowMs <= skipConfirmationUntil) {
    clearSkipConfirmation();
    return skipToNextStep();
  }
  skipConfirmationUntil = nowMs + 3000;
  document.getElementById("timer-skip-label").textContent = "한 번 더";
  document.getElementById("btn-timer-skip").setAttribute("aria-label", "한 번 더 눌러 다음 단계로 건너뛰기");
  playCue("confirm");
  skipConfirmationTimer = setTimeout(clearSkipConfirmation, 3000);
  return false;
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
    playCue("stage");
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
  timerPhase = "completed";
  timerRunStartedAtMs = null;
  totalSecondsElapsed = getTotalBrewTime();
  timerElapsedBeforeRunMs = totalSecondsElapsed * 1000;
  stepTimeRemaining = 0;
  currentStepIndex = Math.max(0, scaledStages.length - 1);
  hideActionBanner(true);
  releaseWakeLock();
  playCue("complete");
  if (navigator.vibrate) navigator.vibrate([200, 100, 300]);

  document.getElementById("timer-display").textContent = "완료";
  document.getElementById("timer-status-badge").textContent = "추출 완료";
  document.getElementById("timer-status-badge").className = "font-mono text-xs text-primary font-bold tracking-widest";
  document.getElementById("timer-instruction").textContent = "☕ 맛있는 드립 커피가 완성되었습니다!";
  document.getElementById("timer-progress-bar").style.width = "100%";
  document.getElementById("timer-progress-bar").setAttribute("aria-valuenow", "100");
  document.getElementById("timer-step-progress-bar").style.width = "100%";
  document.getElementById("timer-step-progress-bar").setAttribute("aria-valuenow", "100");
  document.getElementById("timer-step-progress-bar").setAttribute("aria-valuetext", "현재 단계 100% 진행");
  document.getElementById("timer-step-counter").textContent = `${scaledStages.length}/${scaledStages.length}단계`;
  const skipButton = document.getElementById("btn-timer-skip");
  skipButton.disabled = true;
  skipButton.setAttribute("aria-disabled", "true");
  skipButton.classList.add("opacity-40", "cursor-not-allowed");
  updatePlayPauseButtonUI();
  const record = createBrewHistoryRecord();
  if (record) openTasteEvaluation(record.id);
  return true;
}

function renderTimerStep(exactElapsedSeconds = totalSecondsElapsed) {
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
  maybeShowActionBanner(st, exactElapsedSeconds);

  const stepDuration = Math.max(1, st.stepEndSec - st.startSec);
  const stepProgress = Math.min(1, Math.max(0, (exactElapsedSeconds - st.startSec) / stepDuration));
  const stepProgressPct = Number((stepProgress * 100).toFixed(1));
  const stepProgressBar = document.getElementById("timer-step-progress-bar");
  stepProgressBar.style.width = `${stepProgressPct}%`;
  stepProgressBar.setAttribute("aria-valuenow", Math.round(stepProgressPct).toString());
  stepProgressBar.setAttribute("aria-valuetext", `현재 단계 ${Math.round(stepProgressPct)}% 진행`);

  const guidedTarget = getGuidedTarget(st, totalSecondsElapsed);
  document.getElementById("timer-target-scale").textContent = guidedTarget;

  const stageLabel = splitStageLabel(st.name);
  document.getElementById("timer-step-title").textContent = `${st.step}단계 · ${stageLabel.title}`;
  const isPouring = st.scaledWater > 0 && totalSecondsElapsed < st.pourEndSec;
  const temperaturePreparation = getTemperaturePreparation(
    scaledStages,
    currentStepIndex,
    totalSecondsElapsed
  );
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
  } else if (temperaturePreparation?.active) {
    setTemperaturePreparationInstruction(temperaturePreparation);
  } else if (st.scaledWater > 0) {
    setTimerInstruction([
      { text: "주입 완료 · " },
      { text: formatBrewTime(st.stepEndSec), emphasized: true },
      { text: `까지 ${stageLabel.title}` }
    ]);
  } else {
    document.getElementById("timer-instruction").textContent = stageLabel.title;
  }
  document.getElementById("timer-step-pour-desc").textContent = "";
  if (temperaturePreparation?.active) {
    appendTextElement(
      document.getElementById("timer-step-pour-desc"),
      "span",
      "",
      "현재 권장 목표 "
    );
    appendTextElement(
      document.getElementById("timer-step-pour-desc"),
      "span",
      "text-primary font-bold",
      `${st.cumulativeTarget}g 유지`
    );
  } else if (stageLabel.detail) {
    appendTextElement(
      document.getElementById("timer-step-pour-desc"),
      "span",
      "whitespace-nowrap",
      stageLabel.detail
    );
    appendTextElement(
      document.getElementById("timer-step-pour-desc"),
      "span",
      "mx-1.5 text-on-surface/25",
      "·"
    );
  }
  if (!temperaturePreparation?.active) {
    appendTextElement(
      document.getElementById("timer-step-pour-desc"),
      "span",
      "",
      "이번 단계 "
    );
    appendTextElement(
      document.getElementById("timer-step-pour-desc"),
      "span",
      "text-primary font-bold",
      st.scaledWater > 0 ? `+${st.scaledWater}g` : "물 주입 없음"
    );
  }
  document.getElementById("timer-step-temp").textContent = `${st.temp}°C`;
  applyTimerTemperatureAccent(st.temp);
  const switchContainer = document.getElementById("timer-step-switch-container");
  if (currentRecipe.equipment === "Hario Switch") {
    const switchPresentation = getSwitchPresentation(st.switch);
    switchContainer.classList.remove("hidden");
    switchContainer.classList.add("inline-flex");
    switchContainer.className = `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 ${switchPresentation.badgeClass}`;
    document.getElementById("timer-step-switch-icon").textContent = switchPresentation.icon;
    document.getElementById("timer-step-switch").textContent = switchPresentation.label;
    switchContainer.setAttribute("aria-label", `스위치 ${switchPresentation.ariaLabel}`);
  } else {
    switchContainer.classList.add("hidden");
    switchContainer.classList.remove("inline-flex");
    switchContainer.removeAttribute("aria-label");
  }

  if (currentStepIndex < totalSteps - 1) {
    const nextSt = scaledStages[currentStepIndex + 1];
    const nextStageLabel = splitStageLabel(nextSt.name);
    const changes = [];
    if (nextSt.temp !== st.temp) changes.push(`${nextSt.temp}°C`);
    if (currentRecipe.equipment === "Hario Switch" && nextSt.switch !== st.switch) {
      changes.push(nextSt.switch === "closed" ? "Switch 닫기" : "Switch 열기");
    }
    document.getElementById("timer-next-label").textContent = `다음 ${formatBrewTime(nextSt.startSec)} · ${nextSt.step}단계`;
    document.getElementById("timer-next-desc").textContent = nextSt.scaledWater > 0
      ? `${nextSt.cumulativeTarget}g까지${changes.length ? ` · ${changes.join(" · ")}` : ""}`
      : `${nextStageLabel.title}${changes.length ? ` · ${changes.join(" · ")}` : ""}`;
    document.getElementById("timer-next-time").textContent = `${formatBrewTime(nextSt.startSec)} 시작`;
  } else {
    document.getElementById("timer-next-label").textContent = "다음: 추출 완료";
    document.getElementById("timer-next-desc").textContent = "추출 완료 및 서버 정리";
    document.getElementById("timer-next-time").textContent = `${formatBrewTime(st.stepEndSec)} 완료`;
  }
}

function getTemperatureAccent(temp) {
  if (temp <= 79) {
    return { color: "rgb(var(--color-temperature-low))", rgb: "var(--color-temperature-low)" };
  }
  if (temp <= 86) {
    return { color: "rgb(var(--color-temperature-medium))", rgb: "var(--color-temperature-medium)" };
  }
  if (temp <= 92) {
    return { color: "rgb(var(--color-temperature-warm))", rgb: "var(--color-temperature-warm)" };
  }
  return { color: "rgb(var(--color-temperature-high))", rgb: "var(--color-temperature-high)" };
}

function applyTimerTemperatureAccent(temp) {
  const targetCard = document.getElementById("timer-target-card");
  const accent = getTemperatureAccent(temp);
  targetCard.style.setProperty("--temperature-accent", accent.color);
  targetCard.style.setProperty("--temperature-rgb", accent.rgb);
}

function setTemperaturePreparationInstruction(preparation) {
  const container = document.getElementById("timer-instruction");
  container.textContent = "";
  appendTextElement(
    container,
    "span",
    "block mb-1 font-mono text-[11px] font-bold tracking-wider text-primary",
    "다음 단계 준비"
  );
  appendTextElement(
    container,
    "span",
    "",
    `${formatBrewTime(preparation.nextStartSec)}에 사용할 권장 `
  );
  const temperature = appendTextElement(
    container,
    "span",
    "font-black whitespace-nowrap",
    `${preparation.toTemp}°C`
  );
  temperature.style.color = getTemperatureAccent(preparation.toTemp).color;
  appendTextElement(container, "span", "", " 물을 준비하세요");
}

function getStageActionEvent(stage, stageIndex) {
  if (!stage || stageIndex < 0) return null;
  const previousStage = scaledStages[stageIndex - 1];
  const isSwitchRecipe = currentRecipe?.equipment === "Hario Switch";
  const switchChanged = isSwitchRecipe && previousStage && previousStage.switch !== stage.switch;

  if (switchChanged || stage.action === "open-switch" || stage.action === "close-switch") {
    const isClosed = stage.switch === "closed" || stage.action === "close-switch";
    return isClosed
      ? {
        icon: "horizontal_rule",
        title: "스위치를 닫으세요",
        detail: stage.scaledWater > 0
          ? `${stage.temp}°C 물 · 권장 목표 ${stage.cumulativeTarget}g`
          : "침출을 시작합니다"
      }
      : {
        icon: "arrow_downward",
        title: "스위치를 여세요",
        detail: "드로우다운을 시작합니다"
      };
  }

  if (stage.action === "swirl" || stage.action === "stir" || stage.action === "agitate") {
    return {
      icon: "rotate_right",
      title: stage.action === "swirl" ? "교반하고 스월링하세요" : "가볍게 교반하세요",
      detail: "지금 한 번 부드럽게 실행하세요"
    };
  }

  if (stage.guideMode === "event" && stage.action !== "wait") {
    return {
      icon: "touch_app",
      title: splitStageLabel(stage.name).title,
      detail: "지금 실행하세요"
    };
  }
  return null;
}

function maybeShowActionBanner(stage, exactElapsedSeconds) {
  if (timerPhase === "preparing") return false;
  const event = getStageActionEvent(stage, currentStepIndex);
  if (!event || exactElapsedSeconds < stage.startSec || exactElapsedSeconds > stage.startSec + 2) {
    return false;
  }

  const eventKey = `${currentRecipe?.id || "recipe"}:${currentStepIndex}:${stage.startSec}:${stage.action}:${stage.switch}`;
  if (shownActionEventKeys.has(eventKey)) return false;
  shownActionEventKeys.add(eventKey);
  showActionBanner(event);
  return true;
}

function showActionBanner(event) {
  const banner = document.getElementById("timer-action-banner");
  clearTimeout(actionBannerFadeTimer);
  clearTimeout(actionBannerHideTimer);
  document.getElementById("timer-action-banner-icon").textContent = event.icon;
  document.getElementById("timer-action-banner-title").textContent = event.title;
  document.getElementById("timer-action-banner-detail").textContent = event.detail;
  banner.classList.remove("hidden");
  banner.classList.remove("action-banner-visible");
  void banner.offsetWidth;
  banner.classList.add("action-banner-visible");

  actionBannerFadeTimer = setTimeout(() => {
    banner.classList.remove("action-banner-visible");
  }, 1700);
  actionBannerHideTimer = setTimeout(() => {
    banner.classList.add("hidden");
  }, 1950);
}

function hideActionBanner(immediate = false) {
  clearTimeout(actionBannerFadeTimer);
  clearTimeout(actionBannerHideTimer);
  actionBannerFadeTimer = null;
  actionBannerHideTimer = null;
  const banner = document.getElementById("timer-action-banner");
  if (!banner) return;
  banner.classList.remove("action-banner-visible");
  if (immediate) banner.classList.add("hidden");
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
    status.classList.remove("hidden");
    return;
  }

  const unavailable = [];
  if (!audioCtx) unavailable.push("소리");
  if (!("vibrate" in navigator)) unavailable.push("진동");
  if (!("wakeLock" in navigator)) unavailable.push("화면 꺼짐 방지");
  status.textContent = unavailable.length > 0
    ? `${unavailable.join("·")} 미지원 · 복귀 시 시간 자동 보정`
    : "화면 꺼짐 방지 사용 · 복귀 시 시간 자동 보정";
  status.classList.toggle("hidden", unavailable.length === 0);
}

function handleTimerVisibilityChange() {
  if (timerPhase === "preparing" && document.visibilityState === "hidden") {
    cancelTimerPreparation();
    return;
  }
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
