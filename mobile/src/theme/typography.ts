import type { TextStyle } from "react-native";

export const typography: Record<string, TextStyle> = {
  display: { fontSize: 32, fontWeight: "800" },
  title: { fontSize: 22, fontWeight: "800" },
  heading: { fontSize: 18, fontWeight: "700" },
  subheading: { fontSize: 15, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  bodyStrong: { fontSize: 15, fontWeight: "600" },
  caption: { fontSize: 13, fontWeight: "500" },
  small: { fontSize: 12, fontWeight: "600" },
};
