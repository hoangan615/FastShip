import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { connectSocket, getSocket } from "@/api/ws";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { useTheme } from "@/theme";
import { showToast } from "@/stores/toastStore";

const PING_INTERVAL_MS = 7_000; // spec: shipper location ping every 5-10s

export default function ShipperHomeScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["shippers", "me"],
    queryFn: api.getMyShipperProfile,
  });
  const { data: revenue } = useQuery({
    queryKey: ["shippers", "me", "revenue"],
    queryFn: api.getShipperRevenue,
  });
  const [toggling, setToggling] = useState(false);
  const [offer, setOffer] = useState<{ order_id: string; expires_in: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [responding, setResponding] = useState(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOnline = profile?.status === "available" || profile?.status === "busy";

  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    const onOffer = (data: { order_id: string; expires_in: number }) => {
      setOffer(data);
      setSecondsLeft(data.expires_in);
    };
    socket.on("match.offer_received", onOffer);
    return () => {
      socket.off("match.offer_received", onOffer);
    };
  }, []);

  // Live countdown so a shipper can't tap Accept on an offer that has
  // already expired server-side — auto-dismiss the card at zero instead.
  useEffect(() => {
    if (!offer) return;
    if (secondsLeft <= 0) {
      setOffer(null);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [offer, secondsLeft]);

  useEffect(() => {
    if (!isOnline) {
      if (pingRef.current) clearInterval(pingRef.current);
      return;
    }

    let cancelled = false;
    async function pingLoop() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      const sendPing = async () => {
        const loc = await Location.getCurrentPositionAsync({});
        await api.pingShipperLocation(loc.coords.latitude, loc.coords.longitude);
      };
      await sendPing();
      pingRef.current = setInterval(sendPing, PING_INTERVAL_MS);
    }
    pingLoop();

    return () => {
      cancelled = true;
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [isOnline]);

  async function toggleOnline(value: boolean) {
    setToggling(true);
    try {
      await api.setShipperStatus(value ? "available" : "offline");
      queryClient.invalidateQueries({ queryKey: ["shippers", "me"] });
    } finally {
      setToggling(false);
    }
  }

  async function respondToOffer(accept: boolean) {
    if (!offer) return;
    setResponding(true);
    try {
      if (accept) {
        await api.acceptOffer(offer.order_id);
        showToast("Delivery accepted");
      } else {
        await api.declineOffer(offer.order_id);
      }
      setOffer(null);
      queryClient.invalidateQueries({ queryKey: ["shippers", "me"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "shipper", "mine"] });
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "That offer is no longer available.", "error");
      setOffer(null);
    } finally {
      setResponding(false);
    }
  }

  if (isLoading) {
    return (
      <Screen center>
        <EmptyState icon="bicycle-outline" title="Loading..." loading />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <Stat
          icon="star"
          value={profile ? Number(profile.rating).toFixed(1) : "—"}
          label="Rating"
        />
        <Stat icon="checkmark-done" value={String(revenue?.total_deliveries ?? "—")} label="Deliveries" />
        <Stat
          icon="time-outline"
          value={revenue ? `${Number(revenue.pending_payout).toLocaleString()}đ` : "—"}
          label="Pending payout"
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: theme.spacing.md,
        }}
      >
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>
          {isOnline ? "Online" : "Offline"}
        </Text>
        <Switch
          value={!!isOnline}
          onValueChange={toggleOnline}
          disabled={toggling}
          trackColor={{ true: theme.colors.success }}
        />
      </View>
      <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: theme.spacing.xs }]}>
        {isOnline
          ? "Sending your location so nearby orders can find you."
          : "Go online to start receiving delivery offers."}
      </Text>

      {offer && (
        <Card variant="tinted-warning" style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          <Text style={[theme.typography.subheading, { color: theme.colors.warningFg }]}>
            New delivery offer!
          </Text>
          <Text style={{ color: theme.colors.warningFg }}>Expires in {secondsLeft}s</Text>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Accept"
                icon="checkmark"
                style={{ backgroundColor: theme.colors.success }}
                loading={responding}
                onPress={() => respondToOffer(true)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Decline"
                icon="close"
                variant="danger"
                loading={responding}
                onPress={() => respondToOffer(false)}
              />
            </View>
          </View>
        </Card>
      )}

      {profile?.active_order_id && (
        <Link href={`/order/${profile.active_order_id}`} style={{ marginTop: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>View active order →</Text>
        </Link>
      )}
    </Screen>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Card>
        <Ionicons name={icon} size={16} color={theme.colors.textMuted} style={{ alignSelf: "center" }} />
        <Text
          style={[
            theme.typography.bodyStrong,
            { color: theme.colors.text, textAlign: "center", marginTop: 4 },
          ]}
        >
          {value}
        </Text>
        <Text
          style={[
            theme.typography.small,
            { color: theme.colors.textMuted, textAlign: "center", marginTop: 2, fontWeight: "500" },
          ]}
        >
          {label}
        </Text>
      </Card>
    </View>
  );
}
