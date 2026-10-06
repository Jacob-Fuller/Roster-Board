// Colours match the web app's light and dark themes.
export type Theme = {
  dark: boolean;
  bg: string; surface: string; surface2: string; border: string;
  text: string; textDim: string; textFaint: string;
  accent: string; accentInk: string; accentSoft: string;
  danger: string; todayRing: string; good: string;
};

export const light: Theme = {
  dark: false,
  bg: "#F4F3F0", surface: "#FFFFFF", surface2: "#ECEBE7", border: "#DCD9D2",
  text: "#14181F", textDim: "#596070", textFaint: "#6B7180",
  accent: "#1F3A5F", accentInk: "#FFFFFF", accentSoft: "#E2E8F1",
  danger: "#B42318", todayRing: "#1F3A5F", good: "#2F7D4F",
};

export const dark: Theme = {
  dark: true,
  bg: "#141210", surface: "#1D1A16", surface2: "#24201B", border: "#353029",
  text: "#F3EEE6", textDim: "#A59D91", textFaint: "#8F887D",
  accent: "#C08F5C", accentInk: "#1A140D", accentSoft: "#3A2C1D",
  danger: "#D98272", todayRing: "#C08F5C", good: "#8DB57F",
};
