import { FlatList } from "react-native";

import { OrderCard } from "@/components/OrderCard";
import { EmptyState, Screen } from "@/components/ui";
import { useCustomerOrders } from "@/hooks/useOrders";

export default function CustomerOrdersScreen() {
  const { data, isLoading, refetch, isRefetching } = useCustomerOrders();

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={isLoading ? "Loading..." : "No orders yet"}
            subtitle={isLoading ? undefined : "Orders you place will show up here."}
            loading={isLoading}
          />
        }
      />
    </Screen>
  );
}
