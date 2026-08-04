import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import type { HeatmapCell } from "@/types/api";

function intensityColor(count: number, max: number): string {
  const ratio = max > 0 ? count / max : 0;
  // interpolate from a light amber to a deep red as density increases
  if (ratio > 0.75) return "#dc2626";
  if (ratio > 0.5) return "#f97316";
  if (ratio > 0.25) return "#f59e0b";
  return "#fde68a";
}

export default function HeatmapScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ops", "heatmap"],
    queryFn: api.opsHeatmap,
    refetchInterval: 10_000,
  });

  const cells = (data ?? []) as HeatmapCell[];
  const sorted = [...cells].sort((a, b) => b.shipper_count - a.shipper_count);
  const max = sorted[0]?.shipper_count ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Shipper density</Text>
      <Text style={styles.hint}>Grid buckets (~1km) ranked by online shipper count</Text>
      <FlatList
        data={sorted}
        keyExtractor={(c, i) => `${c.lat_bucket}-${c.lng_bucket}-${i}`}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "Loading..." : "No online shippers right now."}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: intensityColor(item.shipper_count, max) }]} />
            <Text style={styles.coords}>
              {item.lat_bucket.toFixed(2)}, {item.lng_bucket.toFixed(2)}
            </Text>
            <Text style={styles.count}>{item.shipper_count} shipper(s)</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 18, fontWeight: "700" },
  hint: { color: "#64748b", marginBottom: 12, fontSize: 12 },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  coords: { flex: 1, fontWeight: "600" },
  count: { color: "#475569" },
});
