import { useQuery } from "@tanstack/react-query";
import { RefreshControl, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Card, EmptyState, Screen } from "@/components/ui";
import { useTheme } from "@/theme";

export default function RevenueScreen() {
  const theme = useTheme();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", "merchant", "revenue"],
    queryFn: api.getMerchantRevenue,
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return (
      <Screen center>
        <EmptyState icon="stats-chart-outline" title="Loading..." loading />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      <Card>
        <Text style={[theme.typography.title, { color: theme.colors.text, textAlign: "center" }]}>
          {data.total_revenue} VND
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
          ]}
        >
          Total revenue (completed orders)
        </Text>
      </Card>

      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <Stat label="Total orders" value={data.total_orders} />
        <Stat label="Completed" value={data.completed_orders} />
      </View>

      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Card>
            <Text style={[theme.typography.heading, { color: theme.colors.success, textAlign: "center" }]}>
              {data.released_payout} VND
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
              ]}
            >
              Released to you
            </Text>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <Text style={[theme.typography.heading, { color: theme.colors.warning, textAlign: "center" }]}>
              {data.pending_payout} VND
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
