import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";

interface Complaint {
  order_id: string;
  payment_id: string | null;
  reason: string;
  status: string;
}

export default function ComplaintsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ops", "complaints"],
    queryFn: api.opsComplaints,
    refetchInterval: 10_000,
  });

  const complaints = (data ?? []) as Complaint[];

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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.reason}>{item.reason}</Text>
            <Text style={styles.meta}>
              Order #{item.order_id.slice(0, 8)} · {item.status}
            </Text>
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
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 10,
  },
  reason: { fontWeight: "700" },
  meta: { color: "#7f1d1d", marginTop: 2, fontSize: 12 },
});
