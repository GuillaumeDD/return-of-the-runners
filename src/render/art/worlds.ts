/**
 * The look of each world (ARCHITECTURE § Art direction): one terrain colour, a heavier
 * bedrock, a lit top edge, and a dim backdrop of the same hue, darker by night. Moss is
 * the B-033 set; the other nine follow its pattern. All _provisional_; the painted
 * backdrops are `backdrops.ts`, the details are drawn by `tiles.ts` (B-045).
 */
import type { World } from "../../level/format";

/**
 * What a world adds to its slabs, drawn inside the cell: grass blades or mushroom caps
 * on the top edge, crystals jutting from it, icicles or glowing drips under the bottom
 * edge, carved glyphs, fossil shells or glowing cracks in the face, rivets on the plates.
 */
export type Detail =
  | "blades"
  | "caps"
  | "glyphs"
  | "crystals"
  | "icicles"
  | "shells"
  | "cracks"
  | "drips"
  | "none"
  | "rivets";

export interface WorldArt {
  /** Diggable slab shades, darkest to lightest (five). */
  readonly soft: readonly [string, string, string, string, string];
  /** Bedrock shades, darkest to lightest (five). */
  readonly hard: readonly [string, string, string, string, string];
  /** The lit top edge of a diggable slab: light, then its lower rim. */
  readonly top: readonly [string, string];
  /** The lit top edge of bedrock. */
  readonly hardTop: readonly [string, string];
  /** The world's own touch on its diggable slabs (`Detail`). */
  readonly detail: Detail;
  /** The colour of the backdrop's small lights (fireflies, spores, embers…). */
  readonly glow: string;
  /** The backdrop, top to bottom, by day and by night. */
  readonly day: readonly [string, string];
  readonly night: readonly [string, string];
}

const GREY_STONE = {
  hard: ["#3c4644", "#4a5552", "#5f6b67", "#7a8681", "#8a9690"],
  hardTop: ["#b9c2c4", "#6f7a7c"],
} as const;

export const WORLD_ART: Readonly<Record<World, WorldArt>> = {
  moss: {
    soft: ["#2f6b25", "#4c8f2f", "#5ea83a", "#7fbf4a", "#a6d867"],
    ...GREY_STONE,
    top: ["#c8f27a", "#5fb339"],
    detail: "blades",
    glow: "#e6ff8c",
    day: ["#1c3a24", "#0b1c12"],
    night: ["#0b1820", "#03080a"],
  },
  fungus: {
    soft: ["#4f2a45", "#6d3a5f", "#874a76", "#a5648f", "#c588ad"],
    hard: ["#3a2e2a", "#4a3c36", "#5c4c44", "#715f55", "#857164"],
    top: ["#f3c3db", "#b35a87"],
    hardTop: ["#a89283", "#5c4c44"],
    detail: "caps",
    glow: "#ffb3e6",
    day: ["#2e1c2c", "#140b14"],
    night: ["#130f22", "#06040c"],
  },
  ancient: {
    soft: ["#7a5a2e", "#94703c", "#ad874c", "#c4a062", "#dcbd84"],
    hard: ["#3e4250", "#4c5160", "#5d6374", "#737a8c", "#888fa0"],
    top: ["#f2dfae", "#c49a55"],
    hardTop: ["#b4bccc", "#5d6374"],
    detail: "glyphs",
    glow: "#ffe6b0",
    day: ["#3a2c1a", "#18110a"],
    night: ["#141626", "#06070e"],
  },
  crystal: {
    soft: ["#3b2a6b", "#4f3b8f", "#6650b0", "#846ed0", "#ab97ec"],
    hard: ["#2a2638", "#363148", "#443e5a", "#57506e", "#6a6284"],
    top: ["#e6dcff", "#8f78e0"],
    hardTop: ["#a49cc4", "#443e5a"],
    detail: "crystals",
    glow: "#d9ccff",
    day: ["#20183e", "#0c0a1c"],
    night: ["#0d0c24", "#04040e"],
  },
  ice: {
    soft: ["#3f74a0", "#5a91bf", "#7cb0d9", "#a3cdec", "#d2ecfb"],
    hard: ["#24324a", "#2f405c", "#3d5070", "#506586", "#647a9c"],
    top: ["#ffffff", "#a9dcfa"],
    hardTop: ["#a8bcd8", "#3d5070"],
    detail: "icicles",
    glow: "#f0faff",
    day: ["#1b3550", "#0a1828"],
    night: ["#0a1426", "#03060e"],
  },
  fossil: {
    soft: ["#6b5b45", "#837057", "#9c886b", "#b6a385", "#d3c3a3"],
    hard: ["#3a3530", "#48423c", "#59524a", "#6e665c", "#837a6e"],
    top: ["#f0e6cc", "#b39f78"],
    hardTop: ["#b0a698", "#59524a"],
    detail: "shells",
    glow: "#f2e2c0",
    day: ["#2e2a20", "#14120c"],
    night: ["#14141c", "#07070a"],
  },
  lava: {
    soft: ["#8a3a14", "#a8501e", "#c6672a", "#dd8540", "#f2a35e"],
    hard: ["#1e1a1a", "#2b2524", "#3a3230", "#4a403c", "#5a4e48"],
    top: ["#ffd9a0", "#e07a35"],
    hardTop: ["#7a6a62", "#3a302c"],
    detail: "cracks",
    glow: "#ffa040",
    day: ["#3a0f08", "#1a0503"],
    night: ["#1e0806", "#080202"],
  },
  phosphorus: {
    soft: ["#5a1450", "#781f6c", "#962c88", "#b542a6", "#d466c6"],
    hard: ["#1d2a2e", "#26363b", "#31454b", "#3f565d", "#4f6a72"],
    top: ["#ffc6f2", "#c24eae"],
    hardTop: ["#7fb3b8", "#31454b"],
    detail: "drips",
    glow: "#8cffd9",
    day: ["#26102c", "#0e0612"],
    night: ["#0c0a1e", "#04030a"],
  },
  dark: {
    soft: ["#1c2030", "#262b3e", "#31384e", "#3e4762", "#505b7a"],
    hard: ["#141418", "#1c1c22", "#25252d", "#30303a", "#3c3c48"],
    top: ["#8a9cc4", "#3e4762"],
    hardTop: ["#5c5c6c", "#25252d"],
    detail: "none",
    glow: "#9fb4ff",
    day: ["#10121c", "#05060a"],
    night: ["#06070c", "#010103"],
  },
  industrial: {
    soft: ["#4a4d52", "#5b5f65", "#6e737a", "#858b93", "#a1a8b1"],
    hard: ["#26282c", "#303338", "#3c4046", "#4a4f56", "#5a6068"],
    top: ["#d6dce2", "#7d848c"],
    hardTop: ["#8a9098", "#3c4046"],
    detail: "rivets",
    glow: "#ffcc66",
    day: ["#2e2a22", "#12100c"],
    night: ["#12141a", "#050608"],
  },
};
