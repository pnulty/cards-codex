const SUIT_ORDER = ["Platform", "Protocol", "Tool", "Touchstone", "Workshop"];

const drawAllBtn = document.getElementById("draw-btn");
const cardsContainer = document.getElementById("cards");
const statusBox = document.getElementById("status");
const cardTemplate = document.getElementById("card-template");

const suitNodes = new Map();

const setStatus = (message, isError = false) => {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
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
  const suitEl = node.querySelector(".card-suit");
  const nameEl = node.querySelector(".card-name");
  const shortEl = node.querySelector(".card-short");
  const fullEl = node.querySelector(".card-full");
  const urlEl = node.querySelector(".card-url");
  const redrawBtn = node.querySelector(".card-redraw");

  node.dataset.suit = suit;
  node.classList.remove("expanded");

  if (suitEl) suitEl.textContent = suit;
  if (nameEl) nameEl.textContent = card.name;
  if (shortEl) shortEl.textContent = card.short_text;
  if (fullEl) {
    fullEl.textContent = card.text;
    fullEl.hidden = true;
  }
  updateUrlElement(urlEl, card.url);

  if (redrawBtn) {
    redrawBtn.textContent = `Draw ${suit} card`;
    redrawBtn.dataset.suit = suit;
  }

};

const fetchCards = async (query = "") => {
  const url = query ? `/api/draw?${query}` : "/api/draw";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  return response.json();
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
  setStatus(`Drawing ${suit} card...`);

  try {
    const params = new URLSearchParams({ suit });
    const data = await fetchCards(params.toString());
    const card = data.cards[suit];
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
  setStatus("Drawing cards...");
  drawAllBtn.disabled = true;

  try {
    const data = await fetchCards();
    const suits = Object.keys(data.cards);
    suits
      .sort((a, b) => {
        const rankDiff = getSuitRank(a) - getSuitRank(b);
        return rankDiff !== 0 ? rankDiff : a.localeCompare(b);
      })
      .forEach((suit) => populateCardContent(suit, data.cards[suit]));
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
window.addEventListener("DOMContentLoaded", drawAllCards);
