import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { connectSocket, getSocket } from "@/api/ws";

const PING_INTERVAL_MS = 7_000; // spec: shipper location ping every 5-10s

export default function ShipperHomeScreen() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["shippers", "me"],
    queryFn: api.getMyShipperProfile,
  });
  const [toggling, setToggling] = useState(false);
  const [offer, setOffer] = useState<{ order_id: string; expires_in: number } | null>(null);
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
    if (accept) {
      await api.acceptOffer(offer.order_id);
    } else {
      await api.declineOffer(offer.order_id);
    }
    setOffer(null);
    queryClient.invalidateQueries({ queryKey: ["shippers", "me"] });
    queryClient.invalidateQueries({ queryKey: ["orders", "shipper", "mine"] });
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{isOnline ? "Online" : "Offline"}</Text>
        <Switch value={!!isOnline} onValueChange={toggleOnline} disabled={toggling} />
      </View>
      <Text style={styles.hint}>
        {isOnline
          ? "Sending your location so nearby orders can find you."
          : "Go online to start receiving delivery offers."}
      </Text>

      {offer && (
        <View style={styles.offerCard}>
          <Text style={styles.offerTitle}>New delivery offer!</Text>
          <Text>Expires in ~{offer.expires_in}s</Text>
          <View style={styles.offerActions}>
            <Text style={styles.acceptButton} onPress={() => respondToOffer(true)}>
              Accept
            </Text>
            <Text style={styles.declineButton} onPress={() => respondToOffer(false)}>
              Decline
            </Text>
          </View>
        </View>
      )}

      {profile?.active_order_id && (
        <Link href={`/order/${profile.active_order_id}`} style={styles.activeLink}>
          <Text>View active order {"->"}</Text>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { fontSize: 20, fontWeight: "700" },
  hint: { color: "#64748b" },
  offerCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#f59e0b",
    gap: 6,
  },
  offerTitle: { fontWeight: "700", fontSize: 16 },
  offerActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  acceptButton: {
    color: "white",
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
    fontWeight: "700",
  },
  declineButton: {
    color: "white",
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
    fontWeight: "700",
  },
  activeLink: { marginTop: 8 },
});
