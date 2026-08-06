import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { OrderCard } from "@/components/OrderCard";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { useCustomerOrders } from "@/hooks/useOrders";
import { useTheme } from "@/theme";
import type { OrderStatus } from "@/types/api";

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending_confirmation",
  "pending",
  "assigned",
  "picked_up",
  "delivering",
];

export default function CustomerHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading } = useCustomerOrders();
  const orders = data ?? [];

  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const totalSpent = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.subtotal) + Number(o.shipping_fee), 0);

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Spent" value={`${totalSpent.toLocaleString()}đ`} />
      </View>

      <Button label="Browse merchants" icon="storefront-outline" onPress={() => router.push("/(customer)/catalog")} />

      <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
        Recent orders
      </Text>
      {isLoading ? (
        <EmptyState icon="receipt-outline" title="Loading..." loading />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No orders yet"
          subtitle="Browse merchants above to place your first order."
        />
      ) : (
        orders.slice(0, 5).map((order) => <OrderCard key={order.id} order={order} />)
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
