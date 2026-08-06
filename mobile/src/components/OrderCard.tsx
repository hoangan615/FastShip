import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/theme";
import type { Order } from "@/types/api";

export function OrderCard({ order }: { order: Order }) {
  const theme = useTheme();

  return (
    <Link href={`/order/${order.id}`} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.lg,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.85 : 1,
          },
          theme.scheme === "light" ? theme.cardShadow : null,
        ]}
      >
        <View style={styles.row}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Order #{order.id.slice(0, 8)}
          </Text>
          <StatusBadge status={order.status} />
        </View>
        <View style={styles.routeRow}>
          <Ionicons name="storefront-outline" size={13} color={theme.colors.textMuted} />
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {order.pickup_addr.address}
          </Text>
        </View>
        <View style={styles.routeRow}>
          <Ionicons name="chevron-forward" size={13} color={theme.colors.textMuted} />
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {order.dropoff_addr.address}
          </Text>
        </View>
        <Text style={[styles.amount, { color: theme.colors.text }]}>{order.subtotal} VND</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontWeight: "600",
    fontSize: 15,
  },
  subtitle: {
    fontSize: 13,
    flexShrink: 1,
  },
  amount: {
    marginTop: 4,
    fontWeight: "600",
  },
});
