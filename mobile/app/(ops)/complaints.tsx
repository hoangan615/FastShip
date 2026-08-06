import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { useTheme } from "@/theme";

interface Complaint {
  order_id: string;
  payment_id: string | null;
  reason: string;
  status: string;
}

export default function ComplaintsScreen() {
  const theme = useTheme();
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

  function confirmPaymentResolution(key: string, paymentId: string, release: boolean) {
    Alert.alert(
      release ? "Release to merchant" : "Refund customer",
      release
        ? "Release the held escrow payment to the merchant? This cannot be undone."
        : "Refund this payment to the customer? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: release ? "Release" : "Refund",
          style: "destructive",
          onPress: () => runAction(key, () => api.opsResolvePayment(paymentId, release)),
        },
      ]
    );
  }

  return (
    <Screen>
      <FlatList
        data={complaints}
        keyExtractor={(c, i) => `${c.order_id}-${i}`}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <EmptyState
            icon="alert-circle-outline"
            title={isLoading ? "Loading..." : "No open complaints"}
            loading={isLoading}
          />
        }
        renderItem={({ item, index }) => {
          const key = `${item.order_id}-${index}`;
          const busy = busyKey === key;
          return (
            <Card variant="tinted-danger" style={{ marginBottom: theme.spacing.sm + 2, gap: theme.spacing.sm }}>
              <Text style={[theme.typography.subheading, { color: theme.colors.dangerFg }]}>
                {item.reason}
              </Text>
              <Text style={[theme.typography.small, { color: theme.colors.dangerFg, fontWeight: "500" }]}>
                Order #{item.order_id.slice(0, 8)} · {item.status}
              </Text>

              {item.status === "payment_disputed" && item.payment_id && (
                <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Release to merchant"
                      style={{ backgroundColor: theme.colors.success }}
                      loading={busy}
                      onPress={() => confirmPaymentResolution(key, item.payment_id as string, true)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Refund customer"
                      variant="danger"
                      loading={busy}
                      onPress={() => confirmPaymentResolution(key, item.payment_id as string, false)}
                    />
                  </View>
                </View>
              )}

              {item.status === "sla_breach" && (
                <Button
                  label="Reassign shipper"
                  loading={busy}
                  onPress={() => runAction(key, () => api.opsReassignOrder(item.order_id))}
                />
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
