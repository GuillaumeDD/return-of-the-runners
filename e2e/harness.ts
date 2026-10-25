// Browser side of the replay test: runs every committed replay in the page's JS engine
// and exposes the checkpoint hashes for e2e/replay.spec.ts. Built with the same Vite
// pipeline as the game, never deployed.
import { runReplay } from "../src/sim/replay";
import { replayFixtures } from "../tests/helpers/replays";
import type { HarnessResult } from "./harness-types";

const out = document.getElementById("out");
try {
  const results = replayFixtures().map((f): HarnessResult => {
    const { state, checkpoints } = runReplay(f.replay);
    return { name: f.name, tick: state.tick, status: state.status, checkpoints };
  });
  window.replayResults = results;
  if (out) out.textContent = JSON.stringify(results, null, 2);
} catch (e) {
  // Shown by the spec instead of a bare timeout.
  window.replayError = String(e);
  if (out) out.textContent = window.replayError;
}
