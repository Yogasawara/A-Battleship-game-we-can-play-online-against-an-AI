// Core Battleship game logic (framework-agnostic, no DOM access).

export const BOARD_SIZE = 10;

// Standard fleet: name + length.
export const FLEET = [
  { name: "Carrier", length: 5 },
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Submarine", length: 3 },
  { name: "Destroyer", length: 2 },
];

export const ORIENTATIONS = { HORIZONTAL: "horizontal", VERTICAL: "vertical" };

/**
 * Returns the list of {row, col} cells a ship would occupy, or null if it
 * would fall off the board.
 */
export function shipCells(row, col, length, orientation) {
  const cells = [];
  for (let i = 0; i < length; i++) {
    const r = orientation === ORIENTATIONS.VERTICAL ? row + i : row;
    const c = orientation === ORIENTATIONS.HORIZONTAL ? col + i : col;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
    cells.push({ row: r, col: c });
  }
  return cells;
}

/** A single player's board: ship placement, attack tracking, and queries. */
export class Board {
  constructor(size = BOARD_SIZE) {
    this.size = size;
    this.ships = []; // { name, length, cells:[{row,col}], hits:Set<"r,c"> }
    // grid[r][c] holds a reference to the ship occupying it, or null.
    this.grid = Array.from({ length: size }, () => Array(size).fill(null));
    this.shots = Array.from({ length: size }, () => Array(size).fill(null)); // "hit" | "miss" | null
  }

  inBounds(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  canPlace(row, col, length, orientation) {
    const cells = shipCells(row, col, length, orientation);
    if (!cells) return false;
    return cells.every(({ row: r, col: c }) => this.grid[r][c] === null);
  }

  placeShip(name, row, col, length, orientation) {
    if (!this.canPlace(row, col, length, orientation)) return false;
    const cells = shipCells(row, col, length, orientation);
    const ship = { name, length, cells, hits: new Set() };
    cells.forEach(({ row: r, col: c }) => {
      this.grid[r][c] = ship;
    });
    this.ships.push(ship);
    return true;
  }

  /** Places the full fleet at random, non-overlapping positions. */
  placeFleetRandomly(fleet = FLEET) {
    this.ships = [];
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    for (const { name, length } of fleet) {
      let placed = false;
      while (!placed) {
        const orientation =
          Math.random() < 0.5 ? ORIENTATIONS.HORIZONTAL : ORIENTATIONS.VERTICAL;
        const row = Math.floor(Math.random() * this.size);
        const col = Math.floor(Math.random() * this.size);
        placed = this.placeShip(name, row, col, length, orientation);
      }
    }
  }

  /**
   * Fires at a cell. Returns { result: "hit"|"miss"|"already", ship?, sunk? }.
   */
  receiveAttack(row, col) {
    if (!this.inBounds(row, col)) return { result: "already" };
    if (this.shots[row][col] !== null) return { result: "already" };

    const ship = this.grid[row][col];
    if (ship) {
      this.shots[row][col] = "hit";
      ship.hits.add(`${row},${col}`);
      const sunk = ship.hits.size === ship.length;
      return { result: "hit", ship, sunk };
    }
    this.shots[row][col] = "miss";
    return { result: "miss" };
  }

  isShipSunk(ship) {
    return ship.hits.size === ship.length;
  }

  allShipsSunk() {
    return this.ships.length > 0 && this.ships.every((s) => this.isShipSunk(s));
  }
}

/**
 * Computer opponent using a hunt/target strategy: fire randomly until a hit,
 * then target orthogonal neighbours of hits until the ship is sunk.
 */
export class ComputerPlayer {
  constructor(size = BOARD_SIZE) {
    this.size = size;
    this.targetQueue = []; // {row, col} cells to try next
    this.tried = new Set(); // "r,c" already fired at
  }

  reset() {
    this.targetQueue = [];
    this.tried = new Set();
  }

  key(row, col) {
    return `${row},${col}`;
  }

  _randomTarget() {
    // Prefer a checkerboard pattern — no ship can hide entirely on one colour.
    const cells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.tried.has(this.key(r, c))) continue;
        if ((r + c) % 2 === 0) cells.push({ row: r, col: c });
      }
    }
    const pool = cells.length
      ? cells
      : this._allUntried();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _allUntried() {
    const cells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.tried.has(this.key(r, c))) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  /** Chooses the next cell to attack on the given (opponent) board. */
  chooseMove() {
    while (this.targetQueue.length) {
      const cell = this.targetQueue.shift();
      if (!this.tried.has(this.key(cell.row, cell.col))) return cell;
    }
    return this._randomTarget();
  }

  /** Feeds back the outcome of a move so the strategy can adapt. */
  registerResult(row, col, result, sunk) {
    this.tried.add(this.key(row, col));
    if (result === "hit" && !sunk) {
      const neighbours = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
      ];
      for (const n of neighbours) {
        if (
          n.row >= 0 &&
          n.row < this.size &&
          n.col >= 0 &&
          n.col < this.size &&
          !this.tried.has(this.key(n.row, n.col))
        ) {
          this.targetQueue.push(n);
        }
      }
    }
    if (sunk) {
      // Ship destroyed — abandon any queued targets and resume hunting.
      this.targetQueue = [];
    }
  }
}
