"use strict";

// Application bootstrap and PWA registration.
// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  loadRecipesFromStorage();
  bindEvents();
  updateHotIceButtons();
  calculateAndRender();
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.error("오프라인 기능을 등록하지 못했습니다:", error);
    });
  });
}
