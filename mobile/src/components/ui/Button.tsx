import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  icon,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.colors.primary, fg: theme.colors.primaryText },
    secondary: { bg: theme.colors.surfaceAlt, fg: theme.colors.text, border: theme.colors.border },
    danger: { bg: theme.colors.danger, fg: theme.colors.textInverse },
    ghost: { bg: "transparent", fg: theme.colors.text },
  };
  const p = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={p.fg} style={styles.icon} />}
          <Text style={[styles.label, { color: p.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
  },
  icon: {
    marginRight: 8,
  },
});
