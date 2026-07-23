import "./style.css";
import {
  Board,
  ComputerPlayer,
  FLEET,
  BOARD_SIZE,
  ORIENTATIONS,
  shipCells,
} from "./game.js";

const PHASE = { PLACEMENT: "placement", BATTLE: "battle", OVER: "over" };

const state = {
  phase: PHASE.PLACEMENT,
  playerBoard: new Board(),
  enemyBoard: new Board(),
  computer: new ComputerPlayer(),
  fleetIndex: 0, // which ship the player is currently placing
  orientation: ORIENTATIONS.HORIZONTAL,
  hover: null, // {row, col} currently hovered player cell during placement
  playerTurn: true,
  message: "",
  busy: false, // true while the computer is "thinking"
};

const app = document.querySelector("#app");

function newGame() {
  state.phase = PHASE.PLACEMENT;
  state.playerBoard = new Board();
  state.enemyBoard = new Board();
  state.enemyBoard.placeFleetRandomly(FLEET);
  state.computer = new ComputerPlayer();
  state.fleetIndex = 0;
  state.orientation = ORIENTATIONS.HORIZONTAL;
  state.hover = null;
  state.playerTurn = true;
  state.busy = false;
  state.message = "Place your fleet: click a cell to drop a ship.";
  render();
}

function currentShip() {
  return FLEET[state.fleetIndex] || null;
}

// ---- Placement handlers -------------------------------------------------

function handlePlacementClick(row, col) {
  const ship = currentShip();
  if (!ship) return;
  const placed = state.playerBoard.placeShip(
    ship.name,
    row,
    col,
    ship.length,
    state.orientation
  );
  if (!placed) {
    state.message = "Can't place a ship there — try another spot.";
    render();
    return;
  }
  state.fleetIndex += 1;
  if (state.fleetIndex >= FLEET.length) {
    startBattle();
  } else {
    state.message = `Place your ${currentShip().name} (length ${currentShip().length}).`;
    render();
  }
}

function toggleOrientation() {
  state.orientation =
    state.orientation === ORIENTATIONS.HORIZONTAL
      ? ORIENTATIONS.VERTICAL
      : ORIENTATIONS.HORIZONTAL;
  render();
}

function randomizePlayerFleet() {
  state.playerBoard.placeFleetRandomly(FLEET);
  startBattle();
}

function startBattle() {
  state.phase = PHASE.BATTLE;
  state.playerTurn = true;
  state.message = "Battle stations! Fire at the enemy waters.";
  render();
}

// ---- Battle handlers ----------------------------------------------------

function handleFire(row, col) {
  if (state.phase !== PHASE.BATTLE || !state.playerTurn || state.busy) return;
  if (state.enemyBoard.shots[row][col] !== null) return;

  const { result, ship, sunk } = state.enemyBoard.receiveAttack(row, col);
  if (result === "already") return;

  if (result === "hit") {
    state.message = sunk
      ? `You sank the enemy ${ship.name}!`
      : "Direct hit!";
  } else {
    state.message = "Splash — you missed.";
  }

  if (state.enemyBoard.allShipsSunk()) {
    endGame(true);
    return;
  }

  state.playerTurn = false;
  state.busy = true;
  render();
  window.setTimeout(computerTurn, 650);
}

function computerTurn() {
  const move = state.computer.chooseMove();
  const { result, ship, sunk } = state.playerBoard.receiveAttack(
    move.row,
    move.col
  );
  state.computer.registerResult(move.row, move.col, result, sunk);

  if (result === "hit") {
    state.message = sunk
      ? `The enemy sank your ${ship.name}!`
      : "The enemy hit your ship!";
  } else {
    state.message = "The enemy missed.";
  }

  if (state.playerBoard.allShipsSunk()) {
    endGame(false);
    return;
  }

  state.playerTurn = true;
  state.busy = false;
  render();
}

function endGame(playerWon) {
  state.phase = PHASE.OVER;
  state.busy = false;
  state.message = playerWon
    ? "Victory! You destroyed the enemy fleet."
    : "Defeat. Your fleet has been sunk.";
  render();
}

// ---- Rendering ----------------------------------------------------------

// Cells the current hovered ship would occupy: Set of "row,col,ok|bad".
function computePreview(board) {
  const previewCells = new Set();
  if (!state.hover || !currentShip()) return previewCells;
  const ship = currentShip();
  const cells = shipCells(state.hover.row, state.hover.col, ship.length, state.orientation);
  if (!cells) return previewCells;
  const valid = board.canPlace(state.hover.row, state.hover.col, ship.length, state.orientation);
  cells.forEach(({ row, col }) =>
    previewCells.add(`${row},${col},${valid ? "ok" : "bad"}`)
  );
  return previewCells;
}

