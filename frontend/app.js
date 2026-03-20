const SUIT_ORDER = ["Platform", "Protocol", "Tool", "Touchstone", "Workshop"];

const drawAllBtn = document.getElementById("draw-btn");
const cardsContainer = document.getElementById("cards");
const statusBox = document.getElementById("status");
const cardTemplate = document.getElementById("card-template");
const modeIndicator = document.getElementById("mode-indicator");
const startSharedBtn = document.getElementById("start-shared-btn");
const reloadCardsBtn = document.getElementById("reload-cards-btn");
const joinGameForm = document.getElementById("join-game-form");
const joinGameInput = document.getElementById("join-game-input");
const shareInfo = document.getElementById("share-info");
const shareUrlInput = document.getElementById("share-url");
const shareGameId = document.getElementById("share-game-id");
const copyShareBtn = document.getElementById("copy-share");
const themeSelect = document.getElementById("theme-select");

const suitNodes = new Map();
let activeGameId = null;
let pollHandle = null;

const THEMES = new Set(["ember", "tufte", "parchment", "noir"]);
const THEME_STORAGE_KEY = "cards-theme";

const setStatus = (message, isError = false) => {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
};

const applyTheme = (theme) => {
  const selected = THEMES.has(theme) ? theme : "ember";
  document.documentElement.dataset.theme = selected;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, selected);
  } catch (error) {
    console.warn("Unable to persist theme selection.", error);
  }
  if (themeSelect) {
    themeSelect.value = selected;
  }
};

const initTheme = () => {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  applyTheme(stored || "ember");

  if (themeSelect) {
    themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  }
};

const clearCards = () => {
  suitNodes.clear();
  cardsContainer.replaceChildren();
};

const updateTextToggleButton = (cardEl, expanded) => {
  const toggleBtn = cardEl.querySelector(".card-text-toggle");
  if (!toggleBtn) {
    return;
  }
  toggleBtn.textContent = expanded ? "Hide text" : "Read text";
  toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
};

const updateFlipButtons = (cardEl, hasImage) => {
  const frontBtn = cardEl.querySelector(".card-flip-front");
  const backBtn = cardEl.querySelector(".card-flip-back");

  cardEl.classList.toggle("can-flip", hasImage);
  if (!hasImage) {
    cardEl.classList.remove("flipped");
  }

  if (frontBtn) {
    frontBtn.disabled = !hasImage;
    frontBtn.textContent = hasImage ? "Flip to image" : "No image yet";
  }

  if (backBtn) {
    backBtn.disabled = !hasImage;
  }
};

const setCardImage = (cardEl, imageUrl, name) => {
  const imageEl = cardEl.querySelector(".card-image");
  const emptyEl = cardEl.querySelector(".card-image-empty");
  const hasImage = Boolean(imageUrl);

  if (imageEl) {
    if (hasImage) {
      imageEl.src = imageUrl;
      imageEl.alt = `${name} card image`;
      imageEl.hidden = false;
    } else {
      imageEl.removeAttribute("src");
      imageEl.alt = "";
      imageEl.hidden = true;
    }
  }

  if (emptyEl) {
    emptyEl.hidden = hasImage;
  }

  updateFlipButtons(cardEl, hasImage);
};

const populateEmptySuit = (suit) => {
  const node = suitNodes.get(suit) ?? createCardNode(suit);
  const suitEls = node.querySelectorAll(".card-suit");
  const nameEls = node.querySelectorAll(".card-name");
  const shortEl = node.querySelector(".card-short");
  const fullEl = node.querySelector(".card-full");
  const textToggleBtn = node.querySelector(".card-text-toggle");
  const urlEl = node.querySelector(".card-url");
  const redrawBtns = node.querySelectorAll(".card-redraw-front, .card-redraw-back");

  node.dataset.suit = suit;
  node.classList.remove("expanded", "flipped");

  suitEls.forEach((element) => {
    element.textContent = suit;
  });
  nameEls.forEach((element) => {
    element.textContent = "Not drawn yet";
  });
  if (shortEl) shortEl.textContent = "Use the button below to draw a card.";
  if (fullEl) {
    fullEl.textContent = "";
    fullEl.hidden = true;
  }
  if (textToggleBtn) {
    textToggleBtn.disabled = true;
  }
  updateTextToggleButton(node, false);
  if (urlEl) urlEl.textContent = "";
  redrawBtns.forEach((button) => {
    button.textContent = `Draw ${suit} card`;
    button.dataset.suit = suit;
  });
  setCardImage(node, null, "Card");
};

