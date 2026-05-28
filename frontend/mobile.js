const suitGrid = document.getElementById("suit-grid");
const suitButtonTemplate = document.getElementById("suit-button-template");
const chooserScreen = document.getElementById("chooser-screen");
const cardScreen = document.getElementById("card-screen");
const mobileCard = document.getElementById("mobile-card");
const backToSuitsBtn = document.getElementById("back-to-suits-btn");
const redrawBtn = document.getElementById("redraw-btn");
const wakePanel = document.getElementById("wake-panel");
const wakeStatus = document.getElementById("wake-status");
const frontHint = document.getElementById("front-hint");
const backHint = document.getElementById("back-hint");
const cardStatus = document.getElementById("card-status");

const suitEl = document.getElementById("card-suit");
const nameEl = document.getElementById("card-name");
const shortEl = document.getElementById("card-short");
const textEl = document.getElementById("card-text");
const backSuitEl = document.getElementById("back-card-suit");
const backNameEl = document.getElementById("back-card-name");
const imageEl = document.getElementById("card-image");
const imageEmptyEl = document.getElementById("image-empty");

let suits = [];
let activeSuit = null;
let wakeLock = null;

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Server responded with ${response.status}${message ? `: ${message}` : ""}`);
  }
  return response.json();
};

const setStatus = (message, isError = false) => {
  cardStatus.textContent = message;
  cardStatus.classList.toggle("error", isError);
};

const setWakeStatus = (message, isError = false) => {
  if (!wakePanel || !wakeStatus) {
    return;
  }
  wakePanel.hidden = false;
  wakeStatus.textContent = message;
  wakePanel.classList.toggle("error", isError);
};

const requestWakeLock = async () => {
  if (!("wakeLock" in navigator) || !navigator.wakeLock?.request) {
    setWakeStatus("This browser does not support screen wake lock.", true);
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    setWakeStatus("Screen wake lock is active.");
    wakeLock.addEventListener("release", () => {
      if (document.visibilityState === "visible") {
        setWakeStatus("Screen wake lock was released.", true);
      }
    });
  } catch (error) {
    console.error(error);
    setWakeStatus("Unable to keep the screen awake on this device.", true);
  }
};

const ensureWakeLock = async () => {
  if (document.visibilityState !== "visible") {
    return;
  }
  if (wakeLock && !wakeLock.released) {
    return;
  }
  await requestWakeLock();
};

const renderSuitButtons = () => {
  suitGrid.replaceChildren();
  suits.forEach((suit) => {
    const button = suitButtonTemplate.content.firstElementChild.cloneNode(true);
    button.textContent = suit;
    button.dataset.suit = suit;
    button.addEventListener("click", () => {
      activeSuit = suit;
      drawSuit(suit);
    });
    suitGrid.appendChild(button);
  });
};

const setCardImage = (card) => {
  const hasImage = Boolean(card.image_url);
  mobileCard.classList.toggle("can-flip", hasImage);
  mobileCard.classList.remove("flipped");

  if (hasImage) {
    imageEl.src = card.image_url;
    imageEl.alt = `${card.name} card image`;
    imageEl.hidden = false;
    imageEmptyEl.hidden = true;
    frontHint.hidden = false;
    backHint.hidden = false;
  } else {
    imageEl.removeAttribute("src");
    imageEl.alt = "";
    imageEl.hidden = true;
    imageEmptyEl.hidden = false;
    frontHint.hidden = true;
    backHint.hidden = true;
  }
};

const showCard = (card) => {
  suitEl.textContent = card.suit;
  nameEl.textContent = card.name;
  shortEl.textContent = card.short_text;
  textEl.textContent = card.text;
  backSuitEl.textContent = card.suit;
  backNameEl.textContent = card.name;
  setCardImage(card);

  chooserScreen.hidden = true;
  cardScreen.hidden = false;
  setStatus(`Showing ${card.suit}: ${card.name}.`);
};

const drawSuit = async (suit) => {
  redrawBtn.disabled = true;
  backToSuitsBtn.disabled = true;
  setStatus(`Drawing a ${suit} card...`);

  try {
    const data = await fetchJson(`/api/draw?${new URLSearchParams({ suit }).toString()}`);
    const card = data.cards?.[suit];
    if (!card) {
      throw new Error("Server did not return a card for this suit.");
    }
    showCard(card);
  } catch (error) {
    console.error(error);
    setStatus(`Unable to draw card: ${error.message}`, true);
  } finally {
    redrawBtn.disabled = false;
    backToSuitsBtn.disabled = false;
  }
};

const loadSuits = async () => {
  try {
    const data = await fetchJson("/api/suits");
    suits = Array.isArray(data.suits) ? data.suits : [];
    if (!suits.length) {
      throw new Error("No suits are available.");
    }
    renderSuitButtons();
  } catch (error) {
    console.error(error);
    setStatus(`Unable to load suits: ${error.message}`, true);
  }
};

mobileCard.addEventListener("click", () => {
  if (!mobileCard.classList.contains("can-flip")) {
    return;
  }
  mobileCard.classList.toggle("flipped");
});

mobileCard.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key) || !mobileCard.classList.contains("can-flip")) {
    return;
  }
  event.preventDefault();
  mobileCard.classList.toggle("flipped");
});

backToSuitsBtn.addEventListener("click", () => {
  chooserScreen.hidden = false;
  cardScreen.hidden = true;
  mobileCard.classList.remove("flipped");
  setStatus("");
});

redrawBtn.addEventListener("click", () => {
  if (!activeSuit) {
    return;
  }
  drawSuit(activeSuit);
});

document.addEventListener("visibilitychange", () => {
  ensureWakeLock();
});

window.addEventListener("DOMContentLoaded", async () => {
  await ensureWakeLock();
  await loadSuits();
});
