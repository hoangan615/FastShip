import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { connectSocket, getSocket } from "@/api/ws";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { useTheme } from "@/theme";
import { showToast } from "@/stores/toastStore";

export default function OpsDashboardScreen() {
  const theme = useTheme();
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
      showToast("Order reassigned");
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Could not reassign this order.", "error");
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
    <Screen>
      {summary.data && (
        <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
          <Stat label="Active" value={summary.data.active_orders} />
          <Stat label="Completed" value={summary.data.completed_orders} />
          <Stat label="Failed" value={summary.data.failed_orders} />
          <Stat label="Disputed" value={summary.data.disputed_payments} />
        </View>
      )}

      <Text style={[theme.typography.heading, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
        Live orders
      </Text>
      <FlatList
        data={liveOrders.data ?? []}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={<EmptyState icon="pulse-outline" title="No active orders" />}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.sm + 2,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
              #{item.id.slice(0, 8)}
            </Text>
            <StatusBadge status={item.status} />
            {item.status === "pending" && !item.shipper_id && (
              <Button
                label="Reassign"
                fullWidth={false}
                loading={reassigningId === item.id}
                onPress={() => handleReassign(item.id)}
              />
            )}
          </View>
        )}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Card>
        <Text style={[theme.typography.heading, { color: theme.colors.text, textAlign: "center" }]}>
          {value}
        </Text>
        <Text
          style={[
            theme.typography.small,
            { color: theme.colors.textMuted, textAlign: "center", marginTop: 4, fontWeight: "500" },
          ]}
        >
          {label}
        </Text>
      </Card>
    </View>
  );
}
