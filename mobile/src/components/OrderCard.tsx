import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusBadge } from "@/components/StatusBadge";
import type { Order } from "@/types/api";

export function OrderCard({ order }: { order: Order }) {
  return (
    <Link href={`/order/${order.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>Order #{order.id.slice(0, 8)}</Text>
          <StatusBadge status={order.status} />
        </View>
        <Text style={styles.subtitle}>{order.pickup_addr.address}</Text>
        <Text style={styles.subtitle}>{"->"} {order.dropoff_addr.address}</Text>
        <Text style={styles.amount}>{order.subtotal} VND</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 15,
  },
  subtitle: {
    color: "#475569",
    fontSize: 13,
  },
  amount: {
    marginTop: 4,
    fontWeight: "600",
  },
});
