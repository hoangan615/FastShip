import { View, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

type Variant = "default" | "tinted-danger" | "tinted-warning";

export function Card({
  children,
  variant = "default",
  style,
}: {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle;
}) {
  const theme = useTheme();

  const backgroundColor =
    variant === "tinted-danger"
      ? theme.colors.dangerBg
      : variant === "tinted-warning"
        ? theme.colors.warningBg
        : theme.colors.surfaceAlt;

  const borderColor =
    variant === "tinted-danger"
      ? theme.colors.dangerFg + "33"
      : variant === "tinted-warning"
        ? theme.colors.warningFg + "33"
        : theme.colors.border;

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor,
        },
        theme.scheme === "light" && variant === "default" ? theme.cardShadow : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
