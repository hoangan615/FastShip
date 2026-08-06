import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { dark, light, statusColors, type ColorPalette } from "./colors";
import { radius } from "./radius";
import { cardShadow, raisedShadow } from "./shadow";
import { spacing } from "./spacing";
import { typography } from "./typography";

export interface Theme {
  scheme: "light" | "dark";
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  cardShadow: ReturnType<typeof cardShadow>;
  raisedShadow: ReturnType<typeof raisedShadow>;
  statusColors: (status: string) => ReturnType<typeof statusColors>;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const value = useMemo<Theme>(() => {
    const colors = scheme === "dark" ? dark : light;
    return {
      scheme,
      colors,
      spacing,
      radius,
      typography,
      cardShadow: cardShadow(colors, scheme),
      raisedShadow: raisedShadow(colors, scheme),
      statusColors: (status: string) => statusColors(colors, status),
    };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
