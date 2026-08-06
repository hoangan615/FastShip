import { useQuery } from "@tanstack/react-query";
import { RefreshControl, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { OrderCard } from "@/components/OrderCard";
import { Card, EmptyState, Screen } from "@/components/ui";
import { useMerchantOrders } from "@/hooks/useOrders";
import { useTheme } from "@/theme";

export default function RevenueScreen() {
  const theme = useTheme();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", "merchant", "revenue"],
    queryFn: api.getMerchantRevenue,
    refetchInterval: 15_000,
  });
  const { data: orders } = useMerchantOrders();

  const pendingConfirmation = (orders ?? []).filter((o) => o.status === "pending_confirmation").length;
  const recentOrders = (orders ?? []).slice(0, 5);

  if (isLoading || !data) {
    return (
      <Screen center>
        <EmptyState icon="stats-chart-outline" title="Loading..." loading />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      {pendingConfirmation > 0 && (
        <Card variant="tinted-warning">
          <Text style={{ color: theme.colors.warningFg, fontWeight: "600" }}>
            {pendingConfirmation} order{pendingConfirmation > 1 ? "s" : ""} awaiting your confirmation
          </Text>
        </Card>
      )}

      <Card>
        <Text style={[theme.typography.title, { color: theme.colors.text, textAlign: "center" }]}>
          {Number(data.total_revenue).toLocaleString()} VND
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
          ]}
        >
          Gross product revenue (completed orders)
        </Text>
      </Card>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Platform commission:</Text>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text, fontSize: 13 }]}>
          {(Number(data.commission_rate) * 100).toFixed(0)}%
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <Stat label="Total orders" value={data.total_orders} />
        <Stat label="Completed" value={data.completed_orders} />
      </View>

      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Card>
            <Text style={[theme.typography.heading, { color: theme.colors.success, textAlign: "center" }]}>
              {Number(data.released_payout).toLocaleString()} VND
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
              ]}
            >
              Released to you (net of commission)
            </Text>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <Text style={[theme.typography.heading, { color: theme.colors.warning, textAlign: "center" }]}>
              {Number(data.pending_payout).toLocaleString()} VND
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
              ]}
            >
              Pending release (escrow held)
            </Text>
          </Card>
        </View>
      </View>

      {recentOrders.length > 0 && (
        <>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
            Recent orders
          </Text>
          {recentOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </>
      )}
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
            theme.typography.caption,
            { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
          ]}
        >
          {label}
        </Text>
      </Card>
    </View>
  );
}
