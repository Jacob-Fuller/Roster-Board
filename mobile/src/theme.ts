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
  // the header band at the top of every tab: deep night-shift navy with a sunrise glow
  mast: string; mastInk: string; mastDim: string; mastBtn: string; glowA: string; glowB: string;
  mastFrom: string; mastTo: string; tabOn: string; tabOnInk: string;
};

export const light: Theme = {
  dark: false,
  bg: "#EEF1F5", surface: "#FFFFFF", surface2: "#E7EAF0", border: "#D8DDE5",
  text: "#121826", textDim: "#555E6E", textFaint: "#6B7382",
  accent: "#1F3A5F", accentInk: "#FFFFFF", accentSoft: "#E1E8F2",
  danger: "#B42318", todayRing: "#1F3A5F", good: "#2F7D4F",
  hero: "#1B3354", heroInk: "#FFFFFF", heroDim: "#B9C6D8",
  shadow: "#0B1A30",
  mast: "#132849", mastInk: "#FFFFFF", mastDim: "#AEBFD7", mastBtn: "rgba(255,255,255,0.14)", glowA: "#3F73B8", glowB: "#E7A75C",
  mastFrom: "#1E3D69", mastTo: "#0D1D36", tabOn: "#132849", tabOnInk: "#FFFFFF",
};

export const dark: Theme = {
  dark: true,
  bg: "#12100E", surface: "#1C1915", surface2: "#26221C", border: "#332E27",
  text: "#F4EFE7", textDim: "#A79F93", textFaint: "#91897E",
  accent: "#C8975F", accentInk: "#1A140D", accentSoft: "#3A2C1D",
  danger: "#D98272", todayRing: "#C8975F", good: "#8DB57F",
  hero: "#2A2119", heroInk: "#F7E9D6", heroDim: "#C7B39A",
  shadow: "#000000",
  mast: "#211A13", mastInk: "#F7E9D6", mastDim: "#C2AE95", mastBtn: "rgba(255,255,255,0.10)", glowA: "#3A2B1C", glowB: "#C8975F",
  mastFrom: "#33271B", mastTo: "#17120D", tabOn: "#C8975F", tabOnInk: "#1A140D",
};
