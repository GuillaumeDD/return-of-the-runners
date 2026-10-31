import type { World } from "../level/format";
import type { MessageKey } from ".";

/** The translated name of each world. A `Record`, so a new world without a name fails the build. */
export const WORLD_NAME: Readonly<Record<World, MessageKey>> = {
  moss: "worldMoss",
  fungus: "worldFungus",
  ancient: "worldAncient",
  crystal: "worldCrystal",
  ice: "worldIce",
  fossil: "worldFossil",
  lava: "worldLava",
  phosphorus: "worldPhosphorus",
  dark: "worldDark",
  industrial: "worldIndustrial",
};