// Repaints only the preview classes on an existing placement grid, so hovering
// never rebuilds the DOM (which would destroy the button under the cursor and
// swallow the click that places a ship).
function refreshPreview(grid, board) {
  const previewCells = computePreview(board);
  grid.querySelectorAll(".cell").forEach((cell) => {
    const key = `${cell.dataset.row},${cell.dataset.col}`;
    cell.classList.toggle("preview-ok", previewCells.has(`${key},ok`));
    cell.classList.toggle("preview-bad", previewCells.has(`${key},bad`));
  });
}

function buildGrid(board, { reveal, interactive, onClick, showPreview }) {
  const grid = document.createElement("div");
  grid.className = "grid";

  const previewCells = showPreview ? computePreview(board) : new Set();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      const shot = board.shots[r][c];
      const hasShip = board.grid[r][c] !== null;

      if (reveal && hasShip) cell.classList.add("ship");
      if (shot === "hit") cell.classList.add("hit");
      if (shot === "miss") cell.classList.add("miss");
      if (previewCells.has(`${r},${c},ok`)) cell.classList.add("preview-ok");
      if (previewCells.has(`${r},${c},bad`)) cell.classList.add("preview-bad");

      if (interactive) {
        cell.addEventListener("click", () => onClick(r, c));
        if (showPreview) {
          cell.addEventListener("mouseenter", () => {
            state.hover = { row: r, col: c };
            refreshPreview(grid, board);
          });
        }
      } else {
        cell.disabled = true;
      }

      grid.appendChild(cell);
    }
  }
  return grid;
}

function fleetStatus(board, label) {
  const wrap = document.createElement("div");
  wrap.className = "fleet-status";
  const title = document.createElement("h3");
  title.textContent = label;
  wrap.appendChild(title);

  const list = document.createElement("ul");
  FLEET.forEach((f) => {
    const ship = board.ships.find((s) => s.name === f.name);
    const sunk = ship ? board.isShipSunk(ship) : false;
    const li = document.createElement("li");
    li.className = sunk ? "sunk" : "afloat";
    li.textContent = `${f.name} (${f.length})${sunk ? " — sunk" : ""}`;
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}

function render() {
  app.innerHTML = "";

  const header = document.createElement("header");
  header.innerHTML = `<h1>Battleship</h1>`;
  app.appendChild(header);

  const status = document.createElement("p");
  status.className = "status";
  status.textContent = state.message;
  app.appendChild(status);

  // Controls
  const controls = document.createElement("div");
  controls.className = "controls";

  if (state.phase === PHASE.PLACEMENT) {
    const rotate = document.createElement("button");
    rotate.textContent = `Rotate (${state.orientation})`;
    rotate.addEventListener("click", toggleOrientation);
    controls.appendChild(rotate);

    const random = document.createElement("button");
    random.textContent = "Random fleet";
    random.addEventListener("click", randomizePlayerFleet);
    controls.appendChild(random);
  }

  const restart = document.createElement("button");
  restart.textContent = "New game";
  restart.addEventListener("click", newGame);
  controls.appendChild(restart);
  app.appendChild(controls);

  // Boards
  const boards = document.createElement("div");
  boards.className = "boards";
  if (state.phase === PHASE.PLACEMENT) {
    boards.addEventListener("mouseleave", () => {
      if (state.hover) {
        state.hover = null;
        render();
      }
    });
  }

  const playerWrap = document.createElement("div");
  playerWrap.className = "board-wrap";
  const playerTitle = document.createElement("h2");
  playerTitle.textContent = "Your waters";
  playerWrap.appendChild(playerTitle);
  playerWrap.appendChild(
    buildGrid(state.playerBoard, {
      reveal: true,
      interactive: state.phase === PHASE.PLACEMENT,
      onClick: handlePlacementClick,
      showPreview: state.phase === PHASE.PLACEMENT,
    })
  );
  playerWrap.appendChild(fleetStatus(state.playerBoard, "Your fleet"));
  boards.appendChild(playerWrap);

  const enemyWrap = document.createElement("div");
  enemyWrap.className = "board-wrap";
  const enemyTitle = document.createElement("h2");
  enemyTitle.textContent = "Enemy waters";
  enemyWrap.appendChild(enemyTitle);
  enemyWrap.appendChild(
    buildGrid(state.enemyBoard, {
      reveal: state.phase === PHASE.OVER,
      interactive: state.phase === PHASE.BATTLE && state.playerTurn && !state.busy,
      onClick: handleFire,
      showPreview: false,
    })
  );
  enemyWrap.appendChild(fleetStatus(state.enemyBoard, "Enemy fleet"));
  boards.appendChild(enemyWrap);

  app.appendChild(boards);
}

newGame();
