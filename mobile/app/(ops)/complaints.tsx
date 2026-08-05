import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";

interface Complaint {
  order_id: string;
  payment_id: string | null;
  reason: string;
  status: string;
}

export default function ComplaintsScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ops", "complaints"],
    queryFn: api.opsComplaints,
    refetchInterval: 10_000,
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const complaints = (data ?? []) as Complaint[];

  async function runAction(key: string, action: () => Promise<unknown>) {
    setBusyKey(key);
    try {
      await action();
      queryClient.invalidateQueries({ queryKey: ["ops", "complaints"] });
      queryClient.invalidateQueries({ queryKey: ["ops", "orders", "live"] });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={complaints}
        keyExtractor={(c, i) => `${c.order_id}-${i}`}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "Loading..." : "No open complaints."}</Text>
        }
        renderItem={({ item, index }) => {
          const key = `${item.order_id}-${index}`;
          const busy = busyKey === key;
          return (
            <View style={styles.card}>
              <Text style={styles.reason}>{item.reason}</Text>
              <Text style={styles.meta}>
                Order #{item.order_id.slice(0, 8)} · {item.status}
              </Text>

              {item.status === "payment_disputed" && item.payment_id && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.releaseButton}
                    disabled={busy}
                    onPress={() =>
                      runAction(key, () => api.opsResolvePayment(item.payment_id as string, true))
                    }
                  >
                    {busy ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>Release to merchant</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.refundButton}
                    disabled={busy}
                    onPress={() =>
                      runAction(key, () => api.opsResolvePayment(item.payment_id as string, false))
                    }
                  >
                    <Text style={styles.buttonText}>Refund customer</Text>
                  </Pressable>
                </View>
              )}

              {item.status === "sla_breach" && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.reassignButton}
                    disabled={busy}
                    onPress={() => runAction(key, () => api.opsReassignOrder(item.order_id))}
                  >
                    {busy ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>Reassign shipper</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
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
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 10,
    gap: 6,
  },
  reason: { fontWeight: "700" },
  meta: { color: "#7f1d1d", marginTop: 2, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  releaseButton: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  refundButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  reassignButton: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "700", fontSize: 13 },
});
