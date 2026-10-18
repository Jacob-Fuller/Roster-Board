// The border a shift type can have, drawn around the inside of its banner.
// Every style is drawn in shades of the banner's own colour (a deeper tone, a
// lighter tone, or a soft white), so it looks part of the banner on any colour.
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View, type ViewStyle } from "react-native";
import { BANNER_BORDERS } from "../lib/model";

export function isBannerBorder(b?: string | null): boolean {
  return !!b && b !== "none" && (BANNER_BORDERS as readonly string[]).includes(b);
}

/* ---------- colour helpers ---------- */
function rgb(hex: string): [number, number, number] {
  let h = (hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
}
const mix = (hex: string, to: number, amt: number, alpha = 1) => {
  const [r, g, b] = rgb(hex);
  const m = (c: number) => Math.round(c + (to - c) * amt);
  return `rgba(${m(r)},${m(g)},${m(b)},${alpha})`;
};
const deep = (hex: string, a = 1) => mix(hex, 0, 0.42, a);   // a deeper tone of the banner colour
const light = (hex: string, a = 1) => mix(hex, 255, 0.55, a); // a lighter tone

// `bg` is the banner colour, `ink` its text colour. `s` scales the drawing: 1 on the calendar, larger in the editor.
export function BannerBorder({ kind, bg, ink, radius = 5, s = 1 }: { kind?: string | null; bg: string; ink: string; radius?: number; s?: number }) {
  if (!isBannerBorder(kind)) return null;
  const at = (inset: number): ViewStyle => ({ position: "absolute", left: inset * s, right: inset * s, top: inset * s, bottom: inset * s });
  const r = (inset: number) => Math.max(1, radius - inset) * s;
  const line = (inset: number, width: number, color: string, extra?: ViewStyle) => (
    <View pointerEvents="none" style={[at(inset), { borderWidth: width * s, borderColor: color, borderRadius: r(inset) }, extra]} />
  );
  // every style stays within 3px of the edge, clear of the banner's text
  switch (kind) {
    // a fine inner line in a deeper tone
    case "thin": return line(1.25, 0.9, deep(bg, 0.85));
    // a bold edge in a deeper tone
    case "thick": return line(0, 2, deep(bg));
    // two fine lines
    case "double": return <>{line(0.75, 0.8, deep(bg, 0.9))}{line(2.5, 0.6, deep(bg, 0.6))}</>;
    // a light rim with a deeper outer edge, like a raised button
    case "dashed": return <>{line(0, 0.9, deep(bg, 0.9))}{line(0.9, 1, light(bg, 0.85))}</>;
    // soft white rim
    case "white": return line(1, 1.25, "rgba(255,255,255,0.82)");
    // the banner's own text colour, softened
    case "dark": return line(1, 1.25, ink, { opacity: 0.55 });
    // glossy top: a soft white sheen fading down the banner
    case "glow": return (
      <>
        <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.45)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.6 }}
          style={[at(0), { borderRadius: r(0) }]} />
        {line(0.5, 0.75, "rgba(255,255,255,0.55)")}
      </>
    );
    // shaded: lighter at the top, deeper at the bottom
    case "dotted": return (
      <LinearGradient pointerEvents="none" colors={[light(bg, 0.0), deep(bg, 0.45)]} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }}
        style={[at(0), { borderRadius: r(0) }]} />
    );
    // raised: light top and left edges, deep bottom and right
    case "frame": return (
      <View pointerEvents="none" style={[at(0), {
        borderRadius: r(0), borderTopWidth: 1.25 * s, borderLeftWidth: 1.25 * s, borderBottomWidth: 1.5 * s, borderRightWidth: 1.5 * s,
        borderTopColor: light(bg, 0.9), borderLeftColor: light(bg, 0.7), borderBottomColor: deep(bg, 0.85), borderRightColor: deep(bg, 0.7),
      }]} />
    );
    // pressed in: deep top and left, light bottom and right
    case "dots": return (
      <View pointerEvents="none" style={[at(0), {
        borderRadius: r(0), borderTopWidth: 1.5 * s, borderLeftWidth: 1.5 * s, borderBottomWidth: 1 * s, borderRightWidth: 1 * s,
        borderTopColor: deep(bg, 0.8), borderLeftColor: deep(bg, 0.6), borderBottomColor: light(bg, 0.8), borderRightColor: light(bg, 0.6),
      }]} />
    );
    // fine lines along the top and bottom, stopping short of the corners
    case "rails": return (
      <>
        <View pointerEvents="none" style={{ position: "absolute", left: 3 * s, right: 3 * s, top: 1.25 * s, height: 1 * s, borderRadius: 1, backgroundColor: deep(bg, 0.9) }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 3 * s, right: 3 * s, bottom: 1.25 * s, height: 1 * s, borderRadius: 1, backgroundColor: deep(bg, 0.9) }} />
      </>
    );
    // rounded brackets either side
    case "sides": return (
      <View pointerEvents="none" style={[at(1), { borderLeftWidth: 1.75 * s, borderRightWidth: 1.75 * s, borderColor: deep(bg, 0.9), borderRadius: r(1) }]} />
    );
    // an accent bar down the left edge
    case "left": return (
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3 * s, backgroundColor: deep(bg) }} />
    );
    // neat rounded corners
    case "corners": {
      const L = 4.5 * s, w = 1.25 * s, o = 1.25 * s, c = deep(bg, 0.95);
      const k = (pos: ViewStyle, sides: ViewStyle) => <View pointerEvents="none" style={[{ position: "absolute", width: L, height: L, borderColor: c }, pos, sides]} />;
      return (<>
        {k({ left: o, top: o }, { borderLeftWidth: w, borderTopWidth: w, borderTopLeftRadius: 2.5 * s })}
        {k({ right: o, top: o }, { borderRightWidth: w, borderTopWidth: w, borderTopRightRadius: 2.5 * s })}
        {k({ left: o, bottom: o }, { borderLeftWidth: w, borderBottomWidth: w, borderBottomLeftRadius: 2.5 * s })}
        {k({ right: o, bottom: o }, { borderRightWidth: w, borderBottomWidth: w, borderBottomRightRadius: 2.5 * s })}
      </>);
    }
    // a fine white stitch line
    case "stitched": return line(1.5, 0.8, "rgba(255,255,255,0.75)", { borderStyle: "dashed" });
  }
  return null;
}
