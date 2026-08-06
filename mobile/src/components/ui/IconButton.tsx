import { Ionicons } from "@expo/vector-icons";
import { Pressable, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

export function IconButton({
  name,
  onPress,
  color,
  size = 20,
  variant = "plain",
  disabled = false,
  style,
  testID,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  size?: number;
  variant?: "plain" | "filled";
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const theme = useTheme();
  const fg = color ?? theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      testID={testID}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          backgroundColor: variant === "filled" ? theme.colors.primary : "transparent",
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={variant === "filled" ? theme.colors.primaryText : fg} />
    </Pressable>
  );
}
