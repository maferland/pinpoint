import { describe, expect, it } from "bun:test";
import { getImageLayout, hitTestAnnotation, type ImageLayout } from "./canvas-layer.tsx";
import type { PinpointAnnotation } from "./types.ts";

const viewport = { width: 1000, height: 800 };

describe("getImageLayout", () => {
  describe("fit mode", () => {
    it("scales mobile portrait up to fill the viewport height", () => {
      // 390x844 in a 1000x800 viewport — height is the limiting axis.
      const layout = getImageLayout(viewport, { width: 390, height: 844 }, "fit");
      expect(layout.drawH).toBe(800);
      expect(layout.drawW).toBe(Math.round(390 * (800 / 844)));
    });

    it("scales a large desktop screenshot down to fit", () => {
      const layout = getImageLayout(viewport, { width: 2880, height: 1800 }, "fit");
      // 1000/2880 = 0.347, 800/1800 = 0.444 — width limits, so drawW = 1000.
      expect(layout.drawW).toBe(1000);
      expect(layout.drawH).toBe(Math.round(1800 * (1000 / 2880)));
    });

    it("upscales small images so they fill the viewport", () => {
      const layout = getImageLayout(viewport, { width: 200, height: 100 }, "fit");
      expect(layout.drawW).toBeGreaterThan(200);
    });

    it("falls back to single-axis fit on stitched scrolls instead of a sliver", () => {
      // 389x85910 fit-both-axes is a 4-px-wide stripe — unreadable. Switch to
      // width-fit (capped at 1x) so the image is visible with vertical scroll.
      const layout = getImageLayout(viewport, { width: 389, height: 85910 }, "fit");
      expect(layout.drawW).toBe(389);
      expect(layout.drawH).toBe(85910);
    });
  });

  describe("actual mode", () => {
    it("caps an extremely tall stitched screenshot at native width", () => {
      // 800x6000 — tall, stitched scroll. Should scroll vertically, not squash.
      const layout = getImageLayout(viewport, { width: 800, height: 6000 }, "actual");
      expect(layout.drawW).toBe(800);
      expect(layout.drawH).toBe(6000);
    });

    it("caps an extremely wide image at native height", () => {
      const layout = getImageLayout(viewport, { width: 5000, height: 400 }, "actual");
      expect(layout.drawH).toBe(400);
      expect(layout.drawW).toBe(5000);
    });
  });
});

describe("hitTestAnnotation", () => {
  const layout: ImageLayout = { drawW: 1000, drawH: 1000 };

  function pin(id: string, x: number, y: number): PinpointAnnotation {
    return { id, number: 1, imageIndex: 0, pin: { x, y }, comment: "" };
  }
  function boxed(id: string, x: number, y: number, w: number, h: number): PinpointAnnotation {
    return {
      id, number: 1, imageIndex: 0,
      pin: { x, y },
      box: { x, y, width: w, height: h },
      comment: "",
    };
  }

  it("returns null when nothing is nearby", () => {
    expect(hitTestAnnotation({ x: 500, y: 500 }, [pin("a", 10, 10)], layout)).toBeNull();
  });

  it("hits a pin within HIT_RADIUS, returning the topmost when stacked", () => {
    // Pin at 10%/10% = pixel (100, 100). HIT_RADIUS = 22.
    expect(hitTestAnnotation({ x: 115, y: 115 }, [pin("a", 10, 10)], layout)).toBe("a");
    expect(hitTestAnnotation({ x: 100, y: 100 }, [pin("under", 10, 10), pin("top", 10, 10)], layout)).toBe("top");
  });

  it("hits a box's border but not its interior, and prefers pins when both apply", () => {
    // Box at (20%,20%) sized 40%x40% → pixel rect (200,200,400,400). Border hit = 8px.
    const ann = boxed("a", 20, 20, 40, 40);
    expect(hitTestAnnotation({ x: 200, y: 400 }, [ann], layout)).toBe("a");      // left edge
    expect(hitTestAnnotation({ x: 603, y: 400 }, [ann], layout)).toBe("a");      // 3px outside right (in ring)
    expect(hitTestAnnotation({ x: 400, y: 400 }, [ann], layout)).toBeNull();     // interior — place a new pin

    // Pin on top of a box edge — pin wins.
    expect(hitTestAnnotation({ x: 200, y: 600 }, [ann, pin("p", 20, 60)], layout)).toBe("p");
  });

  it("treats a click-sized box as a pin only (no border ring)", () => {
    // Box of CLICK_BOX_SIZE — placed by a bare click. No border ring should activate.
    expect(hitTestAnnotation({ x: 360, y: 360 }, [boxed("c", 30, 30, 6, 6)], layout)).toBeNull();
  });

  it("returns null when layout has zero width", () => {
    expect(hitTestAnnotation({ x: 100, y: 100 }, [pin("a", 10, 10)], { drawW: 0, drawH: 0 })).toBeNull();
  });
});
