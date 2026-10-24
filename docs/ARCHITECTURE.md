# Architecture

## Overview

Static single-page app built with Vite, deployed to GitHub Pages. No backend.

```
index.html ── src/main.ts        entry point: wires DOM, input, rendering
              src/i18n/          UI strings (en, fr) — no hard-coded user-facing text
              src/sim/           (step 1) pure, deterministic game simulation
              src/render/        (step 1) Canvas 2D rendering of a simulation state
```

## Principles

- **Simulation is pure and deterministic.** Fixed timestep, integer ticks, integer
  grid coordinates, seeded PRNG. It never touches the DOM, time or audio. Rendering
  reads its state; input is fed to it as per-tick commands. This makes gameplay
  unit-testable and replayable.
- **Untrusted input is validated at the boundary.** Level files and share links go
  through a strict schema validator before reaching the simulation.
- **Strict Content Security Policy** in `index.html`: only same-origin scripts and
  styles, no inline code, no `eval`.

## Observed behavior of the original game

Each entry: the rule or timing, its value, and its provenance (video link +
timestamp, or own playtest). Filled in as gameplay is implemented.

| Behavior     | Value | Provenance |
| ------------ | ----- | ---------- |
| _(none yet)_ |       |            |

## Intentional deviations from the original

| Deviation    | Reason |
| ------------ | ------ |
| _(none yet)_ |        |
