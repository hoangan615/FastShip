import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";

export function tabIcon(focusedName: keyof typeof Ionicons.glyphMap, outlineName: keyof typeof Ionicons.glyphMap) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : outlineName} size={size} color={color as string} />
  );
}
