import { DrawCircleByDiameterMode } from "@deck.gl-community/editable-layers";

export class DrawCircleByDiameterNoTooltips extends DrawCircleByDiameterMode {
  override getTooltips() {
    return [];
  }
}