const renderEmptySuits = () => {
  SUIT_ORDER.forEach((suit) => populateEmptySuit(suit));
};

const showEmptySoloState = () => {
  clearCards();
  renderEmptySuits();
  setModeIndicator(null);
  updateShareUi(null);
  setStatus('Click "Draw New Cards" to begin.');
};

const setModeIndicator = (gameId) => {
  if (!modeIndicator) {
    return;
  }
  modeIndicator.textContent = gameId ? `Shared mode - ${gameId}` : "Solo mode";
};

const getSuitRank = (suit) => {
  const index = SUIT_ORDER.indexOf(suit);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const insertNodeInOrder = (node, suit) => {
  const newRank = getSuitRank(suit);
  const children = Array.from(cardsContainer.children);
  for (const child of children) {
    const childSuit = child.dataset.suit || "";
    const childRank = getSuitRank(childSuit);
    if (
      newRank < childRank ||
      (newRank === childRank && suit.localeCompare(childSuit) < 0)
    ) {
      cardsContainer.insertBefore(node, child);
      return;
    }
  }

  cardsContainer.appendChild(node);
};

const toggleCardText = (cardEl) => {
  const fullTextEl = cardEl.querySelector(".card-full");
  if (!fullTextEl) {
    return;
  }
  const expanded = cardEl.classList.toggle("expanded");
  fullTextEl.hidden = !expanded;
  updateTextToggleButton(cardEl, expanded);
};

const flipCard = (cardEl) => {
  if (!cardEl.classList.contains("can-flip")) {
    return;
  }
  cardEl.classList.toggle("flipped");
};

const createToggleHandler = (node) => (event) => {
  if (event.target.closest(".card-actions") || event.target.closest("a")) {
    return;
  }

  if (event.type === "keydown") {
    const actionableKeys = ["Enter", " "];
    if (!actionableKeys.includes(event.key)) {
      return;
    }
    event.preventDefault();
  }

  flipCard(node);
};

const createCardNode = (suit) => {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.suit = suit;

  const handleToggle = createToggleHandler(node);
  node.addEventListener("click", handleToggle);
  node.addEventListener("keydown", handleToggle);

  const textToggleBtn = node.querySelector(".card-text-toggle");
  if (textToggleBtn) {
    textToggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCardText(node);
    });
  }

  const flipFrontBtn = node.querySelector(".card-flip-front");
  const flipBackBtn = node.querySelector(".card-flip-back");
  [flipFrontBtn, flipBackBtn].forEach((button) => {
    if (!button) {
      return;
    }
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      flipCard(node);
    });
  });

  const redrawButtons = node.querySelectorAll(".card-redraw-front, .card-redraw-back");
  redrawButtons.forEach((redrawBtn) => {
    redrawBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const targetSuit = redrawBtn.dataset.suit || suit;
      drawSingleSuit(targetSuit);
    });
  });

  insertNodeInOrder(node, suit);
  suitNodes.set(suit, node);
  return node;
};

const updateUrlElement = (urlEl, url) => {
  if (!urlEl) {
    return;
  }

  if (url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Source";
    urlEl.replaceChildren(link);
  } else {
    urlEl.textContent = "";
  }
};

