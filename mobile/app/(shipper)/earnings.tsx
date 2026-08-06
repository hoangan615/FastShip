import { useQuery } from "@tanstack/react-query";
import { RefreshControl, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Card, EmptyState, Screen } from "@/components/ui";
import { useTheme } from "@/theme";

export default function EarningsScreen() {
  const theme = useTheme();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["shippers", "me", "revenue"],
    queryFn: api.getShipperRevenue,
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return (
      <Screen center>
        <EmptyState icon="cash-outline" title="Loading..." loading />
      </Screen>
    );
  }

  const total = Number(data.released_payout) + Number(data.pending_payout);

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      <Card>
        <Text style={[theme.typography.title, { color: theme.colors.text, textAlign: "center" }]}>
          {total.toLocaleString()} VND
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
          ]}
        >
          Total earned from delivery fees
        </Text>
      </Card>

      <Card>
        <Text style={[theme.typography.heading, { color: theme.colors.text, textAlign: "center" }]}>
          {data.total_deliveries}
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, textAlign: "center", marginTop: 4 },
          ]}
        >
          Completed deliveries
        </Text>
      </Card>

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
              Released to you
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
    </Screen>
  );
}
