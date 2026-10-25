// What the browser harness exposes to e2e/replay.spec.ts.

export interface HarnessResult {
  readonly name: string;
  readonly tick: number;
  readonly status: string;
  readonly checkpoints: readonly number[];
}

declare global {
  interface Window {
    replayResults?: readonly HarnessResult[];
    replayError?: string;
  }
}
