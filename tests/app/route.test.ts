import { describe, expect, it } from "vitest";
import { MAX_SHARE_PAYLOAD, parseRoute, routeHash, type Route } from "../../src/app/route";

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

  it("rejects a payload longer than the share-link cap, without keeping it", () => {
    expect(parseRoute("#level=" + "a".repeat(MAX_SHARE_PAYLOAD))).toEqual({
      screen: "shared",
      payload: "a".repeat(MAX_SHARE_PAYLOAD),
    });
    expect(parseRoute("#level=" + "a".repeat(MAX_SHARE_PAYLOAD + 1))).toEqual({ screen: "play" });
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
