import { describe, expect, it } from "vitest";
import { markMapTileDecorative } from "@/components/map";

describe("Nigeria map tile accessibility", () => {
  it("gives generated map tiles an explicit decorative alt attribute", () => {
    const tile = document.createElement("img");

    markMapTileDecorative(tile);

    expect(tile).toHaveAttribute("alt", "");
  });
});
