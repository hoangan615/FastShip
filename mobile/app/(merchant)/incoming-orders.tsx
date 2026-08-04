import { useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { StatusBadge } from "@/components/StatusBadge";
import { useMerchantOrders } from "@/hooks/useOrders";
import type { Order } from "@/types/api";

export default function IncomingOrdersScreen() {
  const { data, isLoading, refetch, isRefetching } = useMerchantOrders();
  const queryClient = useQueryClient();

  async function respond(action: (id: string) => Promise<Order>, orderId: string) {
    await action(orderId);
    queryClient.invalidateQueries({ queryKey: ["orders", "merchant", "mine"] });
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "Loading..." : "No orders yet."}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>Order #{item.id.slice(0, 8)}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.amount}>{item.subtotal} VND</Text>

            {item.status === "pending_confirmation" && (
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.acceptButton}
                  onPress={() => respond(api.confirmOrder, item.id)}
                >
                  <Text style={styles.buttonText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={styles.rejectButton}
                  onPress={() => respond((id) => api.rejectOrder(id, "out of stock"), item.id)}
                >
                  <Text style={styles.buttonText}>Reject</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 24 },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    gap: 6,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontWeight: "700", fontSize: 15 },
  amount: { fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  acceptButton: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "700" },
});
