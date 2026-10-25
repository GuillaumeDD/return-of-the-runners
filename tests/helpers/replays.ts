import { fixturesFrom, type ReplayFixture } from "./replay-fixture";

// Bundled by Vite, so this also runs in the browser harness (e2e/).
const FILES = import.meta.glob<string>("../fixtures/replays/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
});

export function replayFixtures(): ReplayFixture[] {
  return fixturesFrom(Object.entries(FILES));
}
