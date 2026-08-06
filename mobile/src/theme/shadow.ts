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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 6,
    elevation: 2,
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  };
}
