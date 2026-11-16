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
  // the header band at the top of every tab: charcoal with a gold glow
  mast: string; mastInk: string; mastDim: string; mastBtn: string; glowA: string; glowB: string;
  mastFrom: string; mastTo: string; tabOn: string; tabOnInk: string;
};

export const light: Theme = {
  dark: false,
  bg: "#F4F2EE", surface: "#FFFFFF", surface2: "#ECE9E3", border: "#DEDAD2",
  text: "#17150F", textDim: "#5C574D", textFaint: "#6E695F",
  accent: "#2A2722", accentInk: "#F5EFE3", accentSoft: "#E6E2DA",
  danger: "#B42318", todayRing: "#2A2722", good: "#2F7D4F",
  hero: "#1C1A16", heroInk: "#F5EFE3", heroDim: "#BDB4A3",
  shadow: "#000000",
  mast: "#1A1916", mastInk: "#F5EFE3", mastDim: "#BDB4A3", mastBtn: "rgba(255,255,255,0.12)", glowA: "#2A2620", glowB: "#D4A946",
  mastFrom: "#2A2722", mastTo: "#121110", tabOn: "#1A1916", tabOnInk: "#F5EFE3",
};

export const dark: Theme = {
  dark: true,
  bg: "#121214", surface: "#1B1B1E", surface2: "#242428", border: "#2F2F34",
  text: "#F3EFE6", textDim: "#A8A39A", textFaint: "#8C877E",
  accent: "#D4A946", accentInk: "#17130A", accentSoft: "#2E2716",
  danger: "#E07A6B", todayRing: "#D4A946", good: "#7FBF7A",
  hero: "#1F1D19", heroInk: "#F5EFE3", heroDim: "#BDB4A3",
  shadow: "#000000",
  mast: "#1A1A1D", mastInk: "#F5EFE3", mastDim: "#BDB4A3", mastBtn: "rgba(255,255,255,0.10)", glowA: "#26241F", glowB: "#D4A946",
  mastFrom: "#26252A", mastTo: "#111113", tabOn: "#D4A946", tabOnInk: "#17130A",
};
