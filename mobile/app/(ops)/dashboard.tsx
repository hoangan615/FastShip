import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { StatusBadge } from "@/components/StatusBadge";
import { connectSocket, getSocket } from "@/api/ws";

export default function OpsDashboardScreen() {
  const queryClient = useQueryClient();
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const liveOrders = useQuery({
    queryKey: ["ops", "orders", "live"],
    queryFn: api.opsLiveOrders,
    refetchInterval: 5_000,
  });
  const summary = useQuery({
    queryKey: ["ops", "summary"],
    queryFn: api.opsSummary,
    refetchInterval: 15_000,
  });

  async function handleReassign(orderId: string) {
    setReassigningId(orderId);
    try {
      await api.opsReassignOrder(orderId);
      queryClient.invalidateQueries({ queryKey: ["ops", "orders", "live"] });
    } finally {
      setReassigningId(null);
    }
  }

  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    const refresh = () => {
      liveOrders.refetch();
      summary.refetch();
    };
    socket.on("order.status_changed", refresh);
    socket.on("match.exhausted", refresh);
    socket.on("shipper.went_offline", refresh);
    return () => {
      socket.off("order.status_changed", refresh);
      socket.off("match.exhausted", refresh);
      socket.off("shipper.went_offline", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {summary.data && (
        <View style={styles.statsRow}>
          <Stat label="Active" value={summary.data.active_orders} />
          <Stat label="Completed" value={summary.data.completed_orders} />
          <Stat label="Failed" value={summary.data.failed_orders} />
          <Stat label="Disputed" value={summary.data.disputed_payments} />
        </View>
      )}

      <Text style={styles.heading}>Live orders</Text>
      <FlatList
        data={liveOrders.data ?? []}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={<Text style={styles.empty}>No active orders.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
            <StatusBadge status={item.status} />
            {item.status === "pending" && !item.shipper_id && (
              <Pressable
                style={styles.reassignButton}
                disabled={reassigningId === item.id}
                onPress={() => handleReassign(item.id)}
              >
                {reassigningId === item.id ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.reassignButtonText}>Reassign</Text>
                )}
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  stat: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { color: "#64748b", fontSize: 12 },
  heading: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 24 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  orderId: { fontWeight: "600" },
  reassignButton: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reassignButtonText: { color: "white", fontWeight: "700", fontSize: 12 },
});
