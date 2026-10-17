// Colours match the web app's light and dark themes.
export type Theme = {
  dark: boolean;
  bg: string; surface: string; surface2: string; border: string;
  text: string; textDim: string; textFaint: string;
  accent: string; accentInk: string; accentSoft: string;
  danger: string; todayRing: string; good: string;
  // the one bold surface (estimated pay hero) and its ink
  hero: string; heroInk: string; heroDim: string;
  shadow: string;
};

export const light: Theme = {
  dark: false,
  bg: "#F1F2F4", surface: "#FFFFFF", surface2: "#E9EBEF", border: "#DADDE3",
  text: "#121826", textDim: "#555E6E", textFaint: "#6B7382",
  accent: "#1F3A5F", accentInk: "#FFFFFF", accentSoft: "#E1E8F2",
  danger: "#B42318", todayRing: "#1F3A5F", good: "#2F7D4F",
  hero: "#1B3354", heroInk: "#FFFFFF", heroDim: "#B9C6D8",
  shadow: "#0B1A30",
};

export const dark: Theme = {
  dark: true,
  bg: "#12100E", surface: "#1C1915", surface2: "#26221C", border: "#332E27",
  text: "#F4EFE7", textDim: "#A79F93", textFaint: "#91897E",
  accent: "#C8975F", accentInk: "#1A140D", accentSoft: "#3A2C1D",
  danger: "#D98272", todayRing: "#C8975F", good: "#8DB57F",
  hero: "#2A2119", heroInk: "#F7E9D6", heroDim: "#C7B39A",
  shadow: "#000000",
};
