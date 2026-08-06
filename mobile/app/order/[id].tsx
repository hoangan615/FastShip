import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { useOrder } from "@/hooks/useOrders";
import { useOrderTracking } from "@/hooks/useOrderTracking";
import { useAuthStore } from "@/stores/authStore";
import { useTheme, type Theme } from "@/theme";
import { useTrackingStore } from "@/stores/trackingStore";

interface OrderAction {
  key: string;
  label: string;
  variant: "primary" | "danger";
  run: () => Promise<unknown>;
  confirm?: { title: string; message: string; confirmLabel: string };
}

function getActionsFor(
  role: string | null,
  status: string,
  orderId: string
): OrderAction[] {
  if (role === "customer" && status === "pending_confirmation") {
    return [
      {
        key: "cancel",
        label: "Cancel order",
        variant: "danger",
        run: () => api.cancelOrder(orderId),
        confirm: {
          title: "Cancel order",
          message: "Are you sure you want to cancel this order?",
          confirmLabel: "Cancel order",
        },
      },
    ];
  }

  if (role === "shipper" && status === "assigned") {
    return [
      { key: "pickup", label: "Mark picked up", variant: "primary", run: () => api.pickupOrder(orderId) },
      {
        key: "reject",
        label: "Can't take this order",
        variant: "danger",
        run: () => api.rejectAssignment(orderId, "unable to fulfill"),
        confirm: {
          title: "Reject assignment",
          message: "You won't be able to take this order back once rejected.",
          confirmLabel: "Reject",
        },
      },
    ];
  }

  if (role === "shipper" && status === "picked_up") {
    return [
      { key: "start", label: "Start delivery", variant: "primary", run: () => api.startDelivery(orderId) },
    ];
  }

  if (role === "shipper" && status === "delivering") {
    return [
      { key: "complete", label: "Mark delivered", variant: "primary", run: () => api.completeOrder(orderId) },
      {
        key: "fail",
        label: "Report failure",
        variant: "danger",
        run: () => api.failOrder(orderId, "delivery failed"),
        confirm: {
          title: "Report delivery failure",
          message: "This marks the order as failed and cannot be undone.",
          confirmLabel: "Report failure",
        },
      },
    ];
  }

  return [];
}

export default function OrderDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, refetch } = useOrder(id);
  const { status: liveStatus } = useOrderTracking(id);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();
  const shipperLocation = useTrackingStore((s) =>
    order?.shipper_id ? s.shipperLocationById[order.shipper_id] : undefined
  );
  const [runningKey, setRunningKey] = useState<string | null>(null);

  async function runAction(action: OrderAction) {
    setRunningKey(action.key);
    try {
      await action.run();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      refetch();
    } finally {
      setRunningKey(null);
    }
  }

  function handleActionPress(action: OrderAction) {
    if (!action.confirm) {
      runAction(action);
      return;
    }
    Alert.alert(action.confirm.title, action.confirm.message, [
      { text: "Cancel", style: "cancel" },
      { text: action.confirm.confirmLabel, style: "destructive", onPress: () => runAction(action) },
    ]);
  }

  if (isLoading || !order) {
    return (
      <Screen center>
        <EmptyState icon="receipt-outline" title="Loading..." loading />
      </Screen>
    );
  }

  const status = liveStatus ?? order.status;
  const actions = getActionsFor(role, status, order.id);

  return (
    <Screen scroll>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>
        Order #{order.id.slice(0, 8)}
      </Text>
      <StatusBadge status={status} />

      <Card style={{ gap: theme.spacing.xs }}>
        <Text style={[theme.typography.small, { color: theme.colors.textMuted }]}>Pickup</Text>
        <Text style={{ color: theme.colors.text }}>{order.pickup_addr.address}</Text>
        <Text style={[theme.typography.small, { color: theme.colors.textMuted, marginTop: theme.spacing.xs }]}>
          Dropoff
        </Text>
        <Text style={{ color: theme.colors.text }}>{order.dropoff_addr.address}</Text>
        <Text style={[theme.typography.small, { color: theme.colors.textMuted, marginTop: theme.spacing.xs }]}>
          Subtotal
        </Text>
        <Text style={{ color: theme.colors.text }}>{order.subtotal} VND</Text>
      </Card>

      {shipperLocation && (
        <Card style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.small, { color: theme.colors.textMuted }]}>
            Shipper location (live)
          </Text>
          <Text style={{ color: theme.colors.text }}>
            {shipperLocation.lat.toFixed(5)}, {shipperLocation.lng.toFixed(5)}
          </Text>
        </Card>
      )}

      {role === "customer" && status === "completed" && <RatingSection orderId={order.id} />}

      {actions.map((action) => (
        <Button
          key={action.key}
          label={action.label}
          variant={action.variant}
          loading={runningKey === action.key}
          onPress={() => handleActionPress(action)}
        />
      ))}
    </Screen>
  );
}

function RatingSection({ orderId }: { orderId: string }) {
  const theme = useTheme();
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
      <Card style={{ gap: theme.spacing.xs }}>
        <Text style={[theme.typography.small, { color: theme.colors.textMuted }]}>Your rating</Text>
        <Stars score={existingRating.score} theme={theme} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.typography.small, { color: theme.colors.textMuted }]}>Rate your delivery</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)} hitSlop={6}>
            <Ionicons
              name={n <= score ? "star" : "star-outline"}
              size={32}
              color={n <= score ? theme.colors.warning : theme.colors.border}
            />
          </Pressable>
        ))}
      </View>
      <Button label="Submit rating" onPress={submit} loading={submitting} disabled={score < 1} />
    </Card>
  );
}

function Stars({ score, theme }: { score: number; theme: Theme }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= score ? "star" : "star-outline"}
          size={20}
          color={n <= score ? theme.colors.warning : theme.colors.border}
        />
      ))}
    </View>
  );
}
