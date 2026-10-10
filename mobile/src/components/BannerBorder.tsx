// The border a shift type can have, drawn around the inside of its banner.
// `ink` is the type's text colour, so every style reads on any banner colour.
import React from "react";
import { View, type ViewStyle } from "react-native";
import { BANNER_BORDERS } from "../lib/model";

const WHITE = "rgba(255,255,255,0.9)", DARK = "rgba(0,0,0,0.45)";

export function isBannerBorder(b?: string | null): boolean {
  return !!b && b !== "none" && (BANNER_BORDERS as readonly string[]).includes(b);
}

// `s` scales the drawing: 1 on the calendar, larger in the editor's preview tiles.
export function BannerBorder({ kind, ink, radius = 4, s = 1 }: { kind?: string | null; ink: string; radius?: number; s?: number }) {
  if (!isBannerBorder(kind)) return null;
  const at = (inset: number): ViewStyle => ({ position: "absolute", left: inset * s, right: inset * s, top: inset * s, bottom: inset * s });
  const line = (inset: number, width: number, color: string, extra?: ViewStyle) => (
    <View pointerEvents="none" style={[at(inset), { borderWidth: width * s, borderColor: color, borderRadius: Math.max(1, radius - inset) * s }, extra]} />
  );
  // every style stays within 3px of the edge, clear of the banner's title strip
  switch (kind) {
    case "thin": return line(1, 1, ink);
    case "thick": return line(0.75, 2, ink);
    case "double": return <>{line(0.5, 0.75, ink)}{line(2, 0.75, ink)}</>;
    case "dashed": return line(1, 1, ink, { borderStyle: "dashed" });
    case "dotted": return line(1, 1.5, ink, { borderStyle: "dotted" });
    case "white": return line(1, 1.5, WHITE);
    case "dark": return line(1, 1.5, DARK);
    case "stitched": return line(1.5, 1, WHITE, { borderStyle: "dashed" });
    case "glow": return <>{line(0, 1.5, "rgba(255,255,255,0.35)")}{line(1.5, 1, WHITE)}</>;
    case "frame": return <>{line(0.5, 1.25, ink)}{line(2.25, 0.6, ink, { opacity: 0.6 })}</>;
    case "rails": return (
      <View pointerEvents="none" style={[at(1), { borderTopWidth: 1.5 * s, borderBottomWidth: 1.5 * s, borderColor: ink }]} />
    );
    case "sides": return (
      <View pointerEvents="none" style={[at(1), { borderLeftWidth: 2 * s, borderRightWidth: 2 * s, borderColor: ink, borderRadius: Math.max(1, radius - 1) * s }]} />
    );
    case "left": return (
      <View pointerEvents="none" style={{ position: "absolute", left: 0.75 * s, top: 0.75 * s, bottom: 0.75 * s, width: 2.25 * s, borderRadius: 1.25 * s, backgroundColor: ink }} />
    );
    case "corners": {
      const L = 5 * s, w = 1.5 * s, o = 1 * s;
      const c = (pos: ViewStyle, sides: ViewStyle) => <View pointerEvents="none" style={[{ position: "absolute", width: L, height: L, borderColor: ink }, pos, sides]} />;
      return (<>
        {c({ left: o, top: o }, { borderLeftWidth: w, borderTopWidth: w, borderTopLeftRadius: 2 * s })}
        {c({ right: o, top: o }, { borderRightWidth: w, borderTopWidth: w, borderTopRightRadius: 2 * s })}
        {c({ left: o, bottom: o }, { borderLeftWidth: w, borderBottomWidth: w, borderBottomLeftRadius: 2 * s })}
        {c({ right: o, bottom: o }, { borderRightWidth: w, borderBottomWidth: w, borderBottomRightRadius: 2 * s })}
      </>);
    }
    case "dots": {
      const d = 2.25 * s, o = 0.5 * s;
      const dot = (pos: ViewStyle) => <View pointerEvents="none" style={[{ position: "absolute", width: d, height: d, borderRadius: d / 2, backgroundColor: ink }, pos]} />;
      return (<>
        {dot({ left: o, top: o })}{dot({ right: o, top: o })}{dot({ left: o, bottom: o })}{dot({ right: o, bottom: o })}
      </>);
    }
  }
  return null;
}
