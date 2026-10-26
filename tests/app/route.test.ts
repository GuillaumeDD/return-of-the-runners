import { describe, expect, it } from "vitest";
import { parseRoute, routeHash, shareUrl, type Route } from "../../src/app/route";
import { MAX_SHARE_PAYLOAD } from "../../src/share/link";

describe("parseRoute", () => {
  it("defaults to play", () => {
    for (const hash of ["", "#", "#play"])
      expect(parseRoute(hash), hash).toEqual({ screen: "play" });
  });

  it("recognizes the editor and shared levels", () => {
    expect(parseRoute("#edit")).toEqual({ screen: "edit" });
    expect(parseRoute("#level=abc")).toEqual({ screen: "shared", payload: "abc" });
  });

  it("falls back to play on anything unknown", () => {
    for (const hash of [
      "#Edit",
      "#edit/",
      "#editor",
      "#level",
      "#level=",
      "edit",
      "#play?x",
      "#<script>",
    ]) {
      expect(parseRoute(hash), hash).toEqual({ screen: "play" });
    }
  });

  // Regression (self-review): a payload over the cap fell back to the bundled level, so
  // the decoder's "link too long" message could never show.
  it("keeps a payload over the share-link cap, for the decoder to refuse with a message", () => {
    const long = "a".repeat(MAX_SHARE_PAYLOAD + 1);
    expect(parseRoute("#level=" + long)).toEqual({ screen: "shared", payload: long });
  });
});

describe("routeHash", () => {
  it("round-trips every known route", () => {
    const routes: Route[] = [
      { screen: "play" },
      { screen: "edit" },
      { screen: "shared", payload: "eJyrVkrLz1-_" },
    ];
    for (const r of routes) expect(parseRoute(routeHash(r))).toEqual(r);
  });
});

describe("shareUrl", () => {
  it("is this page's address with the hash replaced by the payload", () => {
    const base = "https://guillaumedd.github.io/return-of-the-runners/";
    expect(shareUrl(base, "abc")).toBe(`${base}#level=abc`);
    expect(shareUrl(`${base}#edit`, "abc")).toBe(`${base}#level=abc`);
    expect(shareUrl(`${base}?x=1#level=old`, "abc")).toBe(`${base}?x=1#level=abc`);
  });
});