const populateCardContent = (suit, card) => {
  const node = suitNodes.get(suit) ?? createCardNode(suit);
  const isExpanded = node.classList.contains("expanded");
  const suitEls = node.querySelectorAll(".card-suit");
  const nameEls = node.querySelectorAll(".card-name");
  const shortEl = node.querySelector(".card-short");
  const fullEl = node.querySelector(".card-full");
  const textToggleBtn = node.querySelector(".card-text-toggle");
  const urlEl = node.querySelector(".card-url");
  const redrawBtns = node.querySelectorAll(".card-redraw-front, .card-redraw-back");

  node.dataset.suit = suit;

  suitEls.forEach((element) => {
    element.textContent = suit;
  });
  nameEls.forEach((element) => {
    element.textContent = card.name;
  });
  if (shortEl) shortEl.textContent = card.short_text;
  if (fullEl) {
    fullEl.textContent = card.text;
    fullEl.hidden = !isExpanded;
  }
  if (textToggleBtn) {
    textToggleBtn.disabled = false;
  }
  updateTextToggleButton(node, isExpanded);
  updateUrlElement(urlEl, card.url);
  setCardImage(node, card.image_url, card.name);

  redrawBtns.forEach((button) => {
    button.textContent = `Draw ${suit} card`;
    button.dataset.suit = suit;
  });

};

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Server responded with ${response.status}${message ? `: ${message}` : ""}`
    );
  }
  return response.json();
};

const createSharedGame = async () => fetchJson("/api/games", { method: "POST" });

const fetchGame = async (gameId) => fetchJson(`/api/games/${gameId}`);

const drawGame = async (gameId, suit) => {
  const url = suit
    ? `/api/games/${gameId}/draw?${new URLSearchParams({ suit }).toString()}`
    : `/api/games/${gameId}/draw`;
  return fetchJson(url, { method: "POST" });
};

const fetchSoloDraw = async (suit) => {
  const url = suit
    ? `/api/draw?${new URLSearchParams({ suit }).toString()}`
    : "/api/draw";
  return fetchJson(url);
};

const reloadCards = async () =>
  fetchJson("/api/cards/reload", { method: "POST" });

const updateShareUi = (gameId) => {
  if (!shareInfo || !shareUrlInput || !shareGameId) {
    return;
  }

  if (!gameId) {
    shareInfo.hidden = true;
    shareUrlInput.value = "";
    shareGameId.textContent = "";
    return;
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}#/game/${gameId}`;
  shareInfo.hidden = false;
  shareUrlInput.value = shareUrl;
  shareGameId.textContent = gameId;
};

const stopPolling = () => {
  if (pollHandle) {
    window.clearInterval(pollHandle);
    pollHandle = null;
  }
};

const startPolling = (gameId) => {
  stopPolling();
  if (!gameId) {
    return;
  }

  pollHandle = window.setInterval(async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    try {
      const data = await fetchGame(gameId);
      renderCards(data.cards ?? {});
    } catch (error) {
      console.error(error);
    }
  }, 4000);
};

const renderCards = (cards) => {
  const suits = new Set([...SUIT_ORDER, ...Object.keys(cards ?? {})]);
  Array.from(suits)
    .sort((a, b) => {
      const rankDiff = getSuitRank(a) - getSuitRank(b);
      return rankDiff !== 0 ? rankDiff : a.localeCompare(b);
    })
    .forEach((suit) => {
      const card = cards?.[suit];
      if (card) {
        populateCardContent(suit, card);
      } else {
        populateEmptySuit(suit);
      }
    });
};

