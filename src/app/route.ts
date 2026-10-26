/**
 * Screens are chosen by the URL hash, so the back button works and nothing needs a
 * server: `#play` (default), `#edit`, `#level=<payload>` (a shared level, B-017).
 * The hash is untrusted input: anything unknown falls back to play.
 */

export type Route =
  | { readonly screen: "play" }
  | { readonly screen: "edit" }
  | { readonly screen: "shared"; readonly payload: string };

const SHARED_PREFIX = "#level=";

export function parseRoute(hash: string): Route {
  if (hash === "#edit") return { screen: "edit" };
  if (hash.startsWith(SHARED_PREFIX)) {
    const payload = hash.slice(SHARED_PREFIX.length);
    // Any length: a payload over the cap is refused by the decoder, with a message.
    if (payload.length > 0) return { screen: "shared", payload };
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

/** The share link of a payload: this page's address (`href`), its hash replaced. */
export function shareUrl(href: string, payload: string): string {
  const hash = href.indexOf("#");
  return (hash === -1 ? href : href.slice(0, hash)) + routeHash({ screen: "shared", payload });
}
