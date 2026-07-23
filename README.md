# Battleship

A classic Battleship game you can play in the browser against a computer opponent, built with [Vite](https://vitejs.dev/) and vanilla JavaScript.

## Play

- **Place your fleet** — click cells on *Your waters* to drop each ship. Use **Rotate** to switch between horizontal and vertical, or **Random fleet** to place everything automatically and jump straight into battle.
- **Battle** — click cells in *Enemy waters* to fire. Hits are marked red, misses blue. The computer fires back using a hunt-and-target strategy.
- Sink the entire enemy fleet before yours goes down. **New game** restarts at any time.

The standard fleet: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).

## Develop

Requires Node `^20.19.0 || >=22.12.0` (Vite 8 requirement).

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Project layout

- `src/game.js` — framework-agnostic game logic (`Board`, `ComputerPlayer`, fleet definitions).
- `src/main.js` — DOM rendering and UI wiring.
- `src/style.css` — styling.
