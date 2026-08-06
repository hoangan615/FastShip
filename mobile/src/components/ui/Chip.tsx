import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/theme";

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.radius.sm,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.infoBg : theme.colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? theme.colors.primary : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "500",
    fontSize: 13,
    textTransform: "capitalize",
  },
});
