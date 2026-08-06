import type { ViewStyle } from "react-native";
import type { ColorPalette } from "./colors";

export function cardShadow(palette: ColorPalette, scheme: "light" | "dark"): ViewStyle {
  if (scheme === "dark") {
    // Black shadows are invisible on dark backgrounds — lean on a subtle border instead.
    return {
      borderWidth: 1,
      borderColor: palette.border,
    };
  }
  return {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: palette.border,
  };
}

export function raisedShadow(palette: ColorPalette, scheme: "light" | "dark"): ViewStyle {
  if (scheme === "dark") {
    return {
      borderWidth: 1,
      borderColor: palette.border,
    };
  }
  return {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  };
}
