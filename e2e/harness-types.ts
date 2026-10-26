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

/** What `e2e/share.ts` returns for a payload. */
export type SharedResult =
  | { readonly ok: true; readonly level: unknown }
  | { readonly ok: false; readonly codes: readonly string[] };

declare global {
  interface Window {
    shareDecode?: (payload: string) => Promise<SharedResult>;
    shareEncode?: (levelText: string) => Promise<string>;
  }
}
