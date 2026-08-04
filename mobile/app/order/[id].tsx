import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrder } from "@/hooks/useOrders";
import { useOrderTracking } from "@/hooks/useOrderTracking";
import { useAuthStore } from "@/stores/authStore";
import { useTrackingStore } from "@/stores/trackingStore";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, refetch } = useOrder(id);
  const { status: liveStatus } = useOrderTracking(id);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();
  const shipperLocation = useTrackingStore((s) =>
    order?.shipper_id ? s.shipperLocationById[order.shipper_id] : undefined
  );

  async function runAction(action: () => Promise<unknown>) {
    await action();
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    refetch();
  }

  if (isLoading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const status = liveStatus ?? order.status;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Order #{order.id.slice(0, 8)}</Text>
      <StatusBadge status={status} />

      <View style={styles.section}>
        <Text style={styles.label}>Pickup</Text>
        <Text>{order.pickup_addr.address}</Text>
        <Text style={styles.label}>Dropoff</Text>
        <Text>{order.dropoff_addr.address}</Text>
        <Text style={styles.label}>Subtotal</Text>
        <Text>{order.subtotal} VND</Text>
      </View>

      {shipperLocation && (
        <View style={styles.section}>
          <Text style={styles.label}>Shipper location (live)</Text>
          <Text>
            {shipperLocation.lat.toFixed(5)}, {shipperLocation.lng.toFixed(5)}
          </Text>
        </View>
      )}

      {role === "customer" && status === "pending_confirmation" && (
        <Pressable
          style={styles.dangerButton}
          onPress={() => runAction(() => api.cancelOrder(order.id))}
        >
          <Text style={styles.buttonText}>Cancel order</Text>
        </Pressable>
      )}

      {role === "shipper" && status === "assigned" && (
        <Pressable
          style={styles.primaryButton}
          onPress={() => runAction(() => api.pickupOrder(order.id))}
        >
          <Text style={styles.buttonText}>Mark picked up</Text>
        </Pressable>
      )}
      {role === "shipper" && status === "picked_up" && (
        <Pressable
          style={styles.primaryButton}
          onPress={() => runAction(() => api.startDelivery(order.id))}
        >
          <Text style={styles.buttonText}>Start delivery</Text>
        </Pressable>
      )}
      {role === "shipper" && status === "delivering" && (
        <View style={{ gap: 8 }}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => runAction(() => api.completeOrder(order.id))}
          >
            <Text style={styles.buttonText}>Mark delivered</Text>
          </Pressable>
          <Pressable
            style={styles.dangerButton}
            onPress={() => runAction(() => api.failOrder(order.id, "delivery failed"))}
          >
            <Text style={styles.buttonText}>Report failure</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  section: { gap: 4, marginTop: 8 },
  label: { fontWeight: "600", color: "#475569", marginTop: 6 },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  dangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "white", fontWeight: "700" },
});