const parseGameIdFromHash = () => {
  const hash = window.location.hash || "";
  const match = hash.match(/^#\/game\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
};

const enterSharedGame = async (gameId, initialCards = null) => {
  activeGameId = gameId;
  setModeIndicator(gameId);
  updateShareUi(gameId);
  startPolling(gameId);

  try {
    const cards = initialCards ?? (await fetchGame(gameId)).cards ?? {};
    renderCards(cards);
    setStatus("Shared game loaded. Anyone with the link can redraw suits.");
  } catch (error) {
    console.error(error);
    setStatus(`Unable to load shared game: ${error.message}`, true);
  }
};

const leaveSharedGame = () => {
  activeGameId = null;
  stopPolling();
  showEmptySoloState();
};

const drawSingleSuit = async (suit) => {
  if (!suit) {
    return;
  }

  const node = suitNodes.get(suit) ?? createCardNode(suit);
  const redrawButtons = node.querySelectorAll(".card-redraw-front, .card-redraw-back");
  if (!redrawButtons.length) {
    return;
  }

  const previousLabels = Array.from(redrawButtons, (button) => button.textContent);
  redrawButtons.forEach((button) => {
    button.disabled = true;
    button.textContent = "Drawing...";
  });
  setStatus(`Drawing ${suit} card...${activeGameId ? " (shared)" : ""}`);

  try {
    const data = activeGameId
      ? await drawGame(activeGameId, suit)
      : await fetchSoloDraw(suit);
    const card = data.cards?.[suit];
    if (!card) {
      throw new Error("Server did not return a card for this suit.");
    }
    populateCardContent(suit, card);
    setStatus(`Updated ${suit}. Click the card or use "Peel back" for full text.`);
  } catch (error) {
    console.error(error);
    setStatus(`Unable to draw ${suit} card: ${error.message}`, true);
  } finally {
    redrawButtons.forEach((button, index) => {
      button.disabled = false;
      button.textContent = previousLabels[index];
    });
  }
};

const drawAllCards = async () => {
  setStatus(activeGameId ? "Drawing shared cards..." : "Drawing cards...");
  drawAllBtn.disabled = true;

  try {
    const data = activeGameId
      ? await drawGame(activeGameId)
      : await fetchSoloDraw();
    renderCards(data.cards ?? {});
    setStatus(
      'Click any card or use "Peel back" to reveal full text, or redraw an individual suit.'
    );
  } catch (error) {
    console.error(error);
    setStatus(`Unable to draw cards: ${error.message}`, true);
  } finally {
    drawAllBtn.disabled = false;
  }
};

const handleReloadCards = async () => {
  if (!reloadCardsBtn) {
    return;
  }

  reloadCardsBtn.disabled = true;
  setStatus("Reloading cards from Google Sheets...");

  try {
    const data = await reloadCards();
    const suitList = Array.isArray(data.suits) ? data.suits.join(", ") : "";
    setStatus(
      `Card source reloaded. New draws will use the updated sheet data${
        suitList ? ` (${suitList})` : ""
      }.`
    );
  } catch (error) {
    console.error(error);
    setStatus(`Unable to reload cards: ${error.message}`, true);
  } finally {
    reloadCardsBtn.disabled = false;
  }
};

drawAllBtn.addEventListener("click", drawAllCards);
if (reloadCardsBtn) {
  reloadCardsBtn.addEventListener("click", handleReloadCards);
}

if (startSharedBtn) {
  startSharedBtn.addEventListener("click", async () => {
    startSharedBtn.disabled = true;
    setStatus("Creating shared game...");
    try {
      const data = await createSharedGame();
      const gameId = data.game_id;
      if (!gameId) {
        throw new Error("Server did not return a game id.");
      }
      window.location.hash = `#/game/${encodeURIComponent(gameId)}`;
      await enterSharedGame(gameId, data.cards ?? {});
      setStatus("Shared game created. Copy the link to share it.");
    } catch (error) {
      console.error(error);
      setStatus(`Unable to start shared game: ${error.message}`, true);
    } finally {
      startSharedBtn.disabled = false;
    }
  });
}

if (joinGameForm && joinGameInput) {
  joinGameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const gameId = joinGameInput.value.trim();
    if (!gameId) {
      setStatus("Enter a game ID to join.", true);
      return;
    }

    window.location.hash = `#/game/${encodeURIComponent(gameId)}`;
    await enterSharedGame(gameId);
  });
}

if (copyShareBtn && shareUrlInput) {
  copyShareBtn.addEventListener("click", async () => {
    const value = shareUrlInput.value;
    if (!value) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        shareUrlInput.focus();
        shareUrlInput.select();
        document.execCommand("copy");
      }
      setStatus("Share link copied.");
    } catch (error) {
      console.error(error);
      setStatus("Unable to copy link. Select the field and copy manually.", true);
    }
  });
}

const syncFromLocation = async () => {
  const gameId = parseGameIdFromHash();
  if (!gameId) {
    if (activeGameId) {
      leaveSharedGame();
    }
    showEmptySoloState();
    return;
  }

  if (activeGameId === gameId) {
    return;
  }
  await enterSharedGame(gameId);
};

window.addEventListener("hashchange", syncFromLocation);
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  syncFromLocation();
});
