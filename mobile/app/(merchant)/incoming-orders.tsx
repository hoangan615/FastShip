import { useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, EmptyState, Screen } from "@/components/ui";
import { useTheme } from "@/theme";
import { useMerchantOrders } from "@/hooks/useOrders";
import type { Order } from "@/types/api";

export default function IncomingOrdersScreen() {
  const theme = useTheme();
  const { data, isLoading, refetch, isRefetching } = useMerchantOrders();
  const queryClient = useQueryClient();

  async function respond(action: (id: string) => Promise<Order>, orderId: string) {
    await action(orderId);
    queryClient.invalidateQueries({ queryKey: ["orders", "merchant", "mine"] });
  }

  function confirmReject(orderId: string) {
    Alert.alert("Reject order", "Are you sure you want to reject this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => respond((id) => api.rejectOrder(id, "out of stock"), orderId),
      },
    ]);
  }

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={isLoading ? "Loading..." : "No orders yet"}
            loading={isLoading}
          />
        }
        renderItem={({ item }) => (
          <View
            style={[
              {
                padding: theme.spacing.md + 2,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.colors.border,
                marginBottom: theme.spacing.sm + 2,
                gap: theme.spacing.sm,
              },
              theme.scheme === "light" ? theme.cardShadow : null,
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[theme.typography.subheading, { color: theme.colors.text }]}>
                Order #{item.id.slice(0, 8)}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
              {item.subtotal} VND
            </Text>

            {item.status === "pending_confirmation" && (
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Accept"
                    variant="primary"
                    style={{ backgroundColor: theme.colors.success }}
                    onPress={() => respond(api.confirmOrder, item.id)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Reject" variant="danger" onPress={() => confirmReject(item.id)} />
                </View>
              </View>
            )}
          </View>
        )}
      />
    </Screen>
  );
}
