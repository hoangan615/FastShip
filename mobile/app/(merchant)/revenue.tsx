import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";

export default function RevenueScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", "merchant", "revenue"],
    queryFn: api.getMerchantRevenue,
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.card}>
        <Text style={styles.bigValue}>{data.total_revenue} VND</Text>
        <Text style={styles.bigLabel}>Total revenue (completed orders)</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Total orders" value={data.total_orders} />
        <Stat label="Completed" value={data.completed_orders} />
      </View>

      <View style={styles.payoutRow}>
        <View style={[styles.card, styles.payoutCard]}>
          <Text style={styles.payoutValue}>{data.released_payout} VND</Text>
          <Text style={styles.bigLabel}>Released to you</Text>
        </View>
        <View style={[styles.card, styles.payoutCard]}>
          <Text style={styles.payoutValuePending}>{data.pending_payout} VND</Text>
          <Text style={styles.bigLabel}>Pending release (escrow held)</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  bigValue: { fontSize: 28, fontWeight: "800" },
  bigLabel: { color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  payoutRow: { flexDirection: "row", gap: 8 },
  payoutCard: { flex: 1 },
  payoutValue: { fontSize: 18, fontWeight: "700", color: "#16a34a" },
  payoutValuePending: { fontSize: 18, fontWeight: "700", color: "#f59e0b" },
});
