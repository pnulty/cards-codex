const suitSelect = document.getElementById("suit-select");
const drawSuitBtn = document.getElementById("draw-suit-btn");
const mobileCard = document.getElementById("mobile-card");

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

const requestWakeLock = async () => {
  if (!("wakeLock" in navigator) || !navigator.wakeLock?.request) {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch (error) {
    console.error(error);
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

const renderSuits = () => {
  suitSelect.replaceChildren();
  suits.forEach((suit) => {
    const option = document.createElement("option");
    option.value = suit;
    option.textContent = suit;
    suitSelect.appendChild(option);
  });

  activeSuit = suits[0] || null;
  if (activeSuit) {
    suitSelect.value = activeSuit;
  }
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
  } else {
    imageEl.removeAttribute("src");
    imageEl.alt = "";
    imageEl.hidden = true;
    imageEmptyEl.hidden = false;
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
  mobileCard.hidden = false;
  requestAnimationFrame(() => {
    mobileCard.scrollIntoView({ block: "start", behavior: "smooth" });
  });
};

const drawSuit = async (suit) => {
  drawSuitBtn.disabled = true;

  try {
    const data = await fetchJson(`/api/draw?${new URLSearchParams({ suit }).toString()}`);
    const card = data.cards?.[suit];
    if (!card) {
      throw new Error("Server did not return a card for this suit.");
    }
    showCard(card);
  } catch (error) {
    console.error(error);
  } finally {
    drawSuitBtn.disabled = false;
  }
};

const loadSuits = async () => {
  try {
    const data = await fetchJson("/api/suits");
    suits = Array.isArray(data.suits) ? data.suits : [];
    if (!suits.length) {
      throw new Error("No suits are available.");
    }
    renderSuits();
  } catch (error) {
    console.error(error);
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

suitSelect.addEventListener("change", () => {
  activeSuit = suitSelect.value;
});

drawSuitBtn.addEventListener("click", () => {
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
