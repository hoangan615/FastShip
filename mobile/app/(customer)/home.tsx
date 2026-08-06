import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { OrderCard } from "@/components/OrderCard";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { useCustomerOrders } from "@/hooks/useOrders";
import { useTheme } from "@/theme";
import type { OrderStatus, Product } from "@/types/api";

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
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: api.getRecommendations,
  });

  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const totalSpent = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.subtotal) + Number(o.shipping_fee), 0);

  function goToProduct(product: Product) {
    router.push(`/(customer)/catalog?merchantId=${product.merchant_id}`);
  }

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Spent" value={`${totalSpent.toLocaleString()}đ`} />
      </View>

      <Button label="Browse merchants" icon="storefront-outline" onPress={() => router.push("/(customer)/catalog")} />

      {!!recommendations?.order_again.length && (
        <ProductRail
          title="Order again"
          products={recommendations.order_again}
          onPress={goToProduct}
        />
      )}
      {!!recommendations?.recommended.length && (
        <ProductRail
          title="Recommended for you"
          products={recommendations.recommended}
          onPress={goToProduct}
        />
      )}

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

function ProductRail({
  title,
  products,
  onPress,
}: {
  title: string;
  products: Product[];
  onPress: (product: Product) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing.sm }}>
      <Text style={[theme.typography.subheading, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          {products.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => onPress(product)}
              style={({ pressed }) => [
                {
                  width: 140,
                  padding: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
                theme.scheme === "light" ? theme.cardShadow : null,
              ]}
            >
              <Text
                numberOfLines={2}
                style={[theme.typography.small, { color: theme.colors.text, fontWeight: "600", minHeight: 32 }]}
              >
                {product.name}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                {Number(product.price).toLocaleString()}đ
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
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
