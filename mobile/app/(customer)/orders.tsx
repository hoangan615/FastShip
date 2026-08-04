import { FlatList, StyleSheet, Text, View } from "react-native";

import { OrderCard } from "@/components/OrderCard";
import { useCustomerOrders } from "@/hooks/useOrders";

export default function CustomerOrdersScreen() {
  const { data, isLoading, refetch, isRefetching } = useCustomerOrders();

  return (
    <View style={styles.container}>
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "Loading..." : "No orders yet."}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 24 },
});
