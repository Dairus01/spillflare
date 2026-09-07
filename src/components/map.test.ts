import { describe, expect, it } from "vitest";
import L from "leaflet";
import { createAccessibleTileLayer, markMapTileDecorative } from "@/components/map";

describe("Nigeria map tile accessibility", () => {
  it("gives generated map tiles an explicit decorative alt attribute", () => {
    const tile = document.createElement("img");

    markMapTileDecorative(tile);

    expect(tile).toHaveAttribute("alt", "");
  });

  it("sets the decorative alt before a Leaflet tile enters the DOM", () => {
    const layer = createAccessibleTileLayer(L, "https://tiles.example/{z}/{x}/{y}", {});
    const tile = (layer as unknown as { createTile: (coords: L.Coords, done: L.DoneCallback) => HTMLElement }).createTile(
      L.point(0, 0) as L.Coords,
      () => undefined,
    );

    expect(tile).toHaveAttribute("alt", "");
  });
});
