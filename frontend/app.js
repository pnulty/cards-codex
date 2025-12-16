const SUIT_ORDER = ["Platform", "Protocol", "Tool", "Touchstone", "Workshop"];

const drawAllBtn = document.getElementById("draw-btn");
const cardsContainer = document.getElementById("cards");
const statusBox = document.getElementById("status");
const cardTemplate = document.getElementById("card-template");
const modeIndicator = document.getElementById("mode-indicator");
const startSharedBtn = document.getElementById("start-shared-btn");
const joinGameForm = document.getElementById("join-game-form");
const joinGameInput = document.getElementById("join-game-input");
const shareInfo = document.getElementById("share-info");
const shareUrlInput = document.getElementById("share-url");
const shareGameId = document.getElementById("share-game-id");
const copyShareBtn = document.getElementById("copy-share");

const suitNodes = new Map();
let activeGameId = null;
let pollHandle = null;

const setStatus = (message, isError = false) => {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
};

const clearCards = () => {
  suitNodes.clear();
  cardsContainer.replaceChildren();
};

const populateEmptySuit = (suit) => {
  const node = suitNodes.get(suit) ?? createCardNode(suit);
  const suitEl = node.querySelector(".card-suit");
  const nameEl = node.querySelector(".card-name");
  const shortEl = node.querySelector(".card-short");
  const fullEl = node.querySelector(".card-full");
  const urlEl = node.querySelector(".card-url");
  const redrawBtn = node.querySelector(".card-redraw");

  node.dataset.suit = suit;
  node.classList.remove("expanded");

  if (suitEl) suitEl.textContent = suit;
  if (nameEl) nameEl.textContent = "Not drawn yet";
  if (shortEl) shortEl.textContent = "Use the button below to draw a card.";
  if (fullEl) {
    fullEl.textContent = "";
    fullEl.hidden = true;
  }
  if (urlEl) urlEl.textContent = "";
  if (redrawBtn) {
    redrawBtn.textContent = `Draw ${suit} card`;
    redrawBtn.dataset.suit = suit;
  }
};

const renderEmptySuits = () => {
  SUIT_ORDER.forEach((suit) => populateEmptySuit(suit));
};

const showEmptySoloState = () => {
  clearCards();
  renderEmptySuits();
  setModeIndicator(null);
  updateShareUi(null);
  setStatus("Click “Draw New Cards” to begin.");
};

const setModeIndicator = (gameId) => {
  if (!modeIndicator) {
    return;
  }
  modeIndicator.textContent = gameId ? `Shared mode · ${gameId}` : "Solo mode";
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

const toggleCard = (cardEl) => {
  const fullTextEl = cardEl.querySelector(".card-full");
  if (!fullTextEl) {
    return;
  }
  const expanded = cardEl.classList.toggle("expanded");
  fullTextEl.hidden = !expanded;
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

  toggleCard(node);
};

const createCardNode = (suit) => {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.suit = suit;

  const handleToggle = createToggleHandler(node);
  node.addEventListener("click", handleToggle);
  node.addEventListener("keydown", handleToggle);

  const redrawBtn = node.querySelector(".card-redraw");
  if (redrawBtn) {
    redrawBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const targetSuit = redrawBtn.dataset.suit || suit;
      drawSingleSuit(targetSuit);
    });
  }

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
  const suitEl = node.querySelector(".card-suit");
  const nameEl = node.querySelector(".card-name");
  const shortEl = node.querySelector(".card-short");
  const fullEl = node.querySelector(".card-full");
  const urlEl = node.querySelector(".card-url");
  const redrawBtn = node.querySelector(".card-redraw");

  node.dataset.suit = suit;

  if (suitEl) suitEl.textContent = suit;
  if (nameEl) nameEl.textContent = card.name;
  if (shortEl) shortEl.textContent = card.short_text;
  if (fullEl) {
    fullEl.textContent = card.text;
    fullEl.hidden = !isExpanded;
  }
  updateUrlElement(urlEl, card.url);

  if (redrawBtn) {
    redrawBtn.textContent = `Draw ${suit} card`;
    redrawBtn.dataset.suit = suit;
  }

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
  const redrawBtn = node.querySelector(".card-redraw");
  if (!redrawBtn) {
    return;
  }

  const previousLabel = redrawBtn.textContent;
  redrawBtn.disabled = true;
  redrawBtn.textContent = "Drawing...";
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
    setStatus(`Updated ${suit}. Click the card to reveal full text.`);
  } catch (error) {
    console.error(error);
    setStatus(`Unable to draw ${suit} card: ${error.message}`, true);
  } finally {
    redrawBtn.disabled = false;
    redrawBtn.textContent = previousLabel;
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
      "Click any card to reveal the full text or redraw an individual suit."
    );
  } catch (error) {
    console.error(error);
    setStatus(`Unable to draw cards: ${error.message}`, true);
  } finally {
    drawAllBtn.disabled = false;
  }
};

drawAllBtn.addEventListener("click", drawAllCards);

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
window.addEventListener("DOMContentLoaded", syncFromLocation);
