import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { connectSocket, getSocket } from "@/api/ws";
import { Button, Card, EmptyState, Screen } from "@/components/ui";
import { useTheme } from "@/theme";

const PING_INTERVAL_MS = 7_000; // spec: shipper location ping every 5-10s

export default function ShipperHomeScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["shippers", "me"],
    queryFn: api.getMyShipperProfile,
  });
  const [toggling, setToggling] = useState(false);
  const [offer, setOffer] = useState<{ order_id: string; expires_in: number } | null>(null);
  const [responding, setResponding] = useState(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOnline = profile?.status === "available" || profile?.status === "busy";

  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    const onOffer = (data: { order_id: string; expires_in: number }) => setOffer(data);
    socket.on("match.offer_received", onOffer);
    return () => {
      socket.off("match.offer_received", onOffer);
    };
  }, []);

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
      } else {
        await api.declineOffer(offer.order_id);
      }
      setOffer(null);
      queryClient.invalidateQueries({ queryKey: ["shippers", "me"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "shipper", "mine"] });
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
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
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
          <Text style={{ color: theme.colors.warningFg }}>Expires in ~{offer.expires_in}s</Text>
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
