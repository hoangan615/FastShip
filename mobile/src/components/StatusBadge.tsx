import { StyleSheet, Text, View } from "react-native";

const COLORS: Record<string, string> = {
  pending_confirmation: "#f59e0b",
  pending: "#f59e0b",
  assigned: "#3b82f6",
  picked_up: "#3b82f6",
  delivering: "#3b82f6",
  completed: "#16a34a",
  failed: "#dc2626",
  cancelled: "#6b7280",
  rejected: "#dc2626",
};

export function StatusBadge({ status }: { status: string }) {
  const color = COLORS[status] ?? "#6b7280";
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{status.replace(/_/g, " ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
