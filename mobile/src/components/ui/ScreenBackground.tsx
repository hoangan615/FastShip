import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

// A single shared background layer (soft gradient + two low-opacity glow blobs)
// used behind every screen. Always absolute + pointerEvents="none" so it never
// intercepts touches or shifts layout — content keeps its own opaque Card/surface
// backgrounds, so this only shows through in the gaps between them.
export function ScreenBackground() {
  const theme = useTheme();
  const isDark = theme.scheme === "dark";

  const gradientColors: [string, string] = isDark
    ? [theme.colors.background, theme.colors.surface]
    : [theme.colors.background, theme.colors.infoBg];

  // A flat-color circle reads as a hard graphic shape, not a soft glow — RN has no
  // portable blur filter, so fade the circle's own fill from tinted to fully
  // transparent instead: the geometric edge lands on near-zero alpha, so it's
  // imperceptible and the whole shape reads as a soft, corner-anchored glow.
  const glowAlpha = isDark ? "26" : "18";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[theme.colors.primary + glowAlpha, theme.colors.primary + "00"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: "absolute", top: -160, right: -140, width: 320, height: 320, borderRadius: 160 }}
      />
      <LinearGradient
        colors={[theme.colors.primary + glowAlpha, theme.colors.primary + "00"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: -180, left: -160, width: 320, height: 320, borderRadius: 160 }}
      />
    </View>
  );
}
