import { useQuery } from "@tanstack/react-query";
import { FlatList, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { EmptyState, Screen } from "@/components/ui";
import { useTheme, type Theme } from "@/theme";
import type { HeatmapCell } from "@/types/api";

function intensityColor(theme: Theme, count: number, max: number): string {
  const ratio = max > 0 ? count / max : 0;
  // interpolate from a light warning tone to a deep danger tone as density increases
  if (ratio > 0.75) return theme.colors.danger;
  if (ratio > 0.5) return theme.colors.warning;
  if (ratio > 0.25) return theme.colors.warningFg;
  return theme.colors.warningBg;
}

export default function HeatmapScreen() {
  const theme = useTheme();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ops", "heatmap"],
    queryFn: api.opsHeatmap,
    refetchInterval: 10_000,
  });

  const cells = (data ?? []) as HeatmapCell[];
  const sorted = [...cells].sort((a, b) => b.shipper_count - a.shipper_count);
  const max = sorted[0]?.shipper_count ?? 0;

  return (
    <Screen>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Shipper density</Text>
      <Text
        style={[theme.typography.caption, { color: theme.colors.textMuted, marginBottom: theme.spacing.md }]}
      >
        Grid buckets (~1km) ranked by online shipper count
      </Text>
      <FlatList
        data={sorted}
        keyExtractor={(c, i) => `${c.lat_bucket}-${c.lng_bucket}-${i}`}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <EmptyState
            icon="flame-outline"
            title={isLoading ? "Loading..." : "No online shippers right now"}
            loading={isLoading}
          />
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: intensityColor(theme, item.shipper_count, max),
              }}
            />
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.text, flex: 1 }]}>
              {item.lat_bucket.toFixed(2)}, {item.lng_bucket.toFixed(2)}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>{item.shipper_count} shipper(s)</Text>
          </View>
        )}
      />
    </Screen>
  );
}
