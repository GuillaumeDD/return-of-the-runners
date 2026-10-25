/**
 * Screens are chosen by the URL hash, so the back button works and nothing needs a
 * server: `#play` (default), `#edit`, `#level=<payload>` (a shared level, B-017).
 * The hash is untrusted input: anything unknown falls back to play.
 */

export type Route =
  | { readonly screen: "play" }
  | { readonly screen: "edit" }
  | { readonly screen: "shared"; readonly payload: string };

/** Longest share-link payload accepted; longer ones are never decoded. */
export const MAX_SHARE_PAYLOAD = 16 * 1024;

const SHARED_PREFIX = "#level=";

export function parseRoute(hash: string): Route {
  if (hash === "#edit") return { screen: "edit" };
  if (hash.startsWith(SHARED_PREFIX)) {
    const payload = hash.slice(SHARED_PREFIX.length);
    if (payload.length > 0 && payload.length <= MAX_SHARE_PAYLOAD) {
      return { screen: "shared", payload };
    }
  }
  return { screen: "play" };
}

export function routeHash(route: Route): string {
  switch (route.screen) {
    case "play":
      return "#play";
    case "edit":
      return "#edit";
    case "shared":
      return SHARED_PREFIX + route.payload;
  }
}
