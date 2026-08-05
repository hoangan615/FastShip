import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
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

      {role === "customer" && status === "completed" && <RatingSection orderId={order.id} />}

      {role === "customer" && status === "pending_confirmation" && (
        <Pressable
          style={styles.dangerButton}
          onPress={() => runAction(() => api.cancelOrder(order.id))}
        >
          <Text style={styles.buttonText}>Cancel order</Text>
        </Pressable>
      )}

      {role === "shipper" && status === "assigned" && (
        <View style={{ gap: 8 }}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => runAction(() => api.pickupOrder(order.id))}
          >
            <Text style={styles.buttonText}>Mark picked up</Text>
          </Pressable>
          <Pressable
            style={styles.dangerButton}
            onPress={() => runAction(() => api.rejectAssignment(order.id, "unable to fulfill"))}
          >
            <Text style={styles.buttonText}>Can't take this order</Text>
          </Pressable>
        </View>
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

function RatingSection({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data: existingRating, isLoading } = useQuery({
    queryKey: ["orders", orderId, "rating"],
    queryFn: () => api.getOrderRating(orderId),
  });

  async function submit() {
    if (score < 1) return;
    setSubmitting(true);
    try {
      await api.rateOrder(orderId, score);
      queryClient.invalidateQueries({ queryKey: ["orders", orderId, "rating"] });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  if (existingRating) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Your rating</Text>
        <Text style={styles.stars}>{"★".repeat(existingRating.score)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Rate your delivery</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)}>
            <Text style={[styles.star, n <= score && styles.starFilled]}>{"★"}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.primaryButton, score < 1 && styles.buttonDisabled]}
        onPress={submit}
        disabled={submitting || score < 1}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Submit rating</Text>
        )}
      </Pressable>
    </View>
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
  buttonDisabled: { opacity: 0.5 },
  stars: { fontSize: 22, color: "#f59e0b" },
  starRow: { flexDirection: "row", gap: 4 },
  star: { fontSize: 32, color: "#cbd5e1" },
  starFilled: { color: "#f59e0b" },
});
