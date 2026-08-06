import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme";

export function StatusBadge({ status }: { status: string }) {
  const theme = useTheme();
  const { bg, fg, border, icon } = theme.statusColors(status);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border, borderRadius: theme.radius.sm },
      ]}
    >
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={12} color={fg} style={styles.icon} />
      <Text style={[styles.text, { color: fg }]}>{status.replace(/_/g, " ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
});
